"""Recall readiness specs + mappers.

Covers:
  - get_recall_readiness_spec / map_recall_readiness_rows (Trace App — getRecallReadiness)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2RecallReadinessRequest

# ---------------------------------------------------------------------------
# Trace App slice — getRecallReadiness  (gold_batch_delivery_v aggregations)
# ---------------------------------------------------------------------------

def get_recall_readiness_spec(request: Trace2RecallReadinessRequest) -> QuerySpec:
    """Return a QuerySpec for the Trace App Recall & Exposure tab.

    Source: gold_batch_delivery_v (17 columns verified live 2026-05-20).
    No plant filter — recall coverage must surface all plants a batch reached.
    Returns one row per delivery so the mapper can produce both the per-country
    aggregate and the delivery-level table that the panel renders.

    Status semantics in this slice:
      - All rows are reported with status='delivered' because gold_batch_delivery_v
        does not yet expose an in-transit / blocked / recalled flag. When a
        delivery-status column lands, swap the mapper to honour it.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT
      DELIVERY         AS delivery,
      CUSTOMER_ID      AS customer_id,
      CUSTOMER_NAME    AS customer_name,
      COUNTRY_ID       AS country_id,
      COUNTRY_NAME     AS country_name,
      ABS_QUANTITY     AS abs_quantity,
      UOM              AS uom,
      POSTING_DATE     AS posting_date,
      SALES_ORDER_ID   AS sales_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND DELIVERY IS NOT NULL
      AND CUSTOMER_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_recall_readiness",
        module="trace2",
        endpoint="/api/trace2/recall-readiness",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_delivery_v",
        tags=["trace2", "trace-app", "recall-readiness"],
    )


def map_recall_readiness_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_delivery_v rows to RecallReadinessSchema.

    Zero rows → returns None. Caller returns HTTP 404 with "do not interpret
    as zero exposure" message.

    Country aggregation is derived from country_id + country_name pairs.
    Percentages are computed against total shipped quantity.
    """
    if not rows:
        return None

    deliveries: list[dict] = []
    customers: set[str] = set()
    country_totals: dict[str, dict] = {}
    total_qty = 0.0
    uom: Optional[str] = None

    for row in rows:
        did = str(row.get("delivery") or "")
        cid = str(row.get("customer_id") or "")
        cname = str(row.get("customer_name") or "")
        country_id = str(row.get("country_id") or "")
        country_name = str(row.get("country_name") or country_id)
        qty = float(row.get("abs_quantity") or 0)
        posting_date = row.get("posting_date")
        sales_order = row.get("sales_order_id")

        customers.add(cid)
        total_qty += qty

        if uom is None and row.get("uom") is not None:
            uom = str(row["uom"])

        if country_id:
            agg = country_totals.setdefault(country_id, {"code": country_id, "name": country_name, "qty": 0.0})
            agg["qty"] = float(agg["qty"]) + qty

        deliveries.append({
            "id": did,
            "customer": cname or cid,
            "country": country_id,
            "date": str(posting_date) if posting_date is not None else "",
            "qty": qty,
            # gold_batch_delivery_v has no delivery-status column. We emit
            # 'delivery-evidence' (source-truthful default) and tag the
            # provenance so the UI cannot misread it as governed delivery
            # status. When a status column lands, derive the real value.
            "status": "delivery-evidence",
            "statusSource": "delivery-record-present",
            "doc": str(sales_order) if sales_order is not None else "",
        })

    countries = [
        {
            "code": c["code"],
            "name": c["name"],
            "qty": float(c["qty"]),
            "pct": float(c["qty"]) / total_qty if total_qty > 0 else 0.0,
        }
        for c in sorted(country_totals.values(), key=lambda x: -float(x["qty"]))
    ]

    result: dict = {
        "totals": {
            "customers": len(customers),
            "countries": len(country_totals),
            "deliveries": len(deliveries),
            "shipped": total_qty,
            "uom": uom or "",
        },
        "countries": countries,
        "deliveries": deliveries,
        # Recall recommendation is a governance decision and is not yet
        # computed server-side. The only safe value is `not-evaluated`.
        # The UI MUST NOT interpret this as "no recall needed".
        "recommendationStatus": "not-evaluated",
    }
    return result
