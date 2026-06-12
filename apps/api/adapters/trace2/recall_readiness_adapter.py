"""Recall readiness specs + mappers.

Covers:
  - get_recall_readiness_spec / map_recall_readiness_rows (Trace App — getRecallReadiness)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_governed_trace2_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2RecallReadinessRequest

# ---------------------------------------------------------------------------
# Trace App slice — getRecallReadiness (event ledger DELIVERY rows)
# ---------------------------------------------------------------------------

def get_recall_readiness_spec(request: Trace2RecallReadinessRequest) -> QuerySpec:
    """Return a QuerySpec for the Trace App Recall & Exposure tab.

    Source: gold_batch_event_ledger DELIVERY OUT rows (TRACE_GOVERNED_SCHEMA,
    default: "gold_io_reporting").  No plant filter — recall coverage must surface
    all plants a batch reached.

    Column mapping vs legacy gold_batch_delivery_v:
      DELIVERY_ID    → delivery (present; the delivery document number)
      CUSTOMER_ID    → customer_id (NULL in DELIVERY leg of gold_batch_lineage —
                       LIKP.KUNAG is not joined at the MV level; this is a known gap.
                       customer_id emitted as NULL.)
      SALES_ORDER_ID → sales_order_id (present)
      QUANTITY       → abs_quantity (QUANTITY is already absolute in the ledger)
      BASE_UNIT_OF_MEASURE → uom (present)
      POSTING_DATE   → posting_date (present)

    customer_name, country_id, country_name: ALL NULL in the governed source.
      - CUSTOMER_ID is NULL at the DELIVERY leg (trade-off noted in trace_gold.py
        docstring: joining outbound_delivery for KUNAG on the hot path is deferred).
      - silver.outbound_delivery does not carry customer_name (that lives in
        silver.customer / KNA1 which is not yet joined in the gold layer).
      - country_id / country_name: not available without a customer join.

    These optional fields are emitted as NULL, source-truthfully.  The mapper
    derives country aggregation only when country_id is non-null; for governed
    rows the countries list will be empty.

    Status semantics: all rows emitted with status='delivery-evidence' (same
    as legacy — no in-transit / blocked / recalled flag available in the governed
    source either).

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_governed_trace2_object("gold_batch_event_ledger")

    sql = f"""
    SELECT
      DELIVERY_ID          AS delivery,
      CUSTOMER_ID          AS customer_id,
      CAST(NULL AS STRING) AS customer_name,
      CAST(NULL AS STRING) AS country_id,
      CAST(NULL AS STRING) AS country_name,
      QUANTITY             AS abs_quantity,
      BASE_UNIT_OF_MEASURE AS uom,
      POSTING_DATE         AS posting_date,
      SALES_ORDER_ID       AS sales_order_id
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND LINK_TYPE  = 'DELIVERY'
      AND direction  = 'OUT'
      AND DELIVERY_ID IS NOT NULL
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
        source_badge="mv:gold_batch_event_ledger",
        tags=["trace2", "trace-app", "recall-readiness"],
    )


def map_recall_readiness_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_event_ledger DELIVERY rows to RecallReadinessSchema.

    Zero rows → returns None. Caller returns HTTP 404 with "do not interpret
    as zero exposure" message.

    Country aggregation is derived from country_id + country_name pairs.
    For governed delivery rows both will be NULL (CUSTOMER_ID is NULL in the
    DELIVERY leg of gold_batch_lineage — customer enrichment is deferred).
    The countries list will therefore be empty in the governed response.
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

        if cid:
            customers.add(cid)
        total_qty += qty

        if uom is None and row.get("uom") is not None:
            uom = str(row["uom"])

        if country_id:
            agg = country_totals.setdefault(country_id, {"code": country_id, "name": country_name, "qty": 0.0})
            agg["qty"] = float(agg["qty"]) + qty

        deliveries.append({
            "id": did,
            "customer": cname or cid or "",
            "country": country_id,
            "date": str(posting_date) if posting_date is not None else "",
            "qty": qty,
            # gold_batch_event_ledger DELIVERY rows have no delivery-status column.
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
        # computed server-side.
        "recommendationStatus": "not-evaluated",
    }
    return result
