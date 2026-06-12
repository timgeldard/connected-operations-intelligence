"""Batch header summary and batch search specs + mappers.

Covers:
  - get_batch_header_summary_spec / map_batch_header_rows (Slice 1)
  - get_batch_search_spec / map_batch_search_rows (Slice 1a — Trace Consumer)
"""
from __future__ import annotations

from typing import Optional

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import (
    resolve_domain_object,
    resolve_governed_trace2_object,
)
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2BatchHeaderRequest, Trace2BatchSearchRequest
from ._utils import (
    _date_to_utc,
    _derive_quality_status,
    _derive_release_status,
    _derive_stock_status,
    _map_batch_status,
    _string_or_empty,
    _to_search_like_pattern,
)

# ---------------------------------------------------------------------------
# Slice 1 — getBatchHeaderSummary
# ---------------------------------------------------------------------------

def get_batch_header_summary_spec(request: Trace2BatchHeaderRequest) -> QuerySpec:
    """Return a QuerySpec for getBatchHeaderSummary.

    Sources: gold_batch_stock_v + gold_batch_summary_v + gold_material + gold_plant
    under TRACE_CATALOG / TRACE_SCHEMA (default: "gold").
    Contract: BatchHeaderSummarySchema (packages/data-contracts)
    Cache: PER_USER_60S — batch release/block status can change during a shift.
    Parallel validation: possible against browser-verified POST /api/trace2/batch-header.

    Multi-plant note: gold_batch_stock_v returns one row per plant per batch. When
    plant_id is provided the SQL filters to that plant, removing cross-plant ambiguity.
    When plant_id is absent the query returns all plants ordered by PLANT_ID; the mapper
    takes the first row. UAT inputs normally include plant_id so multi-plant ambiguity
    is resolved in the standard flow.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl_stock = resolve_domain_object("trace2", "gold_batch_stock_v")
    tbl_summary = resolve_domain_object("trace2", "gold_batch_summary_v")
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")
    tbl_batch_material = resolve_domain_object("trace2", "gold_batch_material")

    sql = f"""
    SELECT
        s.MATERIAL_ID                AS material_id,             -- confirmed: gold_batch_stock_v
        s.BATCH_ID                   AS batch_id,                -- confirmed: gold_batch_stock_v
        s.unrestricted,                                          -- confirmed: gold_batch_stock_v (V1 inspection)
        s.blocked,                                              -- confirmed: gold_batch_stock_v
        s.quality_inspection,                                   -- confirmed: gold_batch_stock_v
        s.restricted,                                           -- confirmed: gold_batch_stock_v
        s.transit,                                              -- confirmed: gold_batch_stock_v
        s.total_stock,                                          -- confirmed: gold_batch_stock_v
        s.PLANT_ID                   AS plant_id,               -- verified: 2026-05-19 connected_plant_uat (not in gold_batch_summary_v)
        m.MATERIAL_NAME              AS material_name,          -- verified: 2026-05-19 connected_plant_uat
        m.BASE_UNIT_OF_MEASURE       AS uom,                    -- verified: 2026-05-19 connected_plant_uat (not in gold_batch_summary_v)
        p.PLANT_NAME                 AS plant_name,             -- confirmed: gold_plant (V1 inspection)
        b.MANUFACTURE_DATE           AS manufacture_date,       -- verified: 2026-05-19 connected_plant_uat
        b.SHELF_LIFE_EXPIRATION_DATE AS expiry_date,            -- verified: 2026-05-19 connected_plant_uat
        bm.SUPPLIER_BATCH_ID         AS vendor_batch_id         -- verified: 2026-05-27 connected_plant_uat (gold_batch_material)
    FROM {tbl_stock} s
    JOIN {tbl_summary} b                                        -- verified join key: MATERIAL_ID + BATCH_ID
        ON s.MATERIAL_ID = b.MATERIAL_ID AND s.BATCH_ID = b.BATCH_ID
    JOIN {tbl_material} m                                       -- confirmed join key
        ON s.MATERIAL_ID = m.MATERIAL_ID AND m.LANGUAGE_ID = 'E'  -- verified: 2026-05-19 connected_plant_uat
    JOIN {tbl_plant} p                                          -- confirmed join key
        ON s.PLANT_ID = p.PLANT_ID                              -- verified: 2026-05-19 connected_plant_uat
    LEFT JOIN {tbl_batch_material} bm                           -- LEFT JOIN: not all batches have a supplier batch
        ON s.MATERIAL_ID = bm.MATERIAL_ID AND s.BATCH_ID = bm.BATCH_ID
    WHERE s.MATERIAL_ID = :material_id
      AND s.BATCH_ID = :batch_id
      AND (:plant_id = '' OR s.PLANT_ID = :plant_id)
    ORDER BY s.PLANT_ID
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.get_batch_header_summary",
        module="trace2",
        endpoint="/api/trace2/batch-header",
        sql=sql,
        params={"material_id": request.material_id, "batch_id": request.batch_id, "plant_id": request.plant_id},
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_summary_v",
        tags=["trace2", "batch-header", "summary"],
    )


def map_batch_header_rows(rows: list[dict]) -> Optional[dict]:
    """Map Databricks rows to BatchHeaderSummarySchema shape.

    Returns None if no rows (caller should return HTTP 404).
    """
    if not rows:
        return None
    row = rows[0]

    result: dict = {
        "materialId": row["material_id"],
        "materialDescription": row.get("material_name") or "",
        "batchId": row["batch_id"],
        "plantId": row.get("plant_id") or "",
        "plantName": row.get("plant_name") or "",
        "batchStatus": _map_batch_status(row.get("batch_status")),
        "stockStatus": _derive_stock_status(row),
        "qualityStatus": _derive_quality_status(row),
        "releaseStatus": _derive_release_status(row.get("batch_status")),
    }

    if row.get("total_stock") is not None:
        result["quantity"] = float(row["total_stock"])
    if row.get("unrestricted") is not None:
        result["unrestricted"] = float(row["unrestricted"])
    if row.get("blocked") is not None:
        result["blocked"] = float(row["blocked"])
    if row.get("quality_inspection") is not None:
        result["qualityInspection"] = float(row["quality_inspection"])
    if row.get("restricted") is not None:
        result["restricted"] = float(row["restricted"])
    if row.get("transit") is not None:
        result["transit"] = float(row["transit"])
    if row.get("uom"):
        result["uom"] = row["uom"]
    if row.get("manufacture_date"):
        result["manufactureDate"] = _date_to_utc(row["manufacture_date"])
    if row.get("expiry_date"):
        result["expiryDate"] = _date_to_utc(row["expiry_date"])
    if row.get("vendor_batch_id"):
        result["vendorBatchId"] = str(row["vendor_batch_id"])
    if row.get("process_order_id"):
        result["processOrderId"] = row["process_order_id"]

    return result


# ---------------------------------------------------------------------------
# Slice 1a — Trace Consumer batch search
# ---------------------------------------------------------------------------

def get_batch_search_spec(request: Trace2BatchSearchRequest) -> QuerySpec:
    """Return a QuerySpec for Trace Consumer unified batch search.

    Primary source: gold_trace_anchor_secured (RLS-enforced anchor MV, one row per
    MATERIAL_ID/BATCH_ID/PLANT_ID for ACTIVE plants only).  The app passes user
    identity through so the secured view enforces per-user CSM RLS automatically.

    gold_material is JOIN-ed for material descriptions (description match type).
    gold_plant is JOIN-ed for PLANT_NAME display (the anchor carries plant_code but
    not a human-readable plant name).

    Process-order match: gold_trace_anchor_secured carries no PROCESS_ORDER_ID.
    A scoped lookup against gold_batch_lineage resolves PROCESS_ORDER_ID → batch
    endpoints (via CHILD_MATERIAL_ID/CHILD_BATCH_ID/CHILD_PLANT_ID) and the result
    is LEFT JOINed back to the anchor to enforce ACTIVE-plant RLS.  This keeps the
    match type alive as a single readable query.  Only rows that survive the anchor
    join (i.e. the batch is in an ACTIVE plant the user can see) are returned.

    Ranking: last_posting_date DESC from the anchor MV (replaces production-history
    recency ranking).  No stock quantity is carried by the anchor; quantity and uom
    are returned as null (both are optional in BatchSearchItem).

    Trace-graph traversal continues to read gold_batch_lineage unchanged.

    Schema resolution:
      • gold_trace_anchor_secured — TRACE_GOVERNED_SCHEMA (default: "gold_io_reporting").
          This is the governed RLS-enforced MV that the app.yaml TRACE_SCHEMA: gold setting
          would resolve incorrectly (gold schema has no gold_trace_anchor_secured object).
      • gold_batch_lineage (po_match CTE) — TRACE_GOVERNED_SCHEMA (same governed schema).
          Anchor search and po_match must use the same edge universe as trace-graph.
      • gold_material, gold_plant — legacy TRACE_SCHEMA ("gold").  No governed equivalents
          exist for these enrichment tables yet; they stay on the legacy schema.
    """
    # Governed objects: live in TRACE_GOVERNED_SCHEMA (gold_io_reporting), not TRACE_SCHEMA.
    tbl_anchor = resolve_governed_trace2_object("gold_trace_anchor_secured")
    # gold_batch_lineage in po_match must use the same edge universe as trace-graph traversal.
    tbl_lineage = resolve_governed_trace2_object("gold_batch_lineage")
    # Legacy enrichment joins — no governed equivalents exist yet.
    tbl_material = resolve_domain_object("trace2", "gold_material")
    tbl_plant = resolve_domain_object("trace2", "gold_plant")

    sql = f"""
    WITH `po_match` AS (
        -- Scoped process-order lookup: find child batch endpoints that were produced
        -- under the searched process order, then join to the anchor to enforce RLS.
        -- Only batches visible to the requesting user (ACTIVE plant) survive.
        SELECT DISTINCT
            a.MATERIAL_ID,
            a.BATCH_ID,
            a.PLANT_ID,
            l.PROCESS_ORDER_ID
        FROM {tbl_lineage} l
        JOIN {tbl_anchor} a
            ON l.CHILD_MATERIAL_ID = a.MATERIAL_ID
           AND l.CHILD_BATCH_ID    = a.BATCH_ID
           AND l.CHILD_PLANT_ID    = a.PLANT_ID
        WHERE l.PROCESS_ORDER_ID IS NOT NULL
          AND UPPER(l.PROCESS_ORDER_ID) LIKE :search_pattern
    )
    SELECT
        a.MATERIAL_ID          AS material_id,
        a.BATCH_ID             AS batch_id,
        a.PLANT_ID             AS plant_id,
        m.MATERIAL_NAME        AS material_name,
        p.PLANT_NAME           AS plant_name,
        po.PROCESS_ORDER_ID    AS process_order_id,
        a.last_posting_date    AS latest_posting_date,
        CASE
            WHEN (:material_id <> '' AND UPPER(a.MATERIAL_ID) = UPPER(:material_id))
              OR UPPER(a.MATERIAL_ID) LIKE :search_pattern THEN 1
            ELSE 0
        END AS material_match,
        CASE WHEN UPPER(m.MATERIAL_NAME) LIKE :search_pattern THEN 1 ELSE 0 END AS description_match,
        CASE
            WHEN (:batch_id <> '' AND UPPER(a.BATCH_ID) = UPPER(:batch_id))
              OR UPPER(a.BATCH_ID) LIKE :search_pattern THEN 1
            ELSE 0
        END AS batch_match,
        CASE
            WHEN po.PROCESS_ORDER_ID IS NOT NULL THEN 1
            ELSE 0
        END AS process_order_match
    FROM {tbl_anchor} a
    JOIN {tbl_material} m
        ON a.MATERIAL_ID = m.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
    JOIN {tbl_plant} p
        ON a.PLANT_ID = p.PLANT_ID
    LEFT JOIN `po_match` po
        ON a.MATERIAL_ID = po.MATERIAL_ID
       AND a.BATCH_ID    = po.BATCH_ID
       AND a.PLANT_ID    = po.PLANT_ID
    WHERE a.BATCH_ID IS NOT NULL
      AND (
        (
          :material_id <> ''
          AND :batch_id <> ''
          AND UPPER(a.MATERIAL_ID) = UPPER(:material_id)
          AND UPPER(a.BATCH_ID) = UPPER(:batch_id)
        )
        OR (
          (:material_id = '' OR :batch_id = '')
          AND (
            UPPER(a.MATERIAL_ID) LIKE :search_pattern
            OR UPPER(m.MATERIAL_NAME) LIKE :search_pattern
            OR UPPER(a.BATCH_ID) LIKE :search_pattern
            OR po.PROCESS_ORDER_ID IS NOT NULL
          )
        )
      )
    ORDER BY
        a.last_posting_date DESC NULLS LAST,
        a.BATCH_ID,
        a.MATERIAL_ID,
        a.PLANT_ID
    LIMIT :max_rows
    """

    return QuerySpec(
        name="trace2.batch_search",
        module="trace2",
        endpoint="/api/trace2/batch-search",
        sql=sql,
        params={
            "search_pattern": _to_search_like_pattern(request.query.strip().upper()),
            "material_id": request.material_id,
            "batch_id": request.batch_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="mv:gold_trace_anchor_secured+material+plant+lineage",
        tags=["trace2", "trace-consumer", "batch-search"],
    )


def map_batch_search_rows(rows: list[dict], query: str, max_rows: int) -> dict:
    """Map Trace Consumer search rows to the frontend search contract."""
    limited_rows = rows[:max_rows]
    items: list[dict] = []

    for row in limited_rows:
        match_types: list[str] = []
        if row.get("material_match"):
            match_types.append("material-id")
        if row.get("description_match"):
            match_types.append("description")
        if row.get("batch_match"):
            match_types.append("batch-id")
        if row.get("process_order_match"):
            match_types.append("process-order-id")

        quantity = row.get("batch_qty")
        if quantity is None:
            quantity = row.get("total_stock")

        item: dict = {
            "materialId": _string_or_empty(row.get("material_id")),
            "materialDescription": _string_or_empty(row.get("material_name")),
            "batchId": _string_or_empty(row.get("batch_id")),
            "plantId": _string_or_empty(row.get("plant_id")),
            "plantName": _string_or_empty(
                row.get("plant_name") if row.get("plant_name") is not None else row.get("plant_id")
            ),
            "matchTypes": match_types,
        }
        if row.get("process_order_id") is not None:
            item["processOrderId"] = str(row["process_order_id"])
        if row.get("latest_posting_date") is not None:
            item["latestPostingDate"] = str(row["latest_posting_date"])
        if quantity is not None:
            item["quantity"] = float(quantity)
        if row.get("uom") is not None:
            item["uom"] = str(row["uom"])
        items.append(item)

    return {
        "query": query,
        "total": len(items),
        "truncated": len(rows) > max_rows,
        "wildcardApplied": "*" in query or "%" in query,
        "items": items,
    }
