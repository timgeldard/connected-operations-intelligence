from __future__ import annotations

from dataclasses import dataclass

from contracts.spc import SpcChartDataRequest
from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec

MAX_SUBGROUPS = 200

_SPC_MV = "spc_quality_metric_subgroup_mv"
_LOCKED_LIMITS = "spc_locked_limits"


@dataclass(frozen=True)
class SpcChartDataQueryResult:
    """Raw Databricks rows for chart-data assembly (mapping stays in the route)."""

    subgroup_rows: list[dict]
    limit_rows: list[dict]


class SpcChartDataRepository:
    """Repository wrapper for read-only SPC chart-data Databricks queries.

    The route owns request validation and ``map_spc_chart_response`` assembly.
    This class owns QuerySpec creation and repository execution.
    """

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_chart_subgroups(
        self,
        request: SpcChartDataRequest,
    ) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_spc_chart_subgroups_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_locked_limits(
        self,
        request: SpcChartDataRequest,
    ) -> tuple[list[dict], QuerySpec | None]:
        if not request.chart_type:
            return [], None
        rows, spec = await self._repository.fetch(
            spec_factory=lambda: get_spc_locked_limits_spec(request),
            mapper=lambda r: r,
        )
        return rows, spec


def get_spc_chart_subgroups_spec(request: SpcChartDataRequest) -> QuerySpec:
    mv = resolve_domain_object("spc", _SPC_MV)
    safe_limit = max(1, min(MAX_SUBGROUPS, request.max_rows or MAX_SUBGROUPS))

    sql = f"""
    SELECT
        material_id,
        plant_id,
        mic_id,
        operation_id,
        batch_id,
        MAX(batch_date)             AS batch_date,
        MAX(first_posting_date)     AS first_posting_date,
        MAX(last_posting_date)      AS last_posting_date,
        MAX(batch_n)                AS batch_n,
        MAX(sum_value)              AS sum_value,
        MAX(sum_squares)            AS sum_squares,
        MIN(min_value)              AS min_value,
        MAX(max_value)              AS max_value,
        MAX(batch_range)            AS batch_range,
        MAX(any_rejection)          AS any_rejection,
        MAX(any_acceptance)         AS any_acceptance,
        MAX(usl_spec)               AS usl_spec,
        MAX(lsl_spec)               AS lsl_spec,
        MAX(nominal_target)         AS nominal_target,
        MAX(tolerance_half_width)   AS tolerance_half_width,
        MAX(raw_tolerance)          AS raw_tolerance,
        MAX(spec_signature)         AS spec_signature,
        MAX(spec_type)              AS spec_type,
        MAX(normality_type)         AS normality_type,
        MAX(normality_method)       AS normality_method,
        MAX(normality_signature)    AS normality_signature,
        MAX(unified_mic_key)        AS unified_mic_key,
        ARRAY_AGG(value)            AS individual_values,
        COUNT(*)                    AS source_row_count
    FROM {mv}
    WHERE material_id  = :material_id
      AND plant_id     = :plant_id
      AND mic_id       = :mic_id
      AND operation_id = :operation_id
      AND batch_date  >= :date_from
      AND batch_date  <= :date_to
      AND plant_id <> 'P999'
      AND material_id IS NOT NULL
      AND TRIM(material_id) <> ''
    GROUP BY material_id, plant_id, mic_id, operation_id, batch_id
    ORDER BY batch_date ASC, batch_id ASC
    LIMIT {safe_limit}
    """

    return QuerySpec(
        name="spc.get_chart_data",
        module="spc",
        endpoint="/api/spc/chart-data",
        sql=sql,
        params={
            "material_id": request.material_id,
            "plant_id": request.plant_id,
            "mic_id": request.mic_id,
            "operation_id": request.operation_id,
            "date_from": request.date_from,
            "date_to": request.date_to,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:spc_quality_metric_subgroup_mv",
        tags=["spc", "chart-data", "subgroups"],
    )

def get_spc_locked_limits_spec(request: SpcChartDataRequest) -> QuerySpec:
    ll = resolve_domain_object("spc", _LOCKED_LIMITS)

    sql = f"""
    SELECT cl, ucl, lcl, ucl_r, lcl_r, sigma_within,
           locked_by, locked_at, baseline_from, baseline_to, locking_note,
           mic_origin, unified_mic_key, spec_signature, chart_type
    FROM {ll}
    WHERE material_id = :material_id
      AND plant_id    = :plant_id
      AND mic_id      = :mic_id
      AND operation_id = :operation_id
      AND chart_type  = :resolved_chart_type
    LIMIT 1
    """

    return QuerySpec(
        name="spc.get_locked_limits",
        module="spc",
        endpoint="/api/spc/chart-data",
        sql=sql,
        params={
            "material_id": request.material_id,
            "plant_id": request.plant_id,
            "mic_id": request.mic_id,
            "operation_id": request.operation_id,
            "resolved_chart_type": request.chart_type,
        },
        cache_policy=CacheTier.PER_USER_60S,
        source_badge="view:spc_locked_limits",
        tags=["spc", "chart-data", "locked-limits"],
    )

def map_spc_chart_response(
    subgroup_rows: list[dict],
    limit_rows: list[dict],
    request: SpcChartDataRequest,
    queried_at: str,
) -> dict:
    points = []
    excluded_count = 0
    excluded_reasons = set()

    for r in subgroup_rows:
        batch_n = r.get("batch_n") or 0
        sum_value = r.get("sum_value") or 0.0
        sum_squares = r.get("sum_squares") or 0.0
        mean = float(sum_value) / batch_n if batch_n > 0 else None

        std_dev = None
        if batch_n >= 2:
            import math
            variance = (sum_squares - (sum_value ** 2) / batch_n) / (batch_n - 1)
            if variance >= 0:
                std_dev = math.sqrt(variance)

        points.append({
            "pointId": f"{r.get('batch_id')}_{r.get('batch_date')}",
            "batchId": str(r.get("batch_id") or ""),
            "batchDate": str(r.get("batch_date") or ""),
            "firstPostingDate": str(r.get("first_posting_date")) if r.get("first_posting_date") else None,
            "lastPostingDate": str(r.get("last_posting_date")) if r.get("last_posting_date") else None,
            "subgroupMean": mean,
            "subgroupRange": float(r.get("batch_range") or 0.0),
            "subgroupStdDev": std_dev,
            "sampleCount": batch_n,
            "sourceRowCount": int(r.get("source_row_count") or 0),
            "minValue": float(r.get("min_value") or 0.0),
            "maxValue": float(r.get("max_value") or 0.0),
            "individualValues": r.get("individual_values") or [],
            "anyRejection": bool(r.get("any_rejection")),
            "anyAcceptance": bool(r.get("any_acceptance")),
            "warnings": [],
        })

    # Process limits
    control_limits = {
        "centerLine": None,
        "upperControlLimit": None,
        "lowerControlLimit": None,
        "uclR": None,
        "lclR": None,
        "sigmaWithin": None,
        "limitProvenance": "calculated-from-sample",
        "approvalState": "not-approved",
        "lockedLimits": False,
        "lockedFrom": None,
        "lockedTo": None,
        "lockedBy": None,
        "lockedAt": None,
        "lockingNote": None,
    }

    warnings_list = []

    if limit_rows:
        lr = limit_rows[0]
        control_limits.update({
            "centerLine": _float_or_none(lr.get("cl")),
            "upperControlLimit": _float_or_none(lr.get("ucl")),
            "lowerControlLimit": _float_or_none(lr.get("lcl")),
            "uclR": _float_or_none(lr.get("ucl_r")),
            "lclR": _float_or_none(lr.get("lcl_r")),
            "sigmaWithin": _float_or_none(lr.get("sigma_within")),
            "limitProvenance": "unknown",
            "approvalState": "pending-validation",
            "lockedLimits": True,
            "lockedFrom": str(lr.get("baseline_from")) if lr.get("baseline_from") else None,
            "lockedTo": str(lr.get("baseline_to")) if lr.get("baseline_to") else None,
            "lockedBy": str(lr.get("locked_by")) if lr.get("locked_by") else None,
            "lockedAt": str(lr.get("locked_at")) if lr.get("locked_at") else None,
            "lockingNote": str(lr.get("locking_note")) if lr.get("locking_note") else None,
        })
        warnings_list.append("Locked limits source row found, but approval semantics are governance-pending; locked_by is not treated as approval.")

    # Spec limits from first point
    lsl, usl = None, None
    spec_sig, spec_type = None, None
    nom, thw, rt = None, None, None
    if subgroup_rows:
        lsl = _float_or_none(subgroup_rows[0].get("lsl_spec"))
        usl = _float_or_none(subgroup_rows[0].get("usl_spec"))
        spec_sig = subgroup_rows[0].get("spec_signature")
        spec_type = subgroup_rows[0].get("spec_type")
        nom = _float_or_none(subgroup_rows[0].get("nominal_target"))
        thw = _float_or_none(subgroup_rows[0].get("tolerance_half_width"))
        rt = _float_or_none(subgroup_rows[0].get("raw_tolerance"))

    if lsl == 0.0 and usl == 0.0:
        source_status = "not-populated-zero-zero"
        lsl, usl = None, None
    elif lsl is not None and usl is not None:
        source_status = "present"
    elif lsl is not None:
        source_status = "lower-only"
    elif usl is not None:
        source_status = "upper-only"
    else:
        source_status = "unavailable"

    spec_limits = {
        "upperSpecLimit": usl,
        "lowerSpecLimit": lsl,
        "nominalTarget": nom,
        "toleranceHalfWidth": thw,
        "rawTolerance": rt,
        "specSignature": str(spec_sig) if spec_sig else None,
        "specType": str(spec_type) if spec_type else None,
        "sourceStatus": source_status,
    }

    return {
        "chartSeries": points,
        "controlLimits": control_limits,
        "specLimits": spec_limits,
        "signalsSource": "calculated-frontend",
        "capabilitySource": "unavailable",
        "excludedRowCount": excluded_count,
        "excludedReasons": list(excluded_reasons),
        "warnings": warnings_list,
        "queriedAt": queried_at,
        "sourceDataAsOf": None,
    }

def _float_or_none(val) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None
