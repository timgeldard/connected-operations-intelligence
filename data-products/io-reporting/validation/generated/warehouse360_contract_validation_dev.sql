-- ============================================================================
-- Contract: warehouse360.overview
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview
-- Grain: one row per plant_id + snapshot timestamp
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(snapshot_ts IS NULL) AS null_snapshot_ts_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, snapshot_ts)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, snapshot_ts)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  MAX(snapshot_ts) AS max_freshness_ts
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;

-- ============================================================================
-- Contract: warehouse360.inbound_backlog
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog
-- Grain: one row per plant_id + po_id + po_item
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog;

SELECT
  'vw_consumption_warehouse360_inbound_backlog' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog;

SELECT
  'vw_consumption_warehouse360_inbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(po_id IS NULL) AS null_po_id_rows,
  COUNT_IF(po_item IS NULL) AS null_po_item_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog;

SELECT
  'vw_consumption_warehouse360_inbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, po_id, po_item)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, po_id, po_item)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;

-- ============================================================================
-- Contract: warehouse360.outbound_backlog
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog
-- Grain: one row per plant_id and delivery ID
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog;

SELECT
  'vw_consumption_warehouse360_outbound_backlog' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog;

SELECT
  'vw_consumption_warehouse360_outbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(delivery_id IS NULL) AS null_delivery_id_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog;

SELECT
  'vw_consumption_warehouse360_outbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, delivery_id)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, delivery_id)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;

-- ============================================================================
-- Contract: warehouse360.staging_workload
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload
-- Grain: one row per plant_id and process order (order grain — first wave)
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload;

SELECT
  'vw_consumption_warehouse360_staging_workload' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload;

SELECT
  'vw_consumption_warehouse360_staging_workload' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(order_id IS NULL) AS null_order_id_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload;

SELECT
  'vw_consumption_warehouse360_staging_workload' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, order_id)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, order_id)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;

-- ============================================================================
-- Contract: warehouse360.stock_exceptions
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions
-- Grain: one row per plant_id, material_id, batch_id, and exception type
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions;

SELECT
  'vw_consumption_warehouse360_stock_exceptions' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions;

SELECT
  'vw_consumption_warehouse360_stock_exceptions' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(material_id IS NULL) AS null_material_id_rows,
  COUNT_IF(batch_id IS NULL) AS null_batch_id_rows,
  COUNT_IF(exception_type IS NULL) AS null_exception_type_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions;

SELECT
  'vw_consumption_warehouse360_stock_exceptions' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, material_id, batch_id, exception_type)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, material_id, batch_id, exception_type)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;

-- ============================================================================
-- Contract: warehouse360.shortfalls
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls
-- Grain: one row per plant_id and material_id
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls;

SELECT
  'vw_consumption_warehouse360_shortfalls' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls;

SELECT
  'vw_consumption_warehouse360_shortfalls' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(material_id IS NULL) AS null_material_id_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls;

SELECT
  'vw_consumption_warehouse360_shortfalls' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, material_id)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, material_id)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;

-- ============================================================================
-- Contract: warehouse360.im_wm_reconciliation
-- View: connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation
-- Grain: one row per plant_id, material_id, batch_id, and exception type (aggregate exception summary)
-- ============================================================================

DESCRIBE TABLE connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;

SELECT
  'vw_consumption_warehouse360_im_wm_reconciliation' AS view_name,
  COUNT(*) AS row_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;

SELECT
  'vw_consumption_warehouse360_im_wm_reconciliation' AS view_name,
  COUNT(*) AS total_rows,
  COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
  COUNT_IF(material_id IS NULL) AS null_material_id_rows,
  COUNT_IF(exception_type IS NULL) AS null_exception_type_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;

SELECT
  'vw_consumption_warehouse360_im_wm_reconciliation' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT struct(plant_id, material_id, batch_id, exception_type)) AS distinct_pk_rows,
  COUNT(*) - COUNT(DISTINCT struct(plant_id, material_id, batch_id, exception_type)) AS duplicate_pk_rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;

SELECT
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation
GROUP BY plant_id
ORDER BY rows DESC
LIMIT 20;
