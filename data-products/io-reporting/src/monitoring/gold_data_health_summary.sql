-- Monitoring wrapper for the Gold data health summary.
-- Full SQL companion lives in ../gold/gold_data_health_summary.sql.
-- Production Lakeflow source of truth lives in gold/freshness.py.

CREATE OR REPLACE VIEW monitoring_gold_data_health_summary AS
SELECT
  health_area,
  health_status,
  affected_row_count,
  critical_issue_count,
  warning_issue_count,
  latest_observed_at,
  details
FROM gold_data_health_summary;
