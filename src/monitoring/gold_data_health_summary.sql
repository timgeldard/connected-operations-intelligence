-- Companion SQL for the Gold data health summary.
-- Source of truth for the Lakeflow pipeline: gold/freshness.py.
-- Use this only when recreating the Python DLT rollup as a SQL materialized view.

CREATE OR REFRESH MATERIALIZED VIEW gold_data_health_summary AS
SELECT
  'freshness' AS health_area,
  CASE
    WHEN sum(CASE WHEN criticality = 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END) > 0 THEN 'FAIL'
    WHEN sum(CASE WHEN criticality <> 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END) > 0 THEN 'WARN'
    ELSE 'OK'
  END AS health_status,
  count(*) AS affected_row_count,
  sum(CASE WHEN criticality = 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END) AS critical_issue_count,
  sum(CASE WHEN criticality <> 'critical' AND freshness_status IN ('STALE', 'NO_DATA') THEN 1 ELSE 0 END) AS warning_issue_count,
  max(checked_at) AS latest_observed_at,
  concat('monitored Silver dependencies=', cast(count(*) AS string)) AS details
FROM gold_data_freshness_status

UNION ALL

SELECT
  'expectations' AS health_area,
  'EVENT_LOG' AS health_status,
  NULL AS affected_row_count,
  NULL AS critical_issue_count,
  NULL AS warning_issue_count,
  current_timestamp() AS latest_observed_at,
  'DLT expectation violations are available in the pipeline event log' AS details;
