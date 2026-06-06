-- Warehouse360 Consumption Views (UAT).
-- Target Schema: connected_plant_uat.gold_io_reporting
-- These views expose a stable, contract-compliant interface for the Warehouse360 app and dashboards.
-- They wrap the governed gold serving views to inherit RLS/plant row filters.

USE CATALOG connected_plant_uat;
USE SCHEMA gold_io_reporting;

-- 1. Overview
-- Grain: 1 row per plant_id + snapshot_ts
-- TODO: Reconcile overview source logic. If gold_kpi_snapshot_v_live is global,
-- we must map/join to plant_id once plant-level overview grain is decided by the product owner.
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

GRANT SELECT ON VIEW vw_consumption_warehouse360_overview TO `users`;


-- 2. Inbound Backlog
-- Grain: 1 row per plant_id + po_id + po_item
-- TODO: Confirm if scheduling lines require additional keys.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_inbound_backlog AS
SELECT
  plant_id,
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
  delivery_date, -- TODO: Convert from string to typed date/timestamp if possible in source
  po_date,        -- TODO: Convert from string to typed date/timestamp if possible in source
  open_qty,
  qa_status,
  oldest_po_age_days,
  inbound_backlog_risk_band
FROM connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_enhanced_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_inbound_backlog TO `users`;


-- 3. Outbound Backlog
-- Grain: 1 row per plant_id + delivery_id
CREATE OR REPLACE VIEW vw_consumption_warehouse360_outbound_backlog AS
SELECT
  plant_id,
  delivery_id,
  delivery_type,
  customer_id,
  customer_name,
  carrier,
  planned_goods_issue_date AS planned_gi_date,
  actual_goods_issue_date AS actual_gi_date,
  delivery_date, -- TODO: Convert from string to typed date/timestamp if possible in source
  gross_weight,
  pick_fraction AS pick_pct,
  line_count,
  risk_band AS risk,
  is_shipped AS shipped
FROM connected_plant_uat.gold_io_reporting.gold_delivery_pick_status_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_outbound_backlog TO `users`;


-- 4. Staging Workload
-- Grain: 1 row per plant_id + order_id + reservation_no + batch_id (order-component level)
CREATE OR REPLACE VIEW vw_consumption_warehouse360_staging_workload AS
SELECT
  plant_id,
  order_id,
  material_id,
  order_qty,
  uom,
  material_name,
  scheduled_start_date AS sched_start,
  scheduled_finish_date AS sched_finish,
  staging_fraction AS staging_pct,
  to_items_total,
  to_items_done,
  days_to_start * 1440 AS mins_to_start, -- Convert days to minutes
  risk_band AS risk,
  reservation_no,
  batch_id,
  sap_order
FROM connected_plant_uat.gold_io_reporting.gold_process_order_staging_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_workload TO `users`;


-- 5. Stock Exceptions
-- Grain: 1 row per plant_id + material_id + batch_id + storage_location_id + exception_type
CREATE OR REPLACE VIEW vw_consumption_warehouse360_stock_exceptions AS
SELECT
  plant_id,
  material_id,
  batch_id,
  storage_location_id AS storage_loc,
  highest_expiry_risk_bucket AS exception_type,
  total_stock_qty AS qty,
  minimum_days_to_expiry,
  has_minimum_shelf_life_breach
FROM connected_plant_uat.gold_io_reporting.gold_stock_expiry_risk_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_exceptions TO `users`;


-- 6. Shortfalls
-- Grain: 1 row per plant_id + material_id (or process order/material / requirement_id)
-- TODO: Verify if the grain should match transfer requirement backlog.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_shortfalls AS
SELECT
  plant_id,
  material_id,
  open_tr_qty AS shortfall_qty,
  open_tr_items AS open_items_count,
  oldest_tr_creation_date AS oldest_tr_date
FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_backlog;

GRANT SELECT ON VIEW vw_consumption_warehouse360_shortfalls TO `users`;


-- 7. IM/WM Reconciliation
-- Grain: 1 row per plant_id + material_id + batch_id + storage_location_id + bin_id + exception_type
-- TODO: Verify if gold_warehouse_exceptions is the correct source view/table name.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_im_wm_reconciliation AS
SELECT
  plant_id,
  material_id,
  batch_id,
  storage_location_id AS storage_loc,
  exception_type,
  severity,
  sla_hours,
  qty,
  bin_id,
  detail_text,
  detected_date
FROM connected_plant_uat.gold_io_reporting.gold_warehouse_exceptions;

GRANT SELECT ON VIEW vw_consumption_warehouse360_im_wm_reconciliation TO `users`;


-- 8. Dispensary Queue
-- Grain: 1 row per plant_id + process_order_id + component_id + task_id
-- TODO: Identify and map governed source view once dispensary queue is designed.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_dispensary_queue AS
SELECT
  CAST(NULL AS STRING) AS plant_id,
  CAST(NULL AS STRING) AS order_id,
  CAST(NULL AS STRING) AS component_id,
  CAST(NULL AS STRING) AS task_id,
  CAST(NULL AS STRING) AS status
LIMIT 0; -- TODO: Replace with real source view when designed

GRANT SELECT ON VIEW vw_consumption_warehouse360_dispensary_queue TO `users`;
