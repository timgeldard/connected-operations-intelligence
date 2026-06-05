-- Unity Catalog Gold row-level security — secured serving views (DEV).
-- Run once as a Unity Catalog admin after the first dev deploy. Re-runnable.
-- Requires: CREATE VIEW on connected_plant_dev.gold_dev.
-- WARNING: Generated automatically by scripts/generate_gold_security_sql.py. Do not edit manually.
--
-- Model: Gold MVs stay trusted (not row-filtered, to avoid full MV refreshes). Each plant-scoped
-- Gold table gets a <table>_secured view that enforces plant access via published_<env>.security.model
-- (application_key = 'io_reporting'). access_type 'full view' = all plants; 'filter' = filter_plant
-- array. Dev secured views are pass-through (no security model available in dev).
-- Consumers ('users' group) are granted SELECT on the *_secured views only.

-- ── Secured views + consumer grants ──

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_transfer_order_performance_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_transfer_order_performance;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_transfer_order_performance_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_inbound_outbound_throughput_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_inbound_outbound_throughput;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_inbound_outbound_throughput_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_bin_occupancy_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_bin_occupancy;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_bin_occupancy_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_availability_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_availability;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_availability_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_transfer_requirement_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_transfer_requirement_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_transfer_requirement_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_expiry_risk_secured AS
  SELECT
    plant_code,
    material_code,
    material_description,
    batch_number,
    base_uom,
    minimum_expiry_date,
    earliest_goods_receipt_date,
    datediff(minimum_expiry_date, current_date()) AS minimum_days_to_expiry,
    shelf_life_days,
    minimum_remaining_shelf_life_days,
    total_stock_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) < 0 THEN total_stock_qty END,
      0.0
    ) AS expired_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 0 AND datediff(minimum_expiry_date, current_date()) < 7 THEN total_stock_qty END,
      0.0
    ) AS expiry_risk_lt_7d_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 7 AND datediff(minimum_expiry_date, current_date()) < 30 THEN total_stock_qty END,
      0.0
    ) AS expiry_risk_7_30d_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 30 AND datediff(minimum_expiry_date, current_date()) < 90 THEN total_stock_qty END,
      0.0
    ) AS expiry_risk_30_90d_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) >= 90 THEN total_stock_qty END,
      0.0
    ) AS expiry_ok_qty,
    coalesce(
      CASE WHEN datediff(minimum_expiry_date, current_date()) < coalesce(minimum_remaining_shelf_life_days, 0) THEN total_stock_qty END,
      0.0
    ) AS minimum_shelf_life_breach_qty,
    CASE
      WHEN datediff(minimum_expiry_date, current_date()) < 0 THEN 'EXPIRED'
      WHEN datediff(minimum_expiry_date, current_date()) < 7 THEN 'LT_7_DAYS'
      WHEN datediff(minimum_expiry_date, current_date()) < 30 THEN 'DAYS_7_30'
      WHEN datediff(minimum_expiry_date, current_date()) < 90 THEN 'DAYS_30_90'
      ELSE 'OK'
    END AS highest_expiry_risk_bucket,
    coalesce(datediff(minimum_expiry_date, current_date()) < coalesce(minimum_remaining_shelf_life_days, 0), false) AS has_minimum_shelf_life_breach
  FROM connected_plant_dev.gold_dev.gold_stock_expiry_risk;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_expiry_risk_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_shift_output_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_shift_output_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_shift_output_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_process_order_schedule_adherence_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_process_order_schedule_adherence;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_process_order_schedule_adherence_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_plant_production_quality_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_plant_production_quality_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_plant_production_quality_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_process_order_operations_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_process_order_operations;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_process_order_operations_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_order_downtime_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_order_downtime_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_order_downtime_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_process_order_component_status_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_process_order_component_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_process_order_component_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_dispensary_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_dispensary_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_dispensary_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_lineside_stock_secured AS
  SELECT
    *,
    CASE WHEN earliest_expiry_date IS NOT NULL THEN datediff(earliest_expiry_date, current_date()) END AS min_days_to_expiry
  FROM connected_plant_dev.gold_dev.gold_lineside_stock;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_lineside_stock_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_delivery_pick_status_secured AS
  SELECT
    delivery_number,
    plant_code,
    warehouse_number,
    delivery_type,
    sold_to_customer,
    planned_goods_issue_date,
    line_count,
    delivery_qty,
    picked_qty,
    pick_fraction,
    is_shipped,
    datediff(planned_goods_issue_date, current_date()) AS days_to_goods_issue,
    CASE
      WHEN is_shipped THEN 'green'
      WHEN planned_goods_issue_date IS NULL THEN 'grey'
      WHEN coalesce(pick_fraction, 0.0) < 0.5 AND datediff(planned_goods_issue_date, current_date()) <= 0 THEN 'red'
      WHEN coalesce(pick_fraction, 0.0) < 0.8 AND datediff(planned_goods_issue_date, current_date()) <= 1 THEN 'amber'
      ELSE 'green'
    END AS risk_band
  FROM connected_plant_dev.gold_dev.gold_delivery_pick_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_delivery_pick_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_process_order_staging_secured AS
  SELECT
    order_number,
    plant_code,
    material_code,
    order_quantity,
    scheduled_start_date,
    scheduled_finish_date,
    to_items_total,
    to_items_done,
    staging_fraction,
    is_operationally_trusted,
    datediff(scheduled_start_date, current_date()) AS days_to_start,
    CASE
      WHEN NOT coalesce(is_operationally_trusted, false) THEN 'unvalidated'
      WHEN to_items_total = 0 THEN 'grey'
      WHEN scheduled_start_date IS NULL THEN 'grey'
      WHEN coalesce(staging_fraction, 0.0) < 0.3 AND datediff(scheduled_start_date, current_date()) <= 0 THEN 'red'
      WHEN coalesce(staging_fraction, 0.0) < 0.7 AND datediff(scheduled_start_date, current_date()) <= 1 THEN 'amber'
      ELSE 'green'
    END AS risk_band
  FROM connected_plant_dev.gold_dev.gold_process_order_staging;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_process_order_staging_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_process_order_staging_validation_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_process_order_staging_validation;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_process_order_staging_validation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_storage_type_role_coverage_status_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_storage_type_role_coverage_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_storage_type_role_coverage_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_v2_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_reconciliation_v2;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_value_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_value_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_value_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_reconciliation_audit_log_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_reconciliation_audit_log;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_reconciliation_audit_log_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_movement_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_movement_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_movement_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_hu_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_hu_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_hu_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_physical_inventory_recon_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_physical_inventory_recon;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_physical_inventory_recon_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_reconciliation_alerts_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_reconciliation_alerts;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_reconciliation_alerts_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_exceptions_v2_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_reconciliation_exceptions_v2;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_exceptions_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_summary_v2_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_reconciliation_summary_v2;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_summary_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_stock_reconciliation_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_stock_reconciliation_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_inbound_po_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_inbound_po_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_inbound_po_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_inbound_po_backlog_enhanced_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_inbound_po_backlog_enhanced;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_inbound_po_backlog_enhanced_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_handling_unit_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_handling_unit_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_handling_unit_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_warehouse_exceptions_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_warehouse_exceptions;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_warehouse_exceptions_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_dev.gold_warehouse_kpi_snapshot_secured AS
  SELECT * FROM connected_plant_dev.gold_dev.gold_warehouse_kpi_snapshot;
GRANT SELECT ON VIEW connected_plant_dev.gold_dev.gold_warehouse_kpi_snapshot_secured TO `users`;

-- ── Base-table access hardening ──
-- The actual REVOKE statements are generated as a SEPARATE admin script
-- (resources/sql/gold_security_harden_dev.sql). Apply it AFTER this script so plant-scoped users
-- can only read the *_secured views, not the un-trimmed base Gold tables (ADR 012).
-- It is kept separate because revoking broad access is operationally sensitive and irreversible-ish.
