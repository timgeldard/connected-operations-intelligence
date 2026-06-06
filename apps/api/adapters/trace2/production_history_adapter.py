"""Production history specs + mappers.

Covers:
  - get_production_history_spec / map_production_history_rows (Slice 7)
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_spec import QuerySpec

from ._types import Trace2ProductionHistoryRequest
from ._utils import _map_quality_status

# ---------------------------------------------------------------------------
# Slice 7 — getProductionHistory (gold_batch_production_history_v)
# ---------------------------------------------------------------------------

def get_production_history_spec(request: Trace2ProductionHistoryRequest) -> QuerySpec:
    """Return a QuerySpec for getProductionHistory — V1-parity recent batches for a material.

    Source: gold_batch_production_history_v (8 columns verified live 2026-05-20).
    Filter: MATERIAL_ID only (no plant filter — V1 showed recent batches across all
    plants for the material to support "isolated vs systemic" assessment).

    Order: most-recent POSTING_DATE first. Default limit: 24 (V1 parity).

    quality_status values in live data: 'Pass' / 'Fail' (no NULLs observed). The
    mapper maps 'Pass' → 'pass', 'Fail' → 'fail', anything else → 'unknown'.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    tbl = resolve_domain_object("trace2", "gold_batch_production_history_v")
    sql = f"""
    SELECT
        PROCESS_ORDER_ID  AS process_order_id,
        BATCH_ID          AS batch_id,
        PLANT_ID          AS plant_id,
        MATERIAL_ID       AS material_id,
        POSTING_DATE      AS posting_date,
        BATCH_QTY         AS batch_qty,
        UOM               AS uom,
        quality_status    AS quality_status
    FROM {tbl}
    WHERE MATERIAL_ID = :material_id
      AND BATCH_ID IS NOT NULL
    ORDER BY POSTING_DATE DESC, BATCH_ID DESC
    LIMIT :max_rows
    """
    return QuerySpec(
        name="trace2.get_production_history",
        module="trace2",
        endpoint="/api/trace2/production-history",
        sql=sql,
        params={
            "material_id": request.material_id,
            "max_rows": request.max_rows,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:gold_batch_production_history_v",
        tags=["trace2", "production-history"],
    )


def map_production_history_rows(rows: list[dict], material_id: str) -> dict:
    """Map gold_batch_production_history_v rows to ProductionHistorySummarySchema shape.

    Zero rows → returns a summary with totalBatches=0 and empty rows[]. The
    route still returns 200 (not 404): a material may legitimately have no
    recent production history (e.g., it's a raw-input material, not a
    manufactured product) and that information is informative.

    quality_status mapping: 'Pass' → 'pass', 'Fail' → 'fail',
    anything else (including null/empty) → 'unknown'.
    """
    mapped_rows: list[dict] = []
    pass_count = 0
    fail_count = 0
    unknown_count = 0

    for row in rows:
        raw_quality = row.get("quality_status")
        quality = _map_quality_status(raw_quality)
        if quality == "pass":
            pass_count += 1
        elif quality == "fail":
            fail_count += 1
        else:
            unknown_count += 1

        mapped_row: dict = {
            "batchId": str(row.get("batch_id") or ""),
            "materialId": str(row.get("material_id") or material_id),
            "quantity": float(row.get("batch_qty") or 0),
            "qualityStatus": quality,
        }
        if row.get("process_order_id") is not None:
            mapped_row["processOrderId"] = str(row["process_order_id"])
        if row.get("plant_id") is not None:
            mapped_row["plantId"] = str(row["plant_id"])
        if row.get("posting_date") is not None:
            mapped_row["postingDate"] = str(row["posting_date"])
        if row.get("uom") is not None:
            mapped_row["uom"] = str(row["uom"])
        mapped_rows.append(mapped_row)

    return {
        "materialId": material_id,
        "totalBatches": len(mapped_rows),
        "passCount": pass_count,
        "failCount": fail_count,
        "unknownCount": unknown_count,
        "rows": mapped_rows,
    }
