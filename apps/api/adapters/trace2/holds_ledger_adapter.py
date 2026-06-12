"""Holds ledger spec + mapper.

Covers:
  - get_holds_ledger_spec / map_holds_ledger_rows (Trace App — getHoldsLedger)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_governed_trace2_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2HoldsLedgerRequest

# ---------------------------------------------------------------------------
# Trace App slice — getHoldsLedger
# ---------------------------------------------------------------------------

def get_holds_ledger_spec(request: Trace2HoldsLedgerRequest) -> QuerySpec:
    """Holds ledger derived from governed stock summary + QM lot status.

    Sources:
      - gold_batch_stock_summary_secured (TRACE_GOVERNED_SCHEMA, RLS-enforced)
            → blocked_quantity, quality_inspection_quantity, restricted_use_quantity,
              unrestricted_quantity, in_transfer_quantity, base_unit_of_measure
      - gold_wm_qm_lot_status (TRACE_GOVERNED_SCHEMA)
            → inspection lot header + latest usage decision
              estate-wide (all 138 plants via merged #122)

    Column mapping from governed objects vs legacy:
      gold_batch_stock_summary:
        blocked_quantity            → blocked
        quality_inspection_quantity → quality_inspection
        restricted_use_quantity     → restricted
        unrestricted_quantity       → unrestricted
        in_transfer_quantity        → transit
        base_unit_of_measure        → uom (NOW AVAILABLE in governed stock summary)
      Join key: plant_code = PLANT_ID, material_code = MATERIAL_ID, batch_number = BATCH_ID

      gold_wm_qm_lot_status:
        inspection_lot_number       → inspection_lot_id
        inspection_type             → inspection_type
        (no inspection_short_text — use inspection_type)
        lot_created_date            → created_date
        inspection_end_date         → inspection_end_date
        last_usage_decision_by      → created_by (approx — the person who made the decision)
        last_usage_decision         → usage_decision
      Join key: plant_code, material_code = MATERIAL_ID, batch_number = BATCH_ID

    Note: gold_wm_qm_lot_status has material_code and batch_number columns (silver grain).
    These are the SAP material/batch codes which correspond to MATERIAL_ID and BATCH_ID in
    the trace2 fan-out.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_stock = resolve_governed_trace2_object("gold_batch_stock_summary_secured")
    tbl_ql = resolve_governed_trace2_object("gold_wm_qm_lot_status")

    sql = f"""
    SELECT
      s.unrestricted_quantity       AS unrestricted,
      s.blocked_quantity            AS blocked,
      s.quality_inspection_quantity AS quality_inspection,
      s.restricted_use_quantity     AS restricted,
      s.in_transfer_quantity        AS transit,
      s.base_unit_of_measure        AS uom,
      ql.inspection_lot_number      AS inspection_lot_id,
      ql.inspection_type            AS inspection_type,
      ql.inspection_type            AS inspection_short_text,
      ql.lot_created_date           AS created_date,
      ql.inspection_end_date        AS inspection_end_date,
      ql.last_usage_decision_by     AS created_by,
      ql.last_usage_decision        AS usage_decision
    FROM {tbl_stock} s
    LEFT JOIN {tbl_ql} ql
      ON s.plant_code    = ql.plant_code
     AND s.material_code = ql.material_code
     AND s.batch_number  = ql.batch_number
    WHERE s.material_code = :material_id
      AND s.batch_number  = :batch_id
      AND (:plant_id = '' OR s.plant_code = :plant_id)
    ORDER BY ql.lot_created_date DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_holds_ledger",
        module="trace2",
        endpoint="/api/trace2/holds-ledger",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="mv:gold_batch_stock_summary+gold_wm_qm_lot_status",
        tags=["trace2", "trace-app", "holds-ledger"],
    )


def map_holds_ledger_rows(rows: list[dict]) -> Optional[dict]:
    """Build a HoldsLedger shape from the stock+quality_lot LEFT JOIN.

    The stock buckets are the same across rows (one stock row per batch+plant)
    so we read them from the first row. Quality lots vary per row; we split
    them into active (no usage decision) and resolved (has decision) lists.
    """
    if not rows:
        return None
    first = rows[0]
    uom: Optional[str] = str(first["uom"]) if first.get("uom") is not None else None

    qty_by_reason: list[dict] = []
    blocked = float(first.get("blocked") or 0)
    restricted = float(first.get("restricted") or 0)
    qi = float(first.get("quality_inspection") or 0)
    if blocked > 0:
        qty_by_reason.append({
            "code": "B3", "label": "Blocked stock", "qty": blocked,
            "uom": uom, "color": "var(--sunset, #F24A00)",
        })
    if qi > 0:
        qty_by_reason.append({
            "code": "Q4", "label": "Quality inspection", "qty": qi,
            "uom": uom, "color": "var(--sage, #289BA2)",
        })
    if restricted > 0:
        qty_by_reason.append({
            "code": "R1", "label": "Restricted", "qty": restricted,
            "uom": uom, "color": "var(--sunrise, #F9C20A)",
        })

    active: list[dict] = []
    resolved: list[dict] = []
    seen_lots: set[str] = set()
    for row in rows:
        lot_id = row.get("inspection_lot_id")
        if not lot_id:
            continue
        lot_id_str = str(lot_id)
        if lot_id_str in seen_lots:
            continue
        seen_lots.add(lot_id_str)
        usage_decision = row.get("usage_decision")
        end_date = row.get("inspection_end_date")
        created_date = row.get("created_date")
        inspector = str(row.get("created_by") or "—")
        short_text = str(row.get("inspection_short_text") or row.get("inspection_type") or "Inspection")

        entry = {
            "id": lot_id_str,
            "reason": f"QC \xb7 {short_text}",
            "reasonCode": "QC",
            "qty": qi if qi > 0 else 0.0,
            "uom": uom,
            "opened": str(created_date or "").replace(" ", "T").split("T")[0] if created_date else "",
            "owner": inspector,
            "detail": short_text,
        }

        if usage_decision:
            entry["status"] = "released" if "accept" in str(usage_decision).lower() else "rejected"
            entry["resolved"] = str(end_date or "").replace(" ", "T").split("T")[0] if end_date else ""
            entry["resolution"] = str(usage_decision)
            resolved.append(entry)
        else:
            entry["status"] = "pending"
            active.append(entry)

    return {
        "activeHolds": active,
        "resolvedHolds": resolved,
        "qtyByReason": qty_by_reason,
    }
