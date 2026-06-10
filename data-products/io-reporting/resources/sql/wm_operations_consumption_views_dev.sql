-- WM Operations Consumption Views (DEV)
-- Target: connected_plant_dev.gold_io_reporting
-- Serves the WM Operations app workspace (apps/api routes /api/wm-operations/*) via the
-- governed contract pattern: app -> vw_consumption_wm_operations_* -> *_live/_secured -> gold MV.
-- Run once as a UC admin AFTER gold_security_dev.sql and gold_serving_views_dev.sql.

USE CATALOG connected_plant_dev;
CREATE SCHEMA IF NOT EXISTS gold_io_reporting;
USE SCHEMA gold_io_reporting;

-- 1. Staging / picking worklist
-- Grain: 1 row per plant_id + warehouse_id + tr_id (TR header). RLS inherited from
-- gold_wm_staging_worklist_secured via the _live view.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_worklist AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  transfer_requirement_number AS tr_id,
  work_area,
  worklist_status,
  source_reference_type AS reference_type,
  source_reference_number AS reference_id,
  order_material_code AS order_material_id,
  CAST(order_scheduled_start_date AS DATE) AS order_scheduled_start_date,
  source_storage_type,
  source_zone,
  destination_storage_type,
  destination_zone,
  destination_bin,
  queue,
  campaign_reference AS campaign_id,
  assigned_operator,
  job_sequence,
  transfer_priority,
  created_by_user,
  CAST(created_datetime AS TIMESTAMP) AS created_ts,
  CAST(planned_execution_datetime AS TIMESTAMP) AS planned_execution_ts,
  item_count,
  open_item_count,
  material_count,
  single_material_code AS material_id,
  single_material_description AS material_name,
  required_qty,
  open_qty,
  base_uom AS uom,
  has_mixed_base_uom,
  to_item_count,
  to_items_confirmed,
  to_confirmed_qty,
  CAST(latest_to_confirmed_date AS DATE) AS latest_to_confirmed_date,
  pick_progress_fraction,
  age_hours,
  is_overdue
FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_worklist_live
WHERE plant_code IS NOT NULL;

-- 2. Worklist summary (manager KPI strip)
-- Grain: 1 row per plant_id + warehouse_id + work_area + worklist_status. No date-relative
-- columns, so it reads the _secured view directly.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_worklist_summary AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  work_area,
  worklist_status,
  tr_count,
  total_open_qty,
  total_required_qty,
  operator_count,
  CAST(earliest_planned_datetime AS TIMESTAMP) AS earliest_planned_ts,
  CAST(earliest_created_datetime AS TIMESTAMP) AS earliest_created_ts
FROM connected_plant_dev.gold_io_reporting.gold_wm_worklist_summary_secured
WHERE plant_code IS NOT NULL;

-- 3. Order staging readiness
-- Grain: 1 row per plant_id + order_id (released, not-closed process orders).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_readiness AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  warehouse_number AS warehouse_id,
  material_code AS material_id,
  material_name,
  order_quantity AS order_qty,
  uom,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  production_supply_area,
  component_count,
  wm_component_count,
  wm_component_required_qty,
  component_open_qty,
  tr_count,
  tr_required_qty,
  tr_open_qty,
  tr_coverage_status,
  psa_supplied_qty,
  supply_status,
  readiness_status,
  days_to_start,
  readiness_band
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_readiness_live
WHERE plant_code IS NOT NULL;

-- 4. Bin / stock explorer
-- Grain: 1 row per plant_id + warehouse_id + quant_id (occupied bin quants only).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_bin_stock AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  storage_type,
  storage_zone,
  bin_code AS bin_id,
  picking_area,
  quant_number AS quant_id,
  material_code AS material_id,
  material_description AS material_name,
  batch_number AS batch_id,
  stock_category,
  total_quantity AS total_qty,
  available_quantity AS available_qty,
  putaway_quantity AS putaway_qty,
  pick_quantity AS pick_qty,
  open_transfer_quantity AS open_transfer_qty,
  base_uom AS uom,
  CAST(goods_receipt_date AS DATE) AS goods_receipt_date,
  CAST(expiry_date AS DATE) AS expiry_date,
  CAST(last_movement_datetime AS TIMESTAMP) AS last_movement_ts,
  is_blocked_for_stock_removal,
  is_blocked_for_putaway,
  is_bin_blocked,
  blocking_reason_code,
  days_to_expiry,
  is_expired
FROM connected_plant_dev.gold_io_reporting.gold_wm_bin_stock_detail_live
WHERE plant_code IS NOT NULL;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_wm_operations_worklist TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_wm_operations_worklist_summary TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_wm_operations_order_readiness TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_wm_operations_bin_stock TO `warehouse360_app_users`;


-- 5. Order component detail (drill-through behind Order Readiness)
-- Grain: 1 row per plant_id + order_id + reservation_id + reservation_item.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_components AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  reservation_number AS reservation_id,
  reservation_item,
  warehouse_number AS warehouse_id,
  material_code AS material_id,
  material_description AS material_name,
  batch_number AS batch_id,
  required_quantity AS required_qty,
  open_quantity AS open_qty,
  uom,
  production_supply_area,
  CAST(requirement_date AS DATE) AS requirement_date,
  material_component_count,
  tr_count,
  tr_required_qty,
  tr_open_qty,
  tr_coverage_status,
  to_item_count,
  to_items_confirmed,
  to_confirmed_qty,
  pick_progress_fraction,
  psa_supplied_qty,
  is_supplied
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_component_detail_secured
WHERE plant_code IS NOT NULL;

-- 6. Operator activity (pick performance history)
-- Grain: 1 row per plant_id + warehouse_id + operator + activity_date.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_operator_activity AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  operator,
  CAST(activity_date AS DATE) AS activity_date,
  items_confirmed,
  transfer_orders,
  materials,
  transfer_requirements,
  confirmed_qty
FROM connected_plant_dev.gold_io_reporting.gold_wm_operator_activity_secured
WHERE plant_code IS NOT NULL;

-- 7. Queue workload (current open jobs by queue and work area)
-- Grain: 1 row per plant_id + warehouse_id + queue + work_area.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_queue_workload AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  queue,
  work_area,
  open_jobs,
  in_progress_jobs,
  parked_jobs,
  no_stock_jobs,
  operator_count,
  CAST(earliest_planned_datetime AS TIMESTAMP) AS earliest_planned_ts,
  CAST(earliest_created_datetime AS TIMESTAMP) AS earliest_created_ts
FROM connected_plant_dev.gold_io_reporting.gold_wm_queue_workload_secured
WHERE plant_code IS NOT NULL;

-- 8. Outbound delivery picking board (reuses the existing delivery-pick gold + live bands)
-- Grain: 1 row per plant_id + delivery_id.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_outbound AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  delivery_number AS delivery_id,
  delivery_type,
  ship_to_customer AS ship_to_customer_id,
  ship_to_customer_name,
  line_count,
  delivery_qty,
  picked_qty,
  pick_fraction,
  has_mixed_base_uom,
  CAST(planned_goods_issue_date AS DATE) AS planned_goods_issue_date,
  CAST(actual_goods_issue_date AS DATE) AS actual_goods_issue_date,
  is_shipped,
  days_to_goods_issue,
  risk_band
FROM connected_plant_dev.gold_io_reporting.gold_delivery_pick_status_live
WHERE plant_code IS NOT NULL;

-- 9. Reconciliation alerts (shift-handover digest input; severe IM<->WM / PI variances)
-- Grain: 1 row per alert_key.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recon_alerts AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  alert_key,
  alert_type,
  alert_priority,
  material_code AS material_id,
  batch_number AS batch_id,
  reason_code,
  delta_quantity AS delta_qty,
  delta_value
FROM connected_plant_dev.gold_io_reporting.gold_reconciliation_alerts_secured
WHERE plant_code IS NOT NULL;
