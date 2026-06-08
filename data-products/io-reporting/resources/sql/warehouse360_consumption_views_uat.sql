-- Warehouse360 Consumption Views (UAT)
-- Target: connected_plant_uat.gold_io_reporting

USE CATALOG connected_plant_uat;
CREATE SCHEMA IF NOT EXISTS gold_io_reporting;
USE SCHEMA gold_io_reporting;

-- 1. Overview
-- Grain: 1 row per plant_id + snapshot_ts
CREATE OR REPLACE VIEW vw_consumption_warehouse360_overview AS
SELECT
  plant_code AS plant_id,
  CAST(snapshot_date AS TIMESTAMP) AS snapshot_ts,
  active_order_count AS orders_total,
  CAST(NULL AS LONG) AS orders_red,
  CAST(NULL AS LONG) AS orders_amber,
  open_tr_item_count AS trs_open,
  open_to_item_count AS tos_open,
  open_delivery_count AS deliveries_today,
  CAST(NULL AS LONG) AS deliveries_at_risk,
  open_inbound_item_count AS inbound_open,
  blocked_bin_count AS bins_blocked,
  total_bin_count AS bins_total,
  CAST(bin_utilisation_pct AS DECIMAL(5,2)) AS bin_util_pct
FROM connected_plant_uat.gold_io_reporting.gold_warehouse_kpi_snapshot_secured;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_overview TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_overview TO `warehouse360_dashboard_users`;


-- 2. Inbound Backlog
-- Grain: 1 row per plant_id + po_id + po_item
CREATE OR REPLACE VIEW vw_consumption_warehouse360_inbound_backlog AS
SELECT
  plant_code AS plant_id,
  po_id,
  po_item,
  doc_type,
  vendor_id,
  vendor_name,
  storage_loc,
  material_id,
  material_name,
  ordered_qty,
  gr_qty,
  uom,
  delivery_date,
  po_date,
  open_qty,
  qa_status,
  oldest_po_age_days,
  inbound_backlog_risk_band
FROM connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_enhanced_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_inbound_backlog TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_inbound_backlog TO `warehouse360_dashboard_users`;


-- 3. Outbound Backlog
-- Grain: 1 row per plant_id + delivery_id
CREATE OR REPLACE VIEW vw_consumption_warehouse360_outbound_backlog AS
SELECT
  plant_code AS plant_id,
  delivery_number AS delivery_id,
  delivery_type,
  customer_id,
  customer_name,
  planned_goods_issue_date AS planned_gi_date,
  actual_goods_issue_date AS actual_gi_date,
  delivery_date,
  gross_weight,
  pick_fraction AS pick_pct,
  line_count,
  risk_band AS risk,
  is_shipped AS shipped
FROM connected_plant_uat.gold_io_reporting.gold_delivery_pick_status_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_outbound_backlog TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_outbound_backlog TO `warehouse360_dashboard_users`;


-- 4. Staging Workload
-- Grain: 1 row per plant_id + order_id + reservation_no + batch_id (order-component level)
CREATE OR REPLACE VIEW vw_consumption_warehouse360_staging_workload AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code AS material_id,
  order_quantity AS order_qty,
  uom,
  material_name,
  scheduled_start_date AS sched_start,
  scheduled_finish_date AS sched_finish,
  staging_fraction AS staging_pct,
  to_items_total,
  to_items_done,
  days_to_start * 1440 AS mins_to_start,
  risk_band AS risk,
  reservation_no,
  batch_id,
  sap_order
FROM connected_plant_uat.gold_io_reporting.gold_process_order_staging_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_workload TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_workload TO `warehouse360_dashboard_users`;


-- 5. Stock Exceptions
-- Grain: 1 row per plant_id + material_id + batch_id + storage_location_id + exception_type
CREATE OR REPLACE VIEW vw_consumption_warehouse360_stock_exceptions AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  batch_number AS batch_id,
  storage_location_id AS storage_loc,
  highest_expiry_risk_bucket AS exception_type,
  total_stock_qty AS qty,
  minimum_days_to_expiry,
  has_minimum_shelf_life_breach
FROM connected_plant_uat.gold_io_reporting.gold_stock_expiry_risk_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_exceptions TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_exceptions TO `warehouse360_dashboard_users`;


-- 6. Shortfalls
-- Grain: 1 row per plant_id + material_id
CREATE OR REPLACE VIEW vw_consumption_warehouse360_shortfalls AS
SELECT
  plant_code AS plant_id,
  material_id,
  open_tr_qty AS shortfall_qty,
  open_tr_items AS open_items_count,
  oldest_tr_creation_date AS oldest_tr_date
FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_backlog;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_shortfalls TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_shortfalls TO `warehouse360_dashboard_users`;


-- 7. IM/WM Reconciliation
-- Grain: 1 row per plant_id + material_id + batch_id + storage_location_id + bin_id + exception_type
CREATE OR REPLACE VIEW vw_consumption_warehouse360_im_wm_reconciliation AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  batch_number AS batch_id,
  storage_location_id AS storage_loc,
  exception_type,
  severity,
  sla_hours,
  quantity AS qty,
  bin_id,
  detail AS detail_text,
  detected_date
FROM connected_plant_uat.gold_io_reporting.gold_warehouse_exceptions;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_im_wm_reconciliation TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_im_wm_reconciliation TO `warehouse360_dashboard_users`;


-- 8. Dispensary Queue
-- vw_consumption_warehouse360_dispensary_queue
-- NOT DEPLOYED IN WAVE 1.
-- Source and grain are not confirmed.
-- Contract remains draft / not_runtime_ready.
