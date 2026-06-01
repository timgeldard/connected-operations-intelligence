-- Unity Catalog Gold row-level security — secured serving views (UAT).
-- Run once as a Unity Catalog admin after the first uat deploy. Re-runnable.
-- Requires: the plant_access_filter function (created by resources/sql/row_filter_uat.sql)
--           and CREATE VIEW on connected_plant_uat.gold.
-- WARNING: Generated automatically by scripts/generate_gold_security_sql.py. Do not edit manually.
--
-- Model: Gold MVs stay trusted (not row-filtered, to avoid full MV refreshes). Each plant-scoped
-- Gold table gets a <table>_secured view applying plant_access_filter(plant_code); the consumer
-- group is granted SELECT on the views only. plant_access_filter reads the *invoking* user's
-- 'allowed_plants' attribute (definer-rights view, session-scoped function), so per-plant
-- trimming is enforced at query time, and silver_admin members see all rows.

-- ── Secured views + consumer grants ──

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_transfer_order_performance_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_transfer_order_performance
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_transfer_order_performance_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_inbound_outbound_throughput_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_inbound_outbound_throughput
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_inbound_outbound_throughput_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_bin_occupancy_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_bin_occupancy
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_bin_occupancy_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_availability_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_availability
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_availability_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_transfer_requirement_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_transfer_requirement_backlog
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_transfer_requirement_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_expiry_risk_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_expiry_risk
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_expiry_risk_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_shift_output_summary_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_shift_output_summary
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_shift_output_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_order_otif_metrics_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_order_otif_metrics
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_order_otif_metrics_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_plant_production_quality_summary_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_plant_production_quality_summary
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_plant_production_quality_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_dispensary_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_dispensary_backlog
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_dispensary_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_lineside_stock_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_lineside_stock
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_lineside_stock_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_delivery_pick_status_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_delivery_pick_status
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_delivery_pick_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_reconciliation_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_reconciliation
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_process_order_staging_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_process_order_staging
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_process_order_staging_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_inbound_po_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_inbound_po_backlog
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_inbound_po_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_handling_unit_summary_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_handling_unit_summary
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_handling_unit_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_warehouse_exceptions_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_warehouse_exceptions
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_warehouse_exceptions_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_warehouse_kpi_snapshot_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_warehouse_kpi_snapshot
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_warehouse_kpi_snapshot_secured TO `users`;

-- ── Optional hardening: ensure consumers cannot read the un-trimmed base tables ──
-- Direct SELECT on the base Gold tables should be limited to the data-product owner / admins.
-- Uncomment to explicitly revoke base-table access from the consumer group (no-op if never granted):
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_transfer_order_performance FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_inbound_outbound_throughput FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_bin_occupancy FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_stock_availability FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_transfer_requirement_backlog FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_stock_expiry_risk FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_shift_output_summary FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_order_otif_metrics FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_plant_production_quality_summary FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_dispensary_backlog FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_lineside_stock FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_delivery_pick_status FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_stock_reconciliation FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_process_order_staging FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_inbound_po_backlog FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_handling_unit_summary FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_warehouse_exceptions FROM `users`;
-- REVOKE SELECT ON TABLE connected_plant_uat.gold.gold_warehouse_kpi_snapshot FROM `users`;
