"""CQ Lab Databricks-api adapter — QuerySpec factories for Connected Quality Lab.

Implemented slices:
  - get_lab_plants_spec: maps to ConnectedQualityLabPlantsResponseSchema
  - get_lab_fails_spec:  maps to ConnectedQualityLabFailuresResponseSchema

Column verification — vw_gold_quality_result_enriched (csm_process_order_history):
  Verified 2026-05-26 via `databricks tables get` against connected_plant_uat.
  Source views and column names confirmed from live Unity Catalog DDL:
    vw_gold_inspection_result:         INSPECTION_CHARACTERISTIC_ID, INSPECTION_OPERATION_ID,
                                       PROCESS_ORDER_ID, QUANTITATIVE_RESULT,
                                       INSPECTION_RESULT_VALUATION
    vw_gold_process_order:             PROCESS_ORDER_ID, INSPECTION_LOT_ID, MATERIAL_ID, PLANT_ID
    vw_gold_inspection_usage_decision: INSPECTION_LOT_ID, INSPECTION_LOT_TYPE,
                                       USAGE_DECISION_CREATED_DATE
    vw_gold_inspection_lot:            INSPECTION_LOT_ID, BATCH_ID
    vw_gold_inspection_specification:  INSPECTION_CHARACTERISTIC_ID, INSPECTION_OPERATION_ID,
                                       MIC_NAME, LOWER_TOLERANCE, UPPER_TOLERANCE, UNIT_OF_MEASURE
    vw_gold_material:                  MATERIAL_ID, MATERIAL_NAME, LANGUAGE_ID

Known limitations of the Databricks path (documented, not deferred):
  - sev is always 'fail'; 'warn' requires VALUATION_CODE enrichment (not yet modelled)
  - line is absent — vw_gold_process_order_plan does not exist
  - batch/lo/hi are optional — present when the joined view rows are non-NULL
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec


def map_lab_plants_rows(rows: list[dict]) -> dict:
    """Map raw Databricks rows to the ConnectedQualityLabPlantsResponse contract shape.

    Returns ``{"plants": [...]}`` always — empty list if no rows.

    Mapping: ``plant_id`` → ``plantId``, ``plant_name`` → ``plantName``.
    Column names confirmed from V1 source (gold.gold_plant.PLANT_ID / PLANT_NAME).
    """
    plants = [
        {
            "plantId": str(row.get("plant_id", "")),
            "plantName": str(row.get("plant_name", "")),
        }
        for row in rows
        if row.get("plant_id")
    ]
    return {"plants": plants}


def get_lab_plants_spec() -> QuerySpec:
    """Return a QuerySpec for getLabPlants.

    Source table: gold.gold_plant under CQ_CATALOG (falls back to TRACE_CATALOG).
    Schema is always ``gold`` — matches V1 which uses `{CQ_CATALOG}`.`gold`.`gold_plant`.
    Contract: ConnectedQualityLabPlantsResponseSchema (packages/data-contracts)
    Cache: GLOBAL_300S — plant list is a slow-moving dimension; shared across users.

    Raises DatabricksConfigError if CQ_CATALOG (or fallback TRACE_CATALOG) is not set.
    """
    plant_table = resolve_domain_object("cq", "gold_plant", schema_override="gold")

    sql = f"""
    SELECT
        PLANT_ID   AS plant_id,    -- confirmed via V1 source: gold.gold_plant.PLANT_ID
        PLANT_NAME AS plant_name   -- confirmed via V1 source: gold.gold_plant.PLANT_NAME
    FROM {plant_table}
    WHERE PLANT_ID IS NOT NULL
    ORDER BY PLANT_ID
    LIMIT :max_rows
    """

    return QuerySpec(
        name="cq.get_lab_plants",
        module="cq",
        endpoint="/api/cq/lab/plants",
        sql=sql,
        params={},
        cache_policy=CacheTier.GLOBAL_300S,
        tags=["cq", "lab", "plants"],
    )


def map_lab_fails_rows(rows: list[dict]) -> dict:
    """Map raw Databricks rows to the ConnectedQualityLabFailuresResponse contract shape.

    Returns ``{"fails": [...], "dataAvailable": True}`` always.

    Optional fields (batch, lo, hi) are omitted from each record when NULL in source.
    sev is hardcoded to 'fail' — warn distinction requires VALUATION_CODE enrichment (deferred).
    """
    fails = []
    for row in rows:
        lot = row.get("lot")
        mat_no = row.get("mat_no")
        if not lot or not mat_no:
            continue

        fail: dict = {
            "mat": str(row.get("mat") or ""),
            "matNo": str(mat_no),
            "lot": str(lot),
            "char": str(row.get("char") or ""),
            "text": str(row.get("text") or ""),
            "res": float(row["res"]) if row.get("res") is not None else 0.0,
            "units": str(row.get("units") or ""),
            "sev": "fail",
            "ts": str(row["ts"]) if row.get("ts") is not None else None,
            "lotType": str(row.get("lot_type") or ""),
        }

        if row.get("batch") is not None:
            fail["batch"] = str(row["batch"])
        if row.get("lo") is not None:
            fail["lo"] = float(row["lo"])
        if row.get("hi") is not None:
            fail["hi"] = float(row["hi"])

        fails.append(fail)

    return {"fails": fails, "dataAvailable": True}


def get_lab_fails_spec(
    plant_id: str | None = None,
    lot_type: str | None = None,
) -> QuerySpec:
    """Return a QuerySpec for getLabFails.

    Source views: csm_process_order_history under CQ_CATALOG (falls back to TRACE_CATALOG).
    Column names verified 2026-05-26 from connected_plant_uat live DDL.
    Contract: ConnectedQualityLabFailuresResponseSchema (packages/data-contracts)
    Cache: PER_USER_60S — operational data, shift-sensitive.

    Filters:
      plant_id  — restrict to a single plant (optional)
      lot_type  — restrict by INSPECTION_LOT_TYPE from usage decision (optional)

    sev is always 'fail': the available views do not distinguish warn from fail.
    batch/lo/hi are optional: sourced from nullable columns in joined views.
    """
    ir_view = resolve_domain_object("cq", "vw_gold_inspection_result")
    po_view = resolve_domain_object("cq", "vw_gold_process_order")
    ud_view = resolve_domain_object("cq", "vw_gold_inspection_usage_decision")
    il_view = resolve_domain_object("cq", "vw_gold_inspection_lot")
    spec_view = resolve_domain_object("cq", "vw_gold_inspection_specification")
    mat_view = resolve_domain_object("cq", "vw_gold_material")

    plant_clause = "AND po.PLANT_ID = :plant_id" if plant_id else ""
    lot_type_clause = "AND ud.INSPECTION_LOT_TYPE = :lot_type" if lot_type else ""

    sql = f"""
    SELECT
        po.INSPECTION_LOT_ID                                     AS lot,
        po.MATERIAL_ID                                           AS mat_no,
        COALESCE(m.MATERIAL_NAME, po.MATERIAL_ID)                AS mat,
        il.BATCH_ID                                              AS batch,
        ir.INSPECTION_CHARACTERISTIC_ID                          AS char,
        COALESCE(spec.MIC_NAME, ir.INSPECTION_CHARACTERISTIC_ID) AS text,
        COALESCE(ir.QUANTITATIVE_RESULT, 0.0)                    AS res,
        spec.LOWER_TOLERANCE                                     AS lo,
        spec.UPPER_TOLERANCE                                     AS hi,
        COALESCE(spec.UNIT_OF_MEASURE, '')                       AS units,
        'fail'                                                   AS sev,
        CAST(ud.USAGE_DECISION_CREATED_DATE AS STRING)           AS ts,
        COALESCE(ud.INSPECTION_LOT_TYPE, '')                     AS lot_type
    FROM {ir_view} ir
    JOIN {po_view} po
        ON po.PROCESS_ORDER_ID = ir.PROCESS_ORDER_ID
    JOIN {ud_view} ud
        ON ud.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
    LEFT JOIN {il_view} il
        ON il.INSPECTION_LOT_ID = po.INSPECTION_LOT_ID
    LEFT JOIN {spec_view} spec
        ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
       AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
    LEFT JOIN {mat_view} m
        ON m.MATERIAL_ID = po.MATERIAL_ID AND m.LANGUAGE_ID = 'E'
    WHERE ir.INSPECTION_RESULT_VALUATION NOT LIKE 'A%'
    {plant_clause}
    {lot_type_clause}
    ORDER BY ud.USAGE_DECISION_CREATED_DATE DESC
    LIMIT :max_rows
    """

    params: dict[str, object] = {}
    if plant_id:
        params["plant_id"] = plant_id
    if lot_type:
        params["lot_type"] = lot_type

    return QuerySpec(
        name="cq.get_lab_fails",
        module="cq",
        endpoint="/api/cq/lab/fails",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["cq", "lab", "fails"],
    )


class CqLabRepository:
    """Repository for Connected Quality Lab data."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_lab_plants(self) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=get_lab_plants_spec,
            mapper=map_lab_plants_rows,
        )

    async def fetch_lab_fails(
        self,
        plant_id: str | None,
        lot_type: str | None,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_lab_fails_spec(plant_id, lot_type),
            mapper=map_lab_fails_rows,
        )
