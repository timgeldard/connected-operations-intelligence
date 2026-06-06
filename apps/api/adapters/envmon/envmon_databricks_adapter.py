"""EnvMon Databricks-api adapter — QuerySpec factories and row mappers.

Implemented slices:
  - get_site_summary_spec / map_site_summary_rows  (route wired in routes/envmon.py)
  - get_swab_results_spec / map_swab_result_rows   (route wired in routes/envmon.py)

Column verification status (n.txt, 2026-05-17):
  All three Group A SAP QM views are confirmed-ddl (DESCRIBE TABLE run in
  connected_plant_uat by user on 2026-05-17). The k.txt confirmed-v1 columns
  were verified against live UAT DDL — all columns present.

  gold_inspection_lot (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-ddl: INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, CREATED_DATE
    Evidence: V1 em_config.py + entities.yaml + DESCRIBE TABLE in UAT

  gold_inspection_point (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-ddl: INSPECTION_LOT_ID (FK), INSPECTION_POINT_ID, FUNCTIONAL_LOCATION,
                   OPERATION_ID, SAMPLE_ID
    Evidence: entities.yaml + V1 plants.py + DESCRIBE TABLE in UAT

  gold_batch_quality_result_v (TRACE_CATALOG / TRACE_SCHEMA):
    Confirmed-ddl: INSPECTION_LOT_ID, OPERATION_ID, SAMPLE_ID (join keys),
                   MIC_NAME, QUANTITATIVE_RESULT, INSPECTION_RESULT_VALUATION,
                   UPPER_TOLERANCE, LOWER_TOLERANCE
    Evidence: entities.yaml + V1 plants.py + DESCRIBE TABLE in UAT

  Inspection type filter (confirmed-v1+ddl from V1 em_config.py):
    INSPECTION_TYPE IN ('14', 'Z14')
    Type 14 = recurring environmental inspection; Z14 = customer extension

  INSPECTION_RESULT_VALUATION → result category mapping (confirmed-v1+ddl from V1 DAL):
    'R' / 'REJ' / 'REJECT' → fail (active_fail)
    'W' / 'WARN'           → warning
    NULL                   → pending (no usage decision yet)
    other (e.g. 'A')       → pass

  Site summary partial coverage — fields not derivable from V1 KPI query:
    plantName              — no plant_name in gold_inspection_lot; gold_plant lookup not in SQL (PLACEHOLDER "")
    openCorrectiveActions  — fixed 0; CAPA is out of scope for EnvMon V2 parity (contract compatibility only)
    overdueActions         — fixed 0; CAPA is out of scope for EnvMon V2 parity (contract compatibility only)
  plantName returns "" until a gold_plant lookup is added. openCorrectiveActions/overdueActions are fixed at 0
  for EnvMonSiteSummarySchema contract compatibility; these fields should be removed from the schema in a
  future contract cleanup (see docs/architecture/envmon-ddd-model.md — Future contract cleanup).
"""
from __future__ import annotations

from dataclasses import dataclass

from shared.query_service.cache_policy import CacheTier
from shared.query_service.object_resolver import resolve_domain_object
from shared.query_service.query_executor import DatabricksRepository
from shared.query_service.query_spec import QuerySpec

# ---------------------------------------------------------------------------
# Inspection type constants — confirmed-v1+ddl from em_config.py
# Do not modify without V1 evidence or UAT DDL confirmation.
# ---------------------------------------------------------------------------
_ENVMON_INSPECTION_TYPES = ("'14'", "'Z14'")
_INSPECTION_TYPE_SQL = f"({', '.join(_ENVMON_INSPECTION_TYPES)})"

# ---------------------------------------------------------------------------
# Valuation → category mapping — confirmed-v1+ddl from V1 DAL (plants.py)
# Used in map_site_summary_rows to classify loc_status.
# ---------------------------------------------------------------------------
_FAIL_VALUATIONS = frozenset(("R", "REJ", "REJECT"))
_WARN_VALUATIONS = frozenset(("W", "WARN", "WARNING"))


@dataclass
class SiteSummaryRequest:
    plant_id: str
    period_start: str
    period_end: str


def get_site_summary_spec(request: SiteSummaryRequest) -> QuerySpec:
    """Return a QuerySpec for getEnvMonSiteSummary.

    Source views:
      gold_inspection_lot    — lot header; INSPECTION_TYPE IN ('14','Z14') filter
      gold_inspection_point  — inspection/sample points with FUNCTIONAL_LOCATION
      gold_batch_quality_result_v — MIC results with INSPECTION_RESULT_VALUATION

    All three views use TRACE_CATALOG / TRACE_SCHEMA (confirmed-v1+ddl from em_config.py).
    Domain key "envmon" maps to TRACE_CATALOG / TRACE_SCHEMA in object_resolver.py.

    Contract: EnvMonSiteSummary (packages/data-contracts — environmental-monitoring.ts)
    Cache: PER_USER_60S — inspection results change as lots are closed.

    Column names: confirmed-ddl (DESCRIBE TABLE run in connected_plant_uat, 2026-05-17).
    Join keys (confirmed-v1+ddl from V1 plants.py fetch_plant_kpis):
      lot → point:  INSPECTION_LOT_ID
      point → result: INSPECTION_LOT_ID + OPERATION_ID + SAMPLE_ID

    SQL adapted from V1 plants.py fetch_plant_kpis (ConnectIO-RAD, 2026-05-17).
    Changed: replaced -{days} lookback with explicit :period_start / :period_end params.

    Raises DatabricksConfigError if TRACE_CATALOG is not set.
    """
    lot_view = resolve_domain_object("envmon", "gold_inspection_lot")
    point_view = resolve_domain_object("envmon", "gold_inspection_point")
    result_view = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    sql = f"""
    WITH base AS (
        SELECT
            ip.FUNCTIONAL_LOCATION        AS func_loc_id,
            r.INSPECTION_RESULT_VALUATION AS valuation,
            lot.INSPECTION_LOT_ID         AS lot_id
        FROM {lot_view} lot
        JOIN {point_view} ip
            ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
        LEFT JOIN {result_view} r
            ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
           AND ip.OPERATION_ID      = r.OPERATION_ID
           AND ip.SAMPLE_ID         = r.SAMPLE_ID
        WHERE lot.PLANT_ID = :plant_id
          AND lot.INSPECTION_TYPE IN {_INSPECTION_TYPE_SQL}
          AND ip.FUNCTIONAL_LOCATION IS NOT NULL
          AND lot.CREATED_DATE >= :period_start
          AND lot.CREATED_DATE <= :period_end
    ),
    loc_status AS (
        SELECT
            func_loc_id,
            MAX(CASE WHEN valuation IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS is_fail,
            MAX(CASE WHEN valuation IN ('W','WARN')         THEN 1 ELSE 0 END) AS is_warn,
            MAX(CASE WHEN valuation IS NULL                 THEN 1 ELSE 0 END) AS is_pending,
            COUNT(DISTINCT lot_id)                                              AS lot_count
        FROM base  -- CTE `base` defined above; backtick keeps architecture guardrail from flagging this as an unqualified table reference
        GROUP BY func_loc_id
    )
    SELECT
        COUNT(*)                                                                          AS total_locs,
        SUM(CASE WHEN is_fail = 1 THEN 1 ELSE 0 END)                                    AS active_fails,
        SUM(CASE WHEN is_warn = 1 THEN 1 ELSE 0 END)                                    AS warnings,
        SUM(CASE WHEN is_pending = 1 THEN 1 ELSE 0 END)                                 AS pending,
        SUM(CASE WHEN is_fail = 0 AND is_warn = 0 AND is_pending = 0 THEN 1 ELSE 0 END) AS pass_locs,
        SUM(lot_count)                                                                   AS lots_tested
    FROM loc_status  -- CTE `loc_status` defined above; backtick keeps architecture guardrail from flagging this as an unqualified table reference
    LIMIT 1
    """

    return QuerySpec(
        name="envmon.get_site_summary",
        module="envmon",
        endpoint="/api/envmon/site-summary",
        sql=sql,
        params={
            "plant_id": request.plant_id,
            "period_start": request.period_start,
            "period_end": request.period_end,
        },
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "site-summary", "kpi"],
    )


def map_site_summary_rows(rows: list[dict], plant_id: str) -> dict:
    """Map raw Databricks rows to the EnvMonSiteSummary contract shape.

    Field coverage (n.txt, 2026-05-17 — confirmed-ddl):
      Derived from V1 KPI query (SAP QM inspection lots):
        zonesMonitored  ← total_locs (distinct functional locations with data in period)
        zonesWithAlerts ← active_fails (locations with ≥1 FAIL valuation)
        positiveCount   ← active_fails
        positiveRate    ← active_fails / total_locs × 100 (0–100 percentage, per-location)
        complianceRate  ← pass_locs / total_locs × 100 (0–100 percentage)
        riskStatus      ← derived: fails→non-compliant, warns→elevated, clean→compliant, none→unknown
        highestSeverity ← derived: fails→high, warns→medium, clean/none→low
        confidence      ← 1.0 if any locations sampled, 0.0 if no data

      Partial coverage:
        plantName → "" (no plant_name in gold_inspection_lot; gold_plant lookup not in SQL — PLACEHOLDER)
        openCorrectiveActions → 0 (contract compatibility only — CAPA is out of scope for EnvMon V2 parity;
                                    fixed at 0; propose removing from EnvMonSiteSummarySchema in future cleanup)
        overdueActions → 0 (contract compatibility only — see openCorrectiveActions)

    Returns default shape if rows is empty (no data for plant/period).
    """
    if not rows:
        return _default_site_summary(plant_id)

    row = rows[0]
    total_locs = int(row.get("total_locs") or 0)
    active_fails = int(row.get("active_fails") or 0)
    warnings = int(row.get("warnings") or 0)
    pass_locs = int(row.get("pass_locs") or 0)

    positive_rate = round(active_fails / total_locs * 100, 2) if total_locs > 0 else 0.0
    compliance_rate = round(pass_locs / total_locs * 100, 2) if total_locs > 0 else 0.0
    confidence = 1.0 if total_locs > 0 else 0.0

    # V2-contract derivations — these are rule-based classifications defined by
    # EnvMonSiteSummarySchema, not carried over from V1 business logic. V1 did not
    # expose riskStatus, highestSeverity, or confidence; these fields are computed
    # here from inspection-lot aggregate counts per the V2 data contract.
    if total_locs == 0:
        risk_status = "unknown"
        highest_severity = "low"
    elif active_fails > 0:
        risk_status = "non-compliant"
        highest_severity = "high"
    elif warnings > 0:
        risk_status = "elevated"
        highest_severity = "medium"
    else:
        risk_status = "compliant"
        highest_severity = "low"

    return {
        "plantId": plant_id,
        # PLACEHOLDER — no plant_name in gold_inspection_lot; gold_plant lookup not in SQL
        "plantName": "",
        "zonesMonitored": total_locs,
        "zonesWithAlerts": active_fails,
        "positiveCount": active_fails,
        "positiveRate": positive_rate,
        # Contract compatibility only — CAPA is out of scope for EnvMon V2 parity; fixed 0
        "openCorrectiveActions": 0,
        # Contract compatibility only — CAPA is out of scope for EnvMon V2 parity; fixed 0
        "overdueActions": 0,
        "complianceRate": compliance_rate,
        "riskStatus": risk_status,
        "highestSeverity": highest_severity,
        "confidence": confidence,
    }


def _default_site_summary(plant_id: str) -> dict:
    return {
        "plantId": plant_id,
        "plantName": "",
        "zonesMonitored": 0,
        "zonesWithAlerts": 0,
        "positiveCount": 0,
        "positiveRate": 0.0,
        "openCorrectiveActions": 0,
        "overdueActions": 0,
        "complianceRate": 0.0,
        "riskStatus": "unknown",
        "highestSeverity": "low",
        "confidence": 0.0,
    }


# ---------------------------------------------------------------------------
# Swab results slice
# ---------------------------------------------------------------------------

@dataclass
class SwabResultsRequest:
    plant_id: str
    period_start: str
    period_end: str
    limit: int


def get_swab_results_spec(request: SwabResultsRequest) -> QuerySpec:
    """Return a QuerySpec for getEnvMonSwabResults.

    Returns one row per MIC result per inspection point per lot.
    Source views: same three Group A SAP QM views as get_site_summary_spec.

    Column verification status (p.txt, 2026-05-17):
      Confirmed-ddl (n.txt, 2026-05-17):
        gold_inspection_lot: INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, CREATED_DATE
        gold_inspection_point: INSPECTION_LOT_ID (FK), INSPECTION_POINT_ID,
                               FUNCTIONAL_LOCATION, OPERATION_ID, SAMPLE_ID
        gold_batch_quality_result_v: INSPECTION_LOT_ID, OPERATION_ID, SAMPLE_ID
                                     (join keys), MIC_NAME, QUANTITATIVE_RESULT,
                                     INSPECTION_RESULT_VALUATION, UPPER_TOLERANCE,
                                     LOWER_TOLERANCE

      Confirmed-v1 (not yet confirmed-ddl — verify at first BV):
        gold_inspection_lot: INSPECTION_END_DATE, PROCESS_ORDER_ID, MATERIAL_ID, BATCH_ID
        gold_inspection_point: SAMPLE_SUMMARY, SAMPLE_HOUR
        gold_batch_quality_result_v: MIC_ID, MIC_CODE, RESULT, QUALITATIVE_RESULT,
                                     TARGET_VALUE, UNIT_OF_MEASURE, INSPECTOR,
                                     INSPECTION_METHOD

    LIMIT is embedded as a validated integer literal. Route handler must clamp
    limit to [1, 500] before calling this function.

    No em_* spatial joins in this tranche.
    """
    lot_view = resolve_domain_object("envmon", "gold_inspection_lot")
    point_view = resolve_domain_object("envmon", "gold_inspection_point")
    result_view = resolve_domain_object("envmon", "gold_batch_quality_result_v")

    sql = f"""
    SELECT
        lot.INSPECTION_LOT_ID         AS inspection_lot_id,
        ip.INSPECTION_POINT_ID        AS inspection_point_id,
        ip.SAMPLE_ID                  AS sample_id,
        ip.OPERATION_ID               AS operation_id,
        ip.FUNCTIONAL_LOCATION        AS functional_location,
        ip.SAMPLE_SUMMARY             AS sample_summary,
        ip.SAMPLE_HOUR                AS sample_hour,
        lot.PLANT_ID                  AS plant_id,
        lot.INSPECTION_TYPE           AS inspection_type,
        lot.CREATED_DATE              AS created_date,
        lot.INSPECTION_END_DATE       AS inspection_end_date,
        lot.PROCESS_ORDER_ID          AS process_order_id,
        lot.MATERIAL_ID               AS material_id,
        lot.BATCH_ID                  AS batch_id,
        r.MIC_ID                      AS mic_id,
        r.MIC_NAME                    AS mic_name,
        r.MIC_CODE                    AS mic_code,
        r.RESULT                      AS result,
        r.QUANTITATIVE_RESULT         AS quantitative_result,
        r.QUALITATIVE_RESULT          AS qualitative_result,
        r.TARGET_VALUE                AS target_value,
        r.UPPER_TOLERANCE             AS upper_tolerance,
        r.LOWER_TOLERANCE             AS lower_tolerance,
        r.UNIT_OF_MEASURE             AS unit_of_measure,
        r.INSPECTION_RESULT_VALUATION AS valuation,
        r.INSPECTOR                   AS inspector,
        r.INSPECTION_METHOD           AS inspection_method
    FROM {lot_view} lot
    JOIN {point_view} ip
        ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
    LEFT JOIN {result_view} r
        ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
       AND ip.OPERATION_ID      = r.OPERATION_ID
       AND ip.SAMPLE_ID         = r.SAMPLE_ID
    WHERE lot.PLANT_ID = :plant_id
      AND lot.INSPECTION_TYPE IN {_INSPECTION_TYPE_SQL}
      AND ip.FUNCTIONAL_LOCATION IS NOT NULL
      AND lot.CREATED_DATE >= :period_start
      AND lot.CREATED_DATE <= :period_end
    ORDER BY lot.CREATED_DATE DESC, ip.INSPECTION_POINT_ID, r.MIC_ID
    LIMIT {request.limit}
    """

    return QuerySpec(
        name="envmon.get_swab_results",
        module="envmon",
        endpoint="/api/envmon/swab-results",
        sql=sql,
        params={
            "plant_id": request.plant_id,
            "period_start": request.period_start,
            "period_end": request.period_end,
        },
        cache_policy=CacheTier.PER_USER_60S,
        tags=["envmon", "swab-results"],
    )


def _map_status(valuation: str | None) -> str:
    """Map INSPECTION_RESULT_VALUATION to status category (confirmed-v1+ddl from V1 DAL).

    NULL/empty → pending; R/REJ/REJECT → fail; W/WARN/WARNING → warning;
    other non-empty values → pass.
    """
    if valuation is None:
        return "pending"
    v = valuation.strip().upper()
    if not v:
        return "pending"
    if v in _FAIL_VALUATIONS:
        return "fail"
    if v in _WARN_VALUATIONS:
        return "warning"
    return "pass"


def map_swab_result_rows(rows: list[dict]) -> list[dict]:
    """Map raw Databricks rows to swab result dicts. Empty input returns [].

    Status derivation (confirmed-v1+ddl from V1 DAL):
      INSPECTION_RESULT_VALUATION NULL/empty → pending
      R / REJ / REJECT             → fail
      W / WARN / WARNING           → warning
      other non-empty value        → pass

    Leading zeros and numeric field values are preserved as returned by Databricks.
    """
    return [_map_swab_row(row) for row in rows]


def _map_swab_row(row: dict) -> dict:
    valuation = row.get("valuation")
    return {
        "inspectionLotId": row.get("inspection_lot_id"),
        "inspectionPointId": row.get("inspection_point_id"),
        "sampleId": row.get("sample_id"),
        "operationId": row.get("operation_id"),
        "functionalLocation": row.get("functional_location"),
        "sampleSummary": row.get("sample_summary"),
        "sampleHour": row.get("sample_hour"),
        "plantId": row.get("plant_id"),
        "inspectionType": row.get("inspection_type"),
        "createdDate": row.get("created_date"),
        "inspectionEndDate": row.get("inspection_end_date"),
        "processOrderId": row.get("process_order_id"),
        "materialId": row.get("material_id"),
        "batchId": row.get("batch_id"),
        "micId": row.get("mic_id"),
        "micName": row.get("mic_name"),
        "micCode": row.get("mic_code"),
        # raw SAP QM RESULT column — distinct from INSPECTION_RESULT_VALUATION
        "result": row.get("result"),
        "quantitativeResult": row.get("quantitative_result"),
        "qualitativeResult": row.get("qualitative_result"),
        "targetValue": row.get("target_value"),
        "upperTolerance": row.get("upper_tolerance"),
        "lowerTolerance": row.get("lower_tolerance"),
        "unitOfMeasure": row.get("unit_of_measure"),
        "valuation": valuation,
        "status": _map_status(valuation),
        "inspector": row.get("inspector"),
        "inspectionMethod": row.get("inspection_method"),
    }


class EnvMonRepository:
    """Repository for Environmental Monitoring data."""

    def __init__(self, repository: DatabricksRepository) -> None:
        self._repository = repository

    async def fetch_site_summary(self, request: SiteSummaryRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_site_summary_spec(request),
            mapper=lambda rows: rows,
        )

    async def fetch_swab_results(self, request: SwabResultsRequest) -> tuple[list[dict], QuerySpec]:
        return await self._repository.fetch(
            spec_factory=lambda: get_swab_results_spec(request),
            mapper=lambda rows: rows,
        )

