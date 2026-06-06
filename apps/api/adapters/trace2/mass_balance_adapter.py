"""Mass balance specs + mappers.

Covers:
  - get_mass_balance_spec / map_mass_balance_rows (Slice 3)
  - get_mass_balance_ledger_spec / map_mass_balance_ledger_rows (Trace App ledger tab)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2MassBalanceLedgerRequest, Trace2MassBalanceRequest
from ._utils import (
    _bucket_movement_type,
    _is_unmapped_movement_category,
    _map_movement_category,
    _movement_label,
)

# ---------------------------------------------------------------------------
# Slice 3 — getMassBalanceSummary
# ---------------------------------------------------------------------------

def get_mass_balance_spec(request: Trace2MassBalanceRequest) -> QuerySpec:
    """Return a QuerySpec for getMassBalanceSummary.

    Source: gold_batch_mass_balance_v under TRACE_CATALOG / TRACE_SCHEMA (default: "gold").
    Contract: MassBalanceSummarySchema + MassBalanceMovementSchema (packages/data-contracts)
    Cache: PER_USER_60S — movement postings occur throughout the shift.

    Column verification status (verified live 2026-05-20, connected_plant_uat):
      - 11 columns confirmed via DESCRIBE TABLE: MATERIAL_ID, BATCH_ID, PLANT_ID,
        MOVEMENT_TYPE, QUANTITY (signed), UOM, PROCESS_ORDER_ID, POSTING_DATE,
        ABS_QUANTITY, BALANCE_QTY, MOVEMENT_CATEGORY.
      - WHERE keys material_id + batch_id confirmed.
      - SELECT uses lowercase column names; Databricks Statement API returns
        keys in the same case as the SELECT clause (verified live).

    Known correctness gaps (see traceability-defect-backlog.md):
      - TRACE-P1-010: MOVEMENT_CATEGORY mapping is incomplete. Live values include
        "STO Receipt", "STO Transfer", "Other (261)", "Write-Off" — none match
        _MOVEMENT_CATEGORY_MAP, all fall through to "adjustment". STO Receipt is
        an incoming movement but is currently treated as output. Pending a
        verified category-to-direction map. The mapper counts unmapped rows as
        unresolvedMovements so the panel's warning banner reflects truth.
      - TRACE-P1-011: BALANCE_QTY returned 0.000 for all 30+ rows of the UAT
        candidate (20035129 / 8000049668). The view's "balance_qty" column does
        not appear to be a per-batch running balance. Pending source verification
        with the data platform team.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_mass_balance = resolve_domain_object("trace2", "gold_batch_mass_balance_v")

    sql = f"""
    SELECT
        posting_date,
        movement_type,
        movement_category,
        abs_quantity,
        uom,
        balance_qty
    FROM {tbl_mass_balance}
    WHERE material_id = :material_id
      AND batch_id = :batch_id
    ORDER BY posting_date
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_mass_balance",
        module="trace2",
        endpoint="/api/trace2/mass-balance",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_mass_balance_v",
        tags=["trace2", "mass-balance"],
    )


def map_mass_balance_rows(rows: list[dict]) -> dict:
    """Map Databricks mass balance rows to MassBalanceSummarySchema shape.

    Totals:
      inputQuantity  = sum abs_quantity where category = 'production'
      outputQuantity = sum abs_quantity where category in ('shipment', 'consumption')
      varianceQuantity = input - output
      variancePercent  = variance/input*100 if input > 0 else 0.0

    unresolvedMovements:
      - rows with null balance_qty
      - rows whose movement_category did not match a known mapping in
        _MOVEMENT_CATEGORY_MAP (live values like "STO Receipt", "STO Transfer",
        "Other (NNN)", "Write-Off" currently fall through — see TRACE-P1-010).
      Counts are unioned (a row that fails both still counts once).

    balance_qty is mapped to runningBalance but live evidence shows the column
    is not a per-batch running tally (see TRACE-P1-011). Treat the field as
    movement-level snapshot until source semantics are verified.
    """
    if not rows:
        return {
            "inputQuantity": 0.0,
            "outputQuantity": 0.0,
            "varianceQuantity": 0.0,
            "variancePercent": 0.0,
            "uom": "",
            "confidence": 1.0,
            "unresolvedMovements": 0,
            "movements": [],
        }

    input_qty = 0.0
    output_qty = 0.0
    unresolved = 0
    movements: list[dict] = []

    for row in rows:
        raw_category = row.get("movement_category")
        category = _map_movement_category(raw_category)
        abs_qty = float(row.get("abs_quantity") or 0)

        if category == "production":
            input_qty += abs_qty
            delta = abs_qty
        else:
            output_qty += abs_qty
            delta = -abs_qty

        balance_qty = row.get("balance_qty")
        category_unmapped = _is_unmapped_movement_category(raw_category, category)
        if balance_qty is None or category_unmapped:
            unresolved += 1

        movements.append({
            "date": row.get("posting_date"),
            "category": category,
            "quantity": abs_qty,
            "delta": delta,
            "runningBalance": float(balance_qty) if balance_qty is not None else 0.0,
            "uom": row.get("uom") or "",
            "movementType": row.get("movement_type"),
        })

    variance_qty = input_qty - output_qty
    variance_pct = (variance_qty / input_qty * 100) if input_qty > 0 else 0.0
    uom = rows[0].get("uom") or "" if rows else ""

    return {
        "inputQuantity": input_qty,
        "outputQuantity": output_qty,
        "varianceQuantity": variance_qty,
        "variancePercent": variance_pct,
        "uom": uom,
        "confidence": max(0.0, 1.0 - unresolved / max(1, len(rows))),
        "unresolvedMovements": unresolved,
        "movements": movements,
    }


# ---------------------------------------------------------------------------
# Trace App ledger tab — get_mass_balance_ledger_spec / map_mass_balance_ledger_rows
# ---------------------------------------------------------------------------


def get_mass_balance_ledger_spec(request: Trace2MassBalanceLedgerRequest) -> QuerySpec:
    """Return a QuerySpec for the Trace App Mass Balance tab.

    Source: gold_batch_mass_balance_v ordered by POSTING_DATE so the panel
    receives events in chronological order. The mapper computes KPIs by
    bucketing MOVEMENT_TYPE into the panel's {101, 261, 601, 701, Z01} codes
    and aggregates signed QUANTITY values per bucket.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_mass_balance_v")

    sql = f"""
    SELECT
      POSTING_DATE        AS posting_date,
      MOVEMENT_TYPE       AS movement_type,
      MOVEMENT_CATEGORY   AS movement_category,
      QUANTITY            AS quantity,
      ABS_QUANTITY        AS abs_quantity,
      BALANCE_QTY         AS balance_qty,
      UOM                 AS uom,
      PROCESS_ORDER_ID    AS process_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
      AND MOVEMENT_TYPE IN ('101','102','131','261','262','601','602','701','702','711','712')
    ORDER BY POSTING_DATE, MOVEMENT_TYPE
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_mass_balance_ledger",
        module="trace2",
        endpoint="/api/trace2/mass-balance-ledger",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_mass_balance_v",
        tags=["trace2", "trace-app", "mass-balance-ledger"],
    )


def map_mass_balance_ledger_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_mass_balance_v rows to MassBalanceLedgerSchema shape.

    Zero rows → returns None. Variance is computed from the bucket aggregates:
      variance = produced + adjusted + consumed + shipped - current
    Negative consumption/shipping values keep their natural signs.
    """
    if not rows:
        return None

    events: list[dict] = []
    # uom is source-truthful: stays `None` when no row provides one.
    # Contract was relaxed to z.string().nullable() so we no longer emit
    # the empty-string sentinel (which read as "unit is empty" rather
    # than "unit is unavailable"). See PR brief Part B.
    uom: Optional[str] = None
    cum_running = 0.0
    for i, row in enumerate(rows):
        bucket = _bucket_movement_type(row.get("movement_type"))
        qty = float(row.get("quantity") or 0)
        balance = row.get("balance_qty")
        cum_running = float(balance) if balance is not None else cum_running + qty
        if uom is None and row.get("uom") is not None:
            raw_uom = str(row["uom"]).strip()
            if raw_uom:
                uom = raw_uom
        events.append({
            "d": i,
            "date": str(row.get("posting_date") or ""),
            "delta": round(qty * 10) / 10,
            "cum": round(cum_running * 10) / 10,
            "code": bucket,
            "label": _movement_label(row.get("movement_type"), row.get("movement_category")),
        })

    def _sum_where(code: str) -> float:
        return sum(e["delta"] for e in events if e["code"] == code)

    def _count_where(code: str) -> int:
        return sum(1 for e in events if e["code"] == code)

    produced = _sum_where("101")
    consumed = _sum_where("261")
    shipped = _sum_where("601")
    adjusted = _sum_where("701")
    current = events[-1]["cum"] if events else 0.0
    variance = round((produced + adjusted + consumed + shipped - current) * 10) / 10

    date_start = events[0]["date"] if events else ""
    date_end = events[-1]["date"] if events else ""

    return {
        "kpi": {
            "produced": round(produced),
            "consumed": round(consumed),
            "shipped": round(shipped),
            "adjusted": round(adjusted),
            "current": round(current),
            "variance": variance,
            "uom": uom,
            "postings": {
                "production": _count_where("101"),
                "consumption": _count_where("261"),
                "dispatch": _count_where("601"),
                "adjustment": _count_where("701"),
            },
        },
        "events": events,
        "dateStart": date_start,
        "dateEnd": date_end,
        # Reconciliation is application-derived (variance formula above).
        # MOVEMENT_CATEGORY direction and BALANCE_QTY semantics are not yet
        # governed — UI must surface this caveat.
        "reconciliationSource": "application-heuristic",
    }
