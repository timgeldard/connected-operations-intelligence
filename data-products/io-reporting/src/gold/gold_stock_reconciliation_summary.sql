-- Companion Databricks SQL definition for the canonical stock reconciliation summary.
-- The production Lakeflow table is implemented in gold/warehouse_flow_gold.py as
-- gold_stock_reconciliation_summary and is backed by gold_stock_reconciliation_v2.

CREATE OR REFRESH MATERIALIZED VIEW gold_stock_reconciliation_summary AS
SELECT
  plant_code,
  warehouse_number,
  mismatch_reason,
  mismatch_severity,
  count(*) AS row_count,
  sum(CASE WHEN NOT is_reconciled THEN 1 ELSE 0 END) AS exception_count,
  coalesce(sum(abs_delta_quantity), 0.0) AS abs_delta_quantity_total,
  coalesce(sum(abs(delta_value)), 0.0) AS abs_delta_value_total,
  CASE
    WHEN sum(CASE WHEN NOT is_reconciled THEN 1 ELSE 0 END) = 0 THEN 'RECONCILED'
    WHEN mismatch_severity IN ('HIGH', 'CRITICAL') THEN 'ACTION_REQUIRED'
    ELSE 'REVIEW'
  END AS reconciliation_status
FROM gold_stock_reconciliation_v2
GROUP BY
  plant_code,
  warehouse_number,
  mismatch_reason,
  mismatch_severity;
