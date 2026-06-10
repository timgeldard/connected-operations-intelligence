-- Warehouse360 Consumption Views (UAT)
-- Target: connected_plant_uat.gold_io_reporting

USE CATALOG connected_plant_uat;
CREATE SCHEMA IF NOT EXISTS gold_io_reporting;
USE SCHEMA gold_io_reporting;

-- 1. Overview
-- Grain: 1 row per plant_id + snapshot_ts. Rows with NULL plant_code are excluded (ADR-0004 D7):
-- a plant-less KPI-snapshot row cannot be plant-scoped/RLS'd and collapses to a duplicate (NULL,
-- snapshot_ts) PK. Excluding them is documented contract behaviour (overview is per mapped plant).
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
-- _live adds the query-time snapshot_date over the RLS-secured view (base MV is deterministic).
FROM connected_plant_uat.gold_io_reporting.gold_warehouse_kpi_snapshot_live
WHERE plant_code IS NOT NULL;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_overview TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_overview TO `warehouse360_dashboard_users`;


-- 2. Inbound Backlog
-- Grain: 1 row per plant_id + po_id + po_item (PO-line — ADR-0004 D1, gold_inbound_po_line_backlog).
-- First-wave CORE fields only; gr_qty/open_qty (need GR aggregation), delivery_date (EKET schedule),
-- qa_status, and vendor_name are future enrichment (deferred — not yet sourced at PO-line grain).
CREATE OR REPLACE VIEW vw_consumption_warehouse360_inbound_backlog AS
SELECT
  plant_code AS plant_id,
  po_id,
  po_item,
  doc_type,
  vendor_id,
  storage_loc,
  material_id,
  material_name,
  ordered_qty,
  uom,
  po_date,
  oldest_po_age_days,
  inbound_backlog_risk_band
FROM connected_plant_uat.gold_io_reporting.gold_inbound_po_line_backlog_live;

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
-- Grain: 1 row per plant_id + order_id (ORDER-grain first wave — ADR-0004 D3). gold_process_order_staging
-- is order-grain; the component-grain fields reservation_no/batch_id and the semantic-duplicate sap_order
-- are deferred to a future component-grain contract (vw_consumption_warehouse360_staging_components).
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
  risk_band AS risk
FROM connected_plant_uat.gold_io_reporting.gold_process_order_staging_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_workload TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_workload TO `warehouse360_dashboard_users`;


-- 5. Stock Exceptions
-- Grain: 1 row per plant_id + material_id + batch_id + exception_type
-- storage_location_id removed from first wave (ADR-0004 D5): gold_stock_expiry_risk is WM-bin x material x
-- batch and carries no IM (LGORT) storage location. Future-enrichment candidate.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_stock_exceptions AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  batch_number AS batch_id,
  highest_expiry_risk_bucket AS exception_type,
  total_stock_qty AS qty,
  minimum_days_to_expiry,
  has_minimum_shelf_life_breach
FROM connected_plant_uat.gold_io_reporting.gold_stock_expiry_risk_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_exceptions TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_exceptions TO `warehouse360_dashboard_users`;


-- 6. Shortfalls
-- Grain: 1 row per plant_id + material_id (ADR-0004 D2: material-grain TR backlog,
-- gold_transfer_requirement_material_backlog; reads the RLS-secured view).
CREATE OR REPLACE VIEW vw_consumption_warehouse360_shortfalls AS
SELECT
  plant_code AS plant_id,
  material_id,
  open_tr_qty AS shortfall_qty,
  open_tr_items AS open_items_count,
  oldest_tr_creation_date AS oldest_tr_date
FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_material_backlog_secured;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_shortfalls TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_shortfalls TO `warehouse360_dashboard_users`;


-- 7. IM/WM Reconciliation (aggregate exception summary)
-- Grain: 1 row per plant_id + material_id + batch_id + exception_type
-- First-wave is an AGGREGATE summary (ADR-0004 D6): gold_warehouse_exceptions has no stable per-exception
-- row key (storage_location_id/bin_id absent; reference_id ~99% null), so detail rows are rolled up to
-- material x exception grain with measures. storage_location_id/bin_id removed from first wave. A
-- detail-grain reconciliation contract is future work, only once a stable variance key exists upstream.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_im_wm_reconciliation AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  batch_number AS batch_id,
  exception_type,
  COUNT(*) AS exception_count,
  CAST(COALESCE(SUM(quantity), 0) AS DECIMAL(18,4)) AS qty,
  MAX(severity) AS severity,
  MAX(age_days) AS max_age_days,
  MIN(detected_date) AS oldest_detected_date,
  MAX(detected_date) AS latest_detected_date,
  MAX(detail) AS detail_text
-- Read the LIVE serving view (built on the _secured view, so per-user plant RLS still applies
-- before aggregation). _live confirms the age-threshold exceptions and computes age_days /
-- detected_date at query time; the _secured rows are unconfirmed aging candidates.
FROM connected_plant_uat.gold_io_reporting.gold_warehouse_exceptions_live
GROUP BY plant_code, material_code, batch_number, exception_type;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_im_wm_reconciliation TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_im_wm_reconciliation TO `warehouse360_dashboard_users`;


-- 8. Dispensary Queue
-- vw_consumption_warehouse360_dispensary_queue
-- NOT DEPLOYED IN WAVE 1.
-- Source and grain are not confirmed.
-- Contract remains draft / not_runtime_ready.


-- 9. Stock Zones
CREATE OR REPLACE VIEW vw_consumption_warehouse360_stock_zones AS
SELECT
  plant_code AS plant_id,
  warehouse_number,
  storage_type,
  bin_type,
  bin_record_count,
  occupied_bin_count,
  empty_bin_count,
  blocked_bin_count,
  CAST(occupancy_rate AS DECIMAL(5,2)) AS occupancy_rate
FROM connected_plant_uat.gold_io_reporting.gold_bin_occupancy_secured;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_zones TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_zones TO `warehouse360_dashboard_users`;


-- 10. Batch Hold Status
CREATE OR REPLACE VIEW vw_consumption_warehouse360_batch_hold_status AS
SELECT
  plant_code AS plant_id,
  storage_location_code AS storage_location_id,
  material_code AS material_id,
  batch_number AS batch_id,
  base_uom AS uom,
  unrestricted_qty AS unrestricted_quantity,
  blocked_qty AS blocked_quantity,
  restricted_use_qty AS restricted_quantity,
  total_stock_qty AS total_quantity,
  CASE
    WHEN quality_inspection_qty > 0 THEN 'quality-inspection'
    WHEN blocked_qty > 0 THEN 'blocked'
    WHEN restricted_use_qty > 0 THEN 'blocked'
    WHEN blocked_returns_qty > 0 THEN 'returns'
    WHEN in_transfer_qty > 0 THEN 'transit'
    ELSE 'unrestricted'
  END AS stock_type,
  CASE
    WHEN quality_inspection_qty > 0 OR blocked_qty > 0 OR restricted_use_qty > 0 OR blocked_returns_qty > 0 THEN true
    ELSE false
  END AS has_blocking_hold,
  current_timestamp() AS last_updated_at
FROM connected_plant_uat.gold_io_reporting.gold_stock_availability_secured;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_batch_hold_status TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_batch_hold_status TO `warehouse360_dashboard_users`;


-- 11. Staging Readiness
CREATE OR REPLACE VIEW vw_consumption_warehouse360_staging_readiness AS
SELECT
  plant_code AS plant_id,
  CAST(scheduled_start_date AS DATE) AS plan_date,
  COUNT(*) AS total_orders,
  SUM(CASE WHEN staging_fraction = 1.0 THEN 1 ELSE 0 END) AS fully_staged,
  SUM(CASE WHEN staging_fraction > 0.0 AND staging_fraction < 1.0 THEN 1 ELSE 0 END) AS partially_staged,
  SUM(CASE WHEN staging_fraction = 0.0 THEN 1 ELSE 0 END) AS not_staged,
  SUM(CASE WHEN risk_band = 'red' THEN 1 ELSE 0 END) AS blocked
FROM connected_plant_uat.gold_io_reporting.gold_process_order_staging_live
GROUP BY plant_code, CAST(scheduled_start_date AS DATE);

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_readiness TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_readiness TO `warehouse360_dashboard_users`;


-- 12. Open Holds
-- Grain: 1 row per plant_id + warehouse_number + quant under hold (quality / blocked / restricted).
-- hold provenance (who placed it / why) is a documented data gap: no QM hold log is replicated.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_open_holds AS
SELECT
  plant_code AS plant_id,
  warehouse_number,
  storage_type,
  storage_bin,
  quant_number,
  material_code AS material_id,
  batch_number AS batch_id,
  hold_type,
  quantity,
  base_uom AS uom,
  goods_receipt_date,
  age_hours
FROM connected_plant_uat.gold_io_reporting.gold_stock_holds_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_open_holds TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_open_holds TO `warehouse360_dashboard_users`;


-- 13. Staging Pick Tasks
-- Grain: 1 row per warehouse_number + task_id (transfer order) + item_number, open items only
-- (item_status != 'Fully Confirmed'). assignee maps to confirmed_by_user when present.
CREATE OR REPLACE VIEW vw_consumption_warehouse360_pick_tasks AS
SELECT
  plant_code AS plant_id,
  warehouse_number,
  transfer_order_number AS task_id,
  item_number,
  material_code AS material_id,
  batch_number AS batch_id,
  source_storage_type,
  source_storage_bin,
  destination_storage_type,
  destination_storage_bin,
  requested_quantity,
  confirmed_quantity,
  item_status,
  created_datetime,
  order_reference_type,
  order_reference_number,
  transfer_priority,
  delivery_number,
  created_by_user,
  confirmed_by_user,
  age_hours
FROM connected_plant_uat.gold_io_reporting.gold_transfer_order_open_items_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_pick_tasks TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_pick_tasks TO `warehouse360_dashboard_users`;


-- 14. Staging Move Requests
-- Grain: 1 row per warehouse_number + request_id (transfer requirement) + item_number, open items
-- only (not processing-complete, open_quantity > 0). assignee is a documented data gap (LTBK has none).
CREATE OR REPLACE VIEW vw_consumption_warehouse360_move_requests AS
SELECT
  plant_code AS plant_id,
  warehouse_number,
  transfer_requirement_number AS request_id,
  item_number,
  material_code AS material_id,
  batch_number AS batch_id,
  source_storage_type,
  source_storage_bin,
  destination_storage_type,
  destination_storage_bin,
  required_quantity,
  open_quantity,
  created_datetime,
  planned_execution_datetime,
  queue,
  transfer_priority,
  order_reference_type,
  order_reference_number,
  age_hours
FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_open_items_live;

-- TODO_SECURITY: replace with approved group.
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_move_requests TO `warehouse360_app_users`;
-- GRANT SELECT ON VIEW vw_consumption_warehouse360_move_requests TO `warehouse360_dashboard_users`;
