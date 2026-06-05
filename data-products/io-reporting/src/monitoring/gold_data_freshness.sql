-- Companion SQL for the Gold freshness monitor.
-- Source of truth for the Lakeflow pipeline: gold/freshness.py.
-- This view is intended for SQL workspace exploration in a Gold schema where
-- gold_data_freshness_status is already produced by the pipeline.

CREATE OR REPLACE VIEW gold_data_freshness AS
SELECT
  table_name,
  domain,
  criticality,
  latest_replicated_at,
  max_lag_minutes,
  freshness_sla_minutes,
  freshness_status,
  is_stale,
  checked_at
FROM gold_data_freshness_status;
