"""Customer exposure and delivery specs + mappers.

Covers:
  - get_customer_exposure_spec / map_customer_exposure_rows (Slice 4)
  - get_customer_delivery_spec / map_customer_delivery_rows (Slice 5)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2CustomerDeliveryRequest, Trace2CustomerExposureRequest

# ---------------------------------------------------------------------------
# Slice 4 — getCustomerExposureSummary (lineage-only first slice)
# ---------------------------------------------------------------------------

def get_customer_exposure_spec(request: Trace2CustomerExposureRequest) -> QuerySpec:
    """Return a QuerySpec for getCustomerExposureSummary — lineage-only first slice.

    Source: gold_batch_lineage downstream WITH RECURSIVE, filtering LINK_TYPE = 'DELIVERY'
    edges where CUSTOMER_ID IS NOT NULL.

    Source confidence (2026-05-20):
      - gold_batch_lineage columns confirmed live 2026-05-19.
      - CUSTOMER_ID column confirmed present in all 18 columns.
      - LINK_TYPE = 'DELIVERY' value: Medium confidence — in _LINK_TYPE_MAP from V1 inspection
        but live LINK_TYPE values have not been validated against a Databricks session (P0-3).
      - CUSTOMER_ID population on DELIVERY edges: Medium confidence — column exists but
        sparsity on DELIVERY-type edges is unknown until UAT validation.
      - Countries: NOT available from gold_batch_lineage; deferred to gold_batch_delivery_v.
      - blockedDeliveries: NOT available from gold_batch_lineage; always 0 in this slice.

    Zero-rows semantics:
      The mapper returns None for zero rows. The route returns HTTP 404 with message
      "No customer delivery records returned from current source — do not interpret as
      zero exposure until source coverage is validated." The frontend adapter/panel must
      display this as unavailable, NOT as zero exposure.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_lineage")

    _null_guard = (
        "PARENT_MATERIAL_ID IS NOT NULL AND PARENT_BATCH_ID IS NOT NULL"
        " AND CHILD_MATERIAL_ID IS NOT NULL AND CHILD_BATCH_ID IS NOT NULL"
    )

    sql = f"""
    WITH RECURSIVE
    ds AS (
      SELECT
        1 AS hop_depth,
        PARENT_MATERIAL_ID, PARENT_BATCH_ID, PARENT_PLANT_ID,
        CHILD_MATERIAL_ID, CHILD_BATCH_ID, CHILD_PLANT_ID,
        LINK_TYPE, CUSTOMER_ID, DELIVERY_ID, SALES_ORDER_ID,
        QUANTITY, BASE_UNIT_OF_MEASURE, POSTING_DATE,
        CONCAT('|', :material_id, ':', :batch_id, '|',
               CHILD_MATERIAL_ID, ':', CHILD_BATCH_ID, '|') AS path
      FROM {tbl}
      WHERE PARENT_MATERIAL_ID = :material_id AND PARENT_BATCH_ID = :batch_id
        AND (:plant_id = '' OR PARENT_PLANT_ID = :plant_id)
        AND {_null_guard}
      UNION ALL
      SELECT
        t.hop_depth + 1,
        e.PARENT_MATERIAL_ID, e.PARENT_BATCH_ID, e.PARENT_PLANT_ID,
        e.CHILD_MATERIAL_ID, e.CHILD_BATCH_ID, e.CHILD_PLANT_ID,
        e.LINK_TYPE, e.CUSTOMER_ID, e.DELIVERY_ID, e.SALES_ORDER_ID,
        e.QUANTITY, e.BASE_UNIT_OF_MEASURE, e.POSTING_DATE,
        CONCAT(t.path, e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, '|')
      FROM {tbl} e
      JOIN `ds` t
        ON e.PARENT_MATERIAL_ID = t.CHILD_MATERIAL_ID
        AND e.PARENT_BATCH_ID = t.CHILD_BATCH_ID
        AND e.PARENT_PLANT_ID <=> t.CHILD_PLANT_ID
      WHERE t.hop_depth < :max_depth
        AND e.CHILD_MATERIAL_ID IS NOT NULL AND e.CHILD_BATCH_ID IS NOT NULL
        AND INSTR(t.path, CONCAT('|', e.CHILD_MATERIAL_ID, ':', e.CHILD_BATCH_ID, '|')) = 0
    )
    SELECT
      CUSTOMER_ID    AS customer_id,      -- confirmed column: gold_batch_lineage (all 18 cols, 2026-05-19)
      DELIVERY_ID    AS delivery_id,      -- confirmed column: gold_batch_lineage
      SALES_ORDER_ID AS sales_order_id,   -- confirmed column: gold_batch_lineage
      QUANTITY       AS quantity,         -- confirmed column: gold_batch_lineage
      BASE_UNIT_OF_MEASURE AS base_unit_of_measure,  -- confirmed column: gold_batch_lineage
      POSTING_DATE   AS posting_date,     -- confirmed column: gold_batch_lineage
      hop_depth                           -- from recursive CTE above
    FROM `ds`
    WHERE LINK_TYPE = 'DELIVERY'          -- Medium confidence: from _LINK_TYPE_MAP (V1 inspection); P0-3 live validation pending
      AND CUSTOMER_ID IS NOT NULL         -- exclude edges without customer attribution
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_customer_exposure",
        module="trace2",
        endpoint="/api/trace2/customer-exposure",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "plant_id": request.plant_id,
            "max_depth": request.max_depth,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_lineage",
        tags=["trace2", "customer-exposure", "lineage"],
    )


def map_customer_exposure_rows(rows: list[dict]) -> Optional[dict]:
    """Map Databricks customer exposure rows to CustomerExposureSummarySchema shape.

    Zero rows → returns None. Caller must return HTTP 404 with "do not interpret as
    zero exposure" message. This is NOT the same as zero affected customers.

    Severity: 'medium' (preliminary — business severity rules not yet defined).
    Countries: [] — gold_batch_lineage has no country column; deferred to gold_batch_delivery_v.
    blockedDeliveries: 0 — blocked status requires gold_batch_delivery_v; deferred.
    recallRecommended: False — recall rules not yet defined; deferred.

    Leading zeros in customer/delivery IDs are preserved (str, not numeric).
    """
    if not rows:
        return None

    customers: set[str] = set()
    deliveries: set[str] = set()
    total_qty = 0.0
    min_depth: Optional[int] = None

    for row in rows:
        cid = row.get("customer_id")
        if cid is not None:
            customers.add(str(cid))
        did = row.get("delivery_id")
        if did is not None:
            deliveries.add(str(did))
        qty = row.get("quantity")
        if qty is not None:
            total_qty += float(qty)
        depth = row.get("hop_depth")
        if depth is not None:
            d = int(depth)
            if min_depth is None or d < min_depth:
                min_depth = d

    result: dict = {
        "affectedCustomers": len(customers),
        "affectedDeliveries": len(deliveries),
        "shippedQuantity": total_qty,
        "countries": [],        # deferred — gold_batch_lineage has no country column
        "highestSeverity": "medium",  # preliminary — severity rules not yet defined
        "blockedDeliveries": 0,       # deferred — requires gold_batch_delivery_v
        # null = no governed recall-rule source available. Contract was relaxed
        # to z.boolean().nullable() so we can stop emitting `false` (which would
        # read as "recall not required"). See PR brief Part A.
        "recallRecommended": None,
        "deliveryEvidenceSource": "lineage",
    }
    if min_depth is not None:
        result["maxExposureDepth"] = min_depth
    return result


# ---------------------------------------------------------------------------
# Slice 5 — getCustomerDeliveryRecords (gold_batch_delivery_v, V1-parity)
# ---------------------------------------------------------------------------

def get_customer_delivery_spec(request: Trace2CustomerDeliveryRequest) -> QuerySpec:
    """Return a QuerySpec for getCustomerDeliveryRecords — V1-parity delivery view slice.

    Source: gold_batch_delivery_v keyed on MATERIAL_ID + BATCH_ID.
    No plant filter — all delivery plants must be included for recall coverage.
    See customer-delivery-v1-parity-source-mapping.md for source decision.

    Column confidence (verified live 2026-05-20, DESCRIBE TABLE connected_plant_uat.gold.gold_batch_delivery_v):
      17 columns confirmed: MATERIAL_ID, BATCH_ID, PLANT_ID, CUSTOMER_ID, CUSTOMER_NAME,
      STREET, CITY, POSTCODE, COUNTRY_ID, COUNTRY_NAME, DELIVERY, SALES_ORDER_ID,
      QUANTITY (signed), ABS_QUANTITY, UOM, POSTING_DATE, MOVEMENT_TYPE.
      WHERE keys MATERIAL_ID + BATCH_ID confirmed. UOM confirmed as string column.

    Zero-rows semantics:
      The mapper returns None for zero rows. The route returns HTTP 404 with message
      "No customer delivery records returned — do not interpret as zero exposure."

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_delivery_v")

    sql = f"""
    SELECT
      DELIVERY        AS delivery,
      CUSTOMER_ID     AS customer_id,
      CUSTOMER_NAME   AS customer_name,
      COUNTRY_ID      AS country_id,
      COUNTRY_NAME    AS country_name,
      CITY            AS city,
      ABS_QUANTITY    AS abs_quantity,
      UOM             AS uom,
      POSTING_DATE    AS posting_date
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID   = :batch_id
      AND DELIVERY IS NOT NULL
      AND CUSTOMER_ID IS NOT NULL
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_customer_deliveries",
        module="trace2",
        endpoint="/api/trace2/customer-deliveries",
        sql=sql,
        params={
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_delivery_v",
        tags=["trace2", "customer-deliveries", "delivery-view"],
    )


def map_customer_delivery_rows(rows: list[dict]) -> Optional[dict]:
    """Map gold_batch_delivery_v rows to CustomerExposureSummarySchema shape.

    Zero rows → returns None. Caller must return HTTP 404 with "do not interpret as
    zero exposure" message.

    shippedQuantity: sum of abs_quantity (no de-netting of 602 reversals — see
      customer-delivery-movement-type-validation.md §Reversal Handling for escalation criteria).
    countries: distinct non-null COUNTRY_ID values as strings.
    uom: first non-null UOM value (consistent across a material/batch; absent if all null).
    blockedDeliveries: 0 — no confirmed blocked-status column in gold_batch_delivery_v.
    highestSeverity: 'medium' — preliminary; business rules not yet defined for V2.
    maxExposureDepth: not set — gold_batch_delivery_v is direct delivery records, not hop-based.
    deliveryEvidenceSource: 'inventory-movements' — signals V1-parity delivery view source.
    """
    if not rows:
        return None

    deliveries: set[str] = set()
    customers: set[str] = set()
    countries: set[str] = set()
    total_qty = 0.0
    uom: Optional[str] = None

    for row in rows:
        did = row.get("delivery")
        if did is not None:
            deliveries.add(str(did))
        cid = row.get("customer_id")
        if cid is not None:
            customers.add(str(cid))
        ctry = row.get("country_id")
        if ctry is not None:
            countries.add(str(ctry))
        qty = row.get("abs_quantity")
        if qty is not None:
            total_qty += float(qty)
        if uom is None and row.get("uom") is not None:
            uom = str(row["uom"])

    result: dict = {
        "affectedCustomers": len(customers),
        "affectedDeliveries": len(deliveries),
        "shippedQuantity": total_qty,
        "countries": sorted(countries),
        "highestSeverity": "medium",    # preliminary — severity rules not yet defined
        "blockedDeliveries": 0,         # deferred — no confirmed blocked-status column
        # null = no governed recall-rule source available. See PR brief Part A.
        "recallRecommended": None,
        "deliveryEvidenceSource": "inventory-movements",
    }
    if uom is not None:
        result["uom"] = uom
    return result
