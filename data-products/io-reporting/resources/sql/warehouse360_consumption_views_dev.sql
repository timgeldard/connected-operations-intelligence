-- Warehouse360 Consumption Views (DEV)
-- Target: connected_plant_dev.gold_io_reporting
-- Purpose: app/dashboard-facing governed consumption views.

USE CATALOG connected_plant_dev;
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
FROM connected_plant_dev.gold_io_reporting.gold_warehouse_kpi_snapshot_secured
WHERE plant_code IS NOT NULL;

GRANT SELECT ON VIEW vw_consumption_warehouse360_overview TO `users`;


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
FROM connected_plant_dev.gold_io_reporting.gold_inbound_po_line_backlog_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_inbound_backlog TO `users`;


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
FROM connected_plant_dev.gold_io_reporting.gold_delivery_pick_status_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_outbound_backlog TO `users`;


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
FROM connected_plant_dev.gold_io_reporting.gold_process_order_staging_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_staging_workload TO `users`;


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
FROM connected_plant_dev.gold_io_reporting.gold_stock_expiry_risk_live;

GRANT SELECT ON VIEW vw_consumption_warehouse360_stock_exceptions TO `users`;


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
FROM connected_plant_dev.gold_io_reporting.gold_transfer_requirement_material_backlog_secured;

GRANT SELECT ON VIEW vw_consumption_warehouse360_shortfalls TO `users`;


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
-- Read the SECURED view so per-user plant RLS applies before aggregation (not the base table).
FROM connected_plant_dev.gold_io_reporting.gold_warehouse_exceptions_secured
GROUP BY plant_code, material_code, batch_number, exception_type;

GRANT SELECT ON VIEW vw_consumption_warehouse360_im_wm_reconciliation TO `users`;


-- 8. Dispensary Queue
-- vw_consumption_warehouse360_dispensary_queue
-- NOT DEPLOYED IN WAVE 1.
-- Source and grain are not confirmed.
-- Contract remains draft / not_runtime_ready.
