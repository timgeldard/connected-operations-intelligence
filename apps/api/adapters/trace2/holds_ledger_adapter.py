"""Holds ledger spec + mapper.

Covers:
  - get_holds_ledger_spec / map_holds_ledger_rows (Trace App — getHoldsLedger)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2HoldsLedgerRequest

# ---------------------------------------------------------------------------
# Trace App slice — getHoldsLedger  (gold_batch_stock_v + gold_batch_quality_lot_v)
# ---------------------------------------------------------------------------

def get_holds_ledger_spec(request: Trace2HoldsLedgerRequest) -> QuerySpec:
    """Holds ledger derived from current stock buckets + quality lot decisions.

    No dedicated `gold_holds_ledger` view yet. This slice synthesises:
      - qtyByReason from gold_batch_stock_v.{blocked, restricted, quality_inspection}
      - active / resolved holds from gold_batch_quality_lot_v entries with no
        usage decision (active) vs. those with a decision (resolved).

    Single-row join strategy — stock columns come from one stock_v row;
    identity comes from either base or stock depending on which source is
    populated. Quality lots are returned in a subselect.
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_ql = resolve_domain_object("trace2", "gold_batch_quality_lot_v")

    sql = f"""
    SELECT
      s.unrestricted,
      s.blocked,
      s.quality_inspection,
      s.restricted,
      s.transit,
      ql.INSPECTION_LOT_ID  AS inspection_lot_id,
      ql.INSPECTION_TYPE    AS inspection_type,
      ql.INSPECTION_SHORT_TEXT AS inspection_short_text,
      ql.CREATED_DATE       AS created_date,
      ql.INSPECTION_END_DATE AS inspection_end_date,
      ql.CREATED_BY         AS created_by,
      ql.USAGE_DECISION_LONG_TEXT AS usage_decision
    FROM {tbl_stock} s
    LEFT JOIN {tbl_ql} ql
      ON s.MATERIAL_ID = ql.MATERIAL_ID AND s.BATCH_ID = ql.BATCH_ID
    WHERE s.MATERIAL_ID = :material_id
      AND s.BATCH_ID   = :batch_id
      AND (:plant_id = '' OR s.PLANT_ID = :plant_id)
    ORDER BY ql.CREATED_DATE DESC
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
        source_badge="view:gold_batch_stock_v+quality_lot_v",
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
    # gold_batch_stock_v does not expose a UOM column for this view. The
    # contract has `uom: string | null` — do NOT default to "KG". Future
    # revision: join to gold_material.BASE_UNIT_OF_MEASURE.
    uom: Optional[str] = None

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
            "reason": f"QC · {short_text}",
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
