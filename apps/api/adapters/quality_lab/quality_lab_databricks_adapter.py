"""Quality Lab Board Databricks adapter — QuerySpec factory and row mapper.

Sources the governed vw_consumption_quality_lab_fails view via the quality_lab domain
(QUALITY_LAB_CATALOG / QUALITY_LAB_SCHEMA, default gold_io_reporting; falls back to
WH360_CATALOG). RLS enforced by the upstream gold_qm_lab_result_signal_secured view.

The response shape preserves the V1 FailSpec field names verbatim:
  mat, matNo, lot, batch, line, char, text, res, lo, hi, units, sev, ts, lotType

Severity: computed in gold (gold_qm_lab_result_signal) — 'fail' = outside spec,
'warn' = within warning band. This replaces the V1 path which hardcoded sev='fail'.

Column verification — vw_consumption_quality_lab_fails:
  Defined in resources/sql/quality_lab_consumption_views_*.sql; columns are direct
  projections from gold_qm_lab_result_signal_secured (which reads gold_qm_lab_result_signal).
  Verified source columns from gold/quality_lab.py:
    plant_code, mat_no, mat, lot, batch, line, char, text, res, lo, hi, units, sev, ts, lot_type
"""
from __future__ import annotations

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec


def map_lab_fails_rows(rows: list[dict]) -> dict:
    """Map raw Databricks rows to the ConnectedQualityLabFailuresResponse contract shape.

    Preserves the V1 FailSpec field names (mat, matNo, lot, …) exactly.
    Optional fields (batch, lo, hi, line) are omitted from each record when NULL.
    sev comes from the gold severity rule ('fail' | 'warn').
    """
    fails = []
    for row in rows:
        lot = row.get("lot")
        mat_no = row.get("mat_no")
        if not lot or not mat_no:
            continue

        fail: dict = {
            "mat": str(row.get("mat") or mat_no),
            "matNo": str(mat_no),
            "lot": str(lot),
            "char": str(row.get("char") or ""),
            "text": str(row.get("text") or row.get("char") or ""),
            "res": float(row["res"]) if row.get("res") is not None else 0.0,
            "units": str(row.get("units") or ""),
            "sev": str(row.get("sev") or "fail"),
            "ts": str(row["ts"]) if row.get("ts") is not None else None,
            "lotType": str(row.get("lot_type") or ""),
        }

        # Optional fields: include only when non-NULL (preserves V1 contract behaviour).
        if row.get("batch") is not None:
            fail["batch"] = str(row["batch"])
        if row.get("line") is not None:
            fail["line"] = str(row["line"])
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
    """Return a QuerySpec for GET /api/cq/lab/fails (governed path).

    Source: vw_consumption_quality_lab_fails in the quality_lab domain
    (QUALITY_LAB_CATALOG.QUALITY_LAB_SCHEMA, default gold_io_reporting).
    RLS enforced by the upstream *_secured view via the user's OAuth token.
    Cache: PER_USER_60S — operational wallboard data, shift-sensitive.

    Filters:
      plant_id  — restrict to a single plant (optional; passed as SQL param)
      lot_type  — restrict by lot_type column ('89' FP / '04' RM, optional)
    """
    view = resolve_domain_object("quality_lab", "vw_consumption_quality_lab_fails")

    plant_clause = "AND plant_code = :plant_id" if plant_id else ""
    lot_type_clause = "AND lot_type = :lot_type" if lot_type else ""

    sql = f"""
    SELECT
        plant_code   AS plant_code,
        mat_no       AS mat_no,
        mat          AS mat,
        lot          AS lot,
        batch        AS batch,
        line         AS line,
        char         AS char,
        text         AS text,
        res          AS res,
        lo           AS lo,
        hi           AS hi,
        units        AS units,
        sev          AS sev,
        ts           AS ts,
        lot_type     AS lot_type
    FROM {view}
    WHERE plant_code IS NOT NULL
    {plant_clause}
    {lot_type_clause}
    ORDER BY ts DESC NULLS LAST
    LIMIT :max_rows
    """

    params: dict[str, object] = {}
    if plant_id:
        params["plant_id"] = plant_id
    if lot_type:
        params["lot_type"] = lot_type

    return QuerySpec(
        name="quality_lab.get_lab_fails",
        module="quality_lab",
        endpoint="/api/cq/lab/fails",
        sql=sql,
        params=params,
        cache_policy=CacheTier.PER_USER_60S,
        tags=["quality_lab", "lab", "fails"],
    )


class QualityLabRepository:
    """Repository for the governed Quality Lab Board data."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_lab_fails(
        self,
        plant_id: str | None,
        lot_type: str | None,
    ) -> tuple[dict, QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_lab_fails_spec(plant_id, lot_type),
            mapper=map_lab_fails_rows,
        )
