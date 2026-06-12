"""Mass balance specs + mappers.

Covers:
  - get_mass_balance_spec / map_mass_balance_rows (Slice 3)
  - get_mass_balance_ledger_spec / map_mass_balance_ledger_rows (Trace App ledger tab)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_governed_trace2_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2MassBalanceLedgerRequest, Trace2MassBalanceRequest
from ._utils import (
    _is_unmapped_movement_category,
    _map_movement_category,
    _movement_label,
)

# ---------------------------------------------------------------------------
# Slice 3 — getMassBalanceSummary
# ---------------------------------------------------------------------------

def get_mass_balance_spec(request: Trace2MassBalanceRequest) -> QuerySpec:
    """Return a QuerySpec for getMassBalanceSummary.

    Source: gold_batch_event_ledger under TRACE_GOVERNED_SCHEMA (default: "gold_io_reporting").
    Contract: MassBalanceSummarySchema + MassBalanceMovementSchema (packages/data-contracts)
    Cache: PER_USER_60S — movement postings occur throughout the shift.

    Column mapping from gold_batch_event_ledger:
      - LINK_TYPE       → movement_category (replaces legacy gold_batch_mass_balance_v.MOVEMENT_CATEGORY)
      - direction=IN    → positive row (batch received / produced)
      - direction=OUT   → negative row (batch consumed / shipped)
      - QUANTITY is always non-negative in the ledger MV (absolute value per edge)
      - ABS_QUANTITY = QUANTITY (already absolute)
      - BALANCE_QTY computed as a running SUM(signed qty) via window ORDER BY POSTING_DATE
        (the legacy view had a BALANCE_QTY column; the governed ledger does not — we compute it
        here. The running balance represents net cumulative movement for this batch×plant, NOT
        a stock position. Same caveat as legacy TRACE-P1-011.)
      - MOVEMENT_CATEGORY ← LINK_TYPE (PRODUCTION/VENDOR_RECEIPT→"production",
        DELIVERY→"shipment", adjustments→"adjustment")

    MOVEMENT_TYPE is absent from gold_batch_event_ledger (it carries LINK_TYPE instead).
    The mapper uses LINK_TYPE for both the category mapping and the movementType output field.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")

    sql = f"""
    SELECT
        POSTING_DATE        AS posting_date,
        LINK_TYPE           AS movement_category,
        QUANTITY            AS abs_quantity,
        SUM(
            CASE WHEN direction = 'IN' THEN QUANTITY ELSE -QUANTITY END
        ) OVER (
            PARTITION BY MATERIAL_ID, BATCH_ID
            ORDER BY POSTING_DATE
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )                    AS balance_qty,
        BASE_UNIT_OF_MEASURE AS uom,
        PROCESS_ORDER_ID     AS process_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
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
        source_badge="mv:gold_batch_event_ledger",
        tags=["trace2", "mass-balance"],
    )


def map_mass_balance_rows(rows: list[dict]) -> dict:
    """Map governed event ledger rows to MassBalanceSummarySchema shape.

    Totals:
      inputQuantity  = sum abs_quantity where category = 'production'
      outputQuantity = sum abs_quantity where category in ('shipment', 'consumption')
      varianceQuantity = input - output
      variancePercent  = variance/input*100 if input > 0 else 0.0

    unresolvedMovements:
      - rows with null balance_qty
      - rows whose LINK_TYPE (movement_category) did not match a known mapping in
        _MOVEMENT_CATEGORY_MAP (unmapped LINK_TYPEs fall through to "adjustment")

    balance_qty is the application-computed running net quantity (IN positive / OUT negative).
    The field retains the same contract name and semantics as the legacy runningBalance.
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
            # LINK_TYPE exposed as movementType — contract field preserved; value is now
            # a LINK_TYPE string (e.g. "PRODUCTION") rather than a 3-digit SAP code.
            "movementType": raw_category,
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

    Source: gold_batch_event_ledger ordered by POSTING_DATE so the panel
    receives events in chronological order.  LINK_TYPE replaces MOVEMENT_TYPE
    as the classification axis.  The mapper buckets LINK_TYPE into the panel's
    {101, 261, 601, 701, Z01} codes (see map_mass_balance_ledger_rows).

    Signed QUANTITY is computed from direction: IN → +QUANTITY, OUT → -QUANTITY.
    The running balance (balance_qty) is a window-function SUM of the signed quantity
    over the same batch, ordered by POSTING_DATE — identical semantics to the old
    BALANCE_QTY column in gold_batch_mass_balance_v.
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")

    sql = f"""
    SELECT
      POSTING_DATE         AS posting_date,
      LINK_TYPE            AS movement_type,
      LINK_TYPE            AS movement_category,
      CASE WHEN direction = 'IN' THEN QUANTITY ELSE -QUANTITY END AS quantity,
      QUANTITY             AS abs_quantity,
      SUM(
          CASE WHEN direction = 'IN' THEN QUANTITY ELSE -QUANTITY END
      ) OVER (
          PARTITION BY MATERIAL_ID, BATCH_ID
          ORDER BY POSTING_DATE
          ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )                    AS balance_qty,
      BASE_UNIT_OF_MEASURE AS uom,
      PROCESS_ORDER_ID     AS process_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND (:plant_id = '' OR PLANT_ID = :plant_id)
    ORDER BY POSTING_DATE, LINK_TYPE
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
        source_badge="mv:gold_batch_event_ledger",
        tags=["trace2", "trace-app", "mass-balance-ledger"],
    )


def map_mass_balance_ledger_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_event_ledger rows to MassBalanceLedgerSchema shape.

    Zero rows → returns None. Variance is computed from the bucket aggregates:
      variance = produced + adjusted + consumed + shipped - current
    Negative consumption/shipping values keep their natural signs.

    LINK_TYPE → bucket mapping:
      PRODUCTION, VENDOR_RECEIPT           → '101' (receipt/production bucket)
      DELIVERY                             → '601' (dispatch bucket)
      ADJUSTMENT_IN, ADJUSTMENT_OUT,
        BATCH_TRANSFER, MATERIAL_TRANSFER,
        STO_TRANSFER                       → '701' (adjustment bucket)
      everything else                      → 'Z01'

    Note: the legacy '261' (consumption) bucket was driven by SAP MOVEMENT_TYPE 261/262.
    In the governed ledger there is no MOVEMENT_TYPE; PRODUCTION OUT-direction rows represent
    component consumption (a batch consumed into a process order). These are bucketed as '101'
    because the signed qty is already negative for OUT rows — the net effect in KPIs is
    identical to the legacy behavior. The '261' bucket always yields 0 in this mapper.
    """
    if not rows:
        return None

    _LINK_TYPE_BUCKET: dict[str, str] = {
        "PRODUCTION": "101",
        "VENDOR_RECEIPT": "101",
        "DELIVERY": "601",
        "ADJUSTMENT_IN": "701",
        "ADJUSTMENT_OUT": "701",
        "BATCH_TRANSFER": "701",
        "MATERIAL_TRANSFER": "701",
        "STO_TRANSFER": "701",
    }

    events: list[dict] = []
    uom: Optional[str] = None
    cum_running = 0.0
    for i, row in enumerate(rows):
        link_type = str(row.get("movement_type") or "").strip().upper()
        bucket = _LINK_TYPE_BUCKET.get(link_type, "Z01")
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
    consumed = _sum_where("261")   # always 0.0 — no '261' bucket from governed ledger
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
        # LINK_TYPE direction semantics are governed — source is authoritative.
        "reconciliationSource": "application-heuristic",
    }
