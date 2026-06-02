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
  FROM connected_plant_uat.gold.gold_stock_expiry_risk
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_expiry_risk_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_shift_output_summary_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_shift_output_summary
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_shift_output_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_process_order_schedule_adherence_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_process_order_schedule_adherence
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_process_order_schedule_adherence_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_plant_production_quality_summary_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_plant_production_quality_summary
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_plant_production_quality_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_process_order_operations_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_process_order_operations
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_process_order_operations_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_dispensary_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_dispensary_backlog
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_dispensary_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_lineside_stock_secured AS
  SELECT
    *,
    CASE WHEN earliest_expiry_date IS NOT NULL THEN datediff(earliest_expiry_date, current_date()) END AS min_days_to_expiry
  FROM connected_plant_uat.gold.gold_lineside_stock
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_lineside_stock_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_delivery_pick_status_secured AS
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
  FROM connected_plant_uat.gold.gold_delivery_pick_status
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_delivery_pick_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_reconciliation_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_reconciliation
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_process_order_staging_secured AS
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
  FROM connected_plant_uat.gold.gold_process_order_staging
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_process_order_staging_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_process_order_staging_validation_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_process_order_staging_validation
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_process_order_staging_validation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_storage_type_role_coverage_status_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_storage_type_role_coverage_status
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_storage_type_role_coverage_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_reconciliation_v2_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_reconciliation_v2
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_reconciliation_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_reconciliation_exceptions_v2_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_reconciliation_exceptions_v2
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_reconciliation_exceptions_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold.gold_stock_reconciliation_summary_v2_secured AS
  SELECT * FROM connected_plant_uat.gold.gold_stock_reconciliation_summary_v2
  WHERE connected_plant_uat.silver.plant_access_filter(plant_code);
GRANT SELECT ON VIEW connected_plant_uat.gold.gold_stock_reconciliation_summary_v2_secured TO `users`;

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

-- ── Base-table access hardening ──
-- The actual REVOKE statements are generated as a SEPARATE admin script
-- (resources/sql/gold_security_harden_uat.sql). Apply it AFTER this script so plant-scoped users
-- can only read the row-filtered *_secured views, not the un-trimmed base Gold tables (ADR 012).
-- It is kept separate because revoking broad access is operationally sensitive and irreversible-ish.
