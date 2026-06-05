-- Companion Databricks SQL definition for the Gold data health summary.
-- Source of truth for the Lakeflow pipeline: gold/freshness.py.
-- Run in the Gold schema after the base Gold MVs exist.

CREATE OR REFRESH MATERIALIZED VIEW gold_data_health_summary AS
WITH freshness AS (
  SELECT
    'freshness' AS health_area,
    CASE
      WHEN coalesce(sum(CASE WHEN criticality = 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END), 0) > 0 THEN 'FAIL'
      WHEN coalesce(sum(CASE WHEN criticality <> 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END), 0) > 0 THEN 'WARN'
      ELSE 'OK'
    END AS health_status,
    count(*) AS affected_row_count,
    coalesce(sum(CASE WHEN criticality = 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END), 0) AS critical_issue_count,
    coalesce(sum(CASE WHEN criticality <> 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END), 0) AS warning_issue_count,
    max(checked_at) AS latest_observed_at,
    concat('monitored Silver dependencies=', cast(count(*) AS string)) AS details
  FROM gold_data_freshness_status
),
storage_coverage AS (
  SELECT
    'storage_type_role_coverage' AS health_area,
    CASE
      WHEN coalesce(sum(CASE WHEN coverage_status = 'MISSING' THEN 1 ELSE 0 END), 0) > 0 THEN 'FAIL'
      WHEN coalesce(sum(CASE WHEN coverage_status = 'PARTIAL' THEN 1 ELSE 0 END), 0) > 0 THEN 'WARN'
      ELSE 'OK'
    END AS health_status,
    count(*) AS affected_row_count,
    coalesce(sum(CASE WHEN coverage_status = 'MISSING' THEN 1 ELSE 0 END), 0) AS critical_issue_count,
    coalesce(sum(CASE WHEN coverage_status = 'PARTIAL' THEN 1 ELSE 0 END), 0) AS warning_issue_count,
    current_timestamp() AS latest_observed_at,
    'MISSING/PARTIAL storage-type role mappings affect lineside and reconciliation trust' AS details
  FROM gold_storage_type_role_coverage_status
),
staging_validation AS (
  SELECT
    'process_order_staging_validation' AS health_area,
    CASE
      WHEN coalesce(sum(CASE WHEN validation_status = 'NOT_VALIDATED' THEN 1 ELSE 0 END), 0) > 0 THEN 'FAIL'
      WHEN coalesce(sum(CASE WHEN validation_status = 'NOT_APPLICABLE' THEN 1 ELSE 0 END), 0) > 0 THEN 'WARN'
      ELSE 'OK'
    END AS health_status,
    count(*) AS affected_row_count,
    coalesce(sum(CASE WHEN validation_status = 'NOT_VALIDATED' THEN 1 ELSE 0 END), 0) AS critical_issue_count,
    coalesce(sum(CASE WHEN validation_status = 'NOT_APPLICABLE' THEN 1 ELSE 0 END), 0) AS warning_issue_count,
    max(sample_window_end) AS latest_observed_at,
    'BETYP=''F'' source-reference validation for process-order staging' AS details
  FROM gold_process_order_staging_validation
),
stock_reconciliation AS (
  SELECT
    'stock_reconciliation' AS health_area,
    CASE
      WHEN coalesce(sum(CASE WHEN mismatch_severity IN ('HIGH', 'CRITICAL') THEN exception_count ELSE 0 END), 0) > 0 THEN 'FAIL'
      WHEN coalesce(sum(CASE WHEN mismatch_severity NOT IN ('INFO', 'HIGH', 'CRITICAL') THEN exception_count ELSE 0 END), 0) > 0 THEN 'WARN'
      ELSE 'OK'
    END AS health_status,
    coalesce(sum(exception_count), 0) AS affected_row_count,
    coalesce(sum(CASE WHEN mismatch_severity IN ('HIGH', 'CRITICAL') THEN exception_count ELSE 0 END), 0) AS critical_issue_count,
    coalesce(sum(CASE WHEN mismatch_severity NOT IN ('INFO', 'HIGH', 'CRITICAL') THEN exception_count ELSE 0 END), 0) AS warning_issue_count,
    current_timestamp() AS latest_observed_at,
    concat('absolute delta quantity total=', cast(round(coalesce(sum(abs_delta_quantity_total), 0.0), 3) AS string)) AS details
  FROM gold_stock_reconciliation_summary_v2
),
expectations AS (
  SELECT
    'expectations' AS health_area,
    'EVENT_LOG' AS health_status,
    cast(NULL AS BIGINT) AS affected_row_count,
    cast(NULL AS BIGINT) AS critical_issue_count,
    cast(NULL AS BIGINT) AS warning_issue_count,
    current_timestamp() AS latest_observed_at,
    'DLT expectation violations are available in the pipeline event log' AS details
)
SELECT * FROM freshness
UNION ALL SELECT * FROM storage_coverage
UNION ALL SELECT * FROM staging_validation
UNION ALL SELECT * FROM stock_reconciliation
UNION ALL SELECT * FROM expectations;
