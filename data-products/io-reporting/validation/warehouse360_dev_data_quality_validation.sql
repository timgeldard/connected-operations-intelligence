-- Warehouse360 DEV Data Quality Validation
-- Target Schema: connected_plant_dev.gold_io_reporting

-- 1. Check null count for plant_id (Canonical plant scope field)
SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview
UNION ALL
SELECT
  'vw_consumption_warehouse360_inbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog
UNION ALL
SELECT
  'vw_consumption_warehouse360_outbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog
UNION ALL
SELECT
  'vw_consumption_warehouse360_staging_workload' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload
UNION ALL
SELECT
  'vw_consumption_warehouse360_stock_exceptions' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions
UNION ALL
SELECT
  'vw_consumption_warehouse360_shortfalls' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls
UNION ALL
SELECT
  'vw_consumption_warehouse360_im_wm_reconciliation' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;

-- 2. Check null counts for required candidate-key columns
SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN snapshot_ts IS NULL THEN 1 ELSE 0 END) AS null_snapshot_ts_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

SELECT
  'vw_consumption_warehouse360_inbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN po_id IS NULL THEN 1 ELSE 0 END) AS null_po_id_count,
  SUM(CASE WHEN po_item IS NULL THEN 1 ELSE 0 END) AS null_po_item_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog;

SELECT
  'vw_consumption_warehouse360_outbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN delivery_id IS NULL THEN 1 ELSE 0 END) AS null_delivery_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog;

SELECT
  'vw_consumption_warehouse360_staging_workload' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN order_id IS NULL THEN 1 ELSE 0 END) AS null_order_id_count,
  SUM(CASE WHEN reservation_no IS NULL THEN 1 ELSE 0 END) AS null_reservation_no_count,
  SUM(CASE WHEN batch_id IS NULL THEN 1 ELSE 0 END) AS null_batch_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload;

SELECT
  'vw_consumption_warehouse360_stock_exceptions' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN material_id IS NULL THEN 1 ELSE 0 END) AS null_material_id_count,
  SUM(CASE WHEN batch_id IS NULL THEN 1 ELSE 0 END) AS null_batch_id_count,
  SUM(CASE WHEN storage_loc IS NULL THEN 1 ELSE 0 END) AS null_storage_loc_count,
  SUM(CASE WHEN exception_type IS NULL THEN 1 ELSE 0 END) AS null_exception_type_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions;

SELECT
  'vw_consumption_warehouse360_shortfalls' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN material_id IS NULL THEN 1 ELSE 0 END) AS null_material_id_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls;

SELECT
  'vw_consumption_warehouse360_im_wm_reconciliation' AS view_name,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_count,
  SUM(CASE WHEN material_id IS NULL THEN 1 ELSE 0 END) AS null_material_id_count,
  SUM(CASE WHEN batch_id IS NULL THEN 1 ELSE 0 END) AS null_batch_id_count,
  SUM(CASE WHEN storage_loc IS NULL THEN 1 ELSE 0 END) AS null_storage_loc_count,
  SUM(CASE WHEN bin_id IS NULL THEN 1 ELSE 0 END) AS null_bin_id_count,
  SUM(CASE WHEN exception_type IS NULL THEN 1 ELSE 0 END) AS null_exception_type_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;

-- 3. Validate date/timestamp column typing (checks if date/time columns are string-typed)
SELECT
  table_name,
  column_name,
  data_type
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name LIKE 'vw_consumption_warehouse360_%'
  AND (
    lower(column_name) LIKE '%date%'
    OR lower(column_name) LIKE '%time%'
    OR lower(column_name) LIKE '%ts%'
  )
ORDER BY table_name, column_name;

-- 4. Freshness metadata verification (overview view only, since it has snapshot_ts)
SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  MAX(snapshot_ts) AS latest_snapshot_ts,
  current_timestamp() AS checked_at,
  timestampdiff(MINUTE, MAX(snapshot_ts), current_timestamp()) AS freshness_age_minutes
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 5. Sample non-sensitive rows from each view
SELECT 'SAMPLE - overview' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview LIMIT 5;
SELECT 'SAMPLE - inbound' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog LIMIT 5;
SELECT 'SAMPLE - outbound' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog LIMIT 5;
SELECT 'SAMPLE - staging' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload LIMIT 5;
SELECT 'SAMPLE - stock_exceptions' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions LIMIT 5;
SELECT 'SAMPLE - shortfalls' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls LIMIT 5;
SELECT 'SAMPLE - reconciliation' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation LIMIT 5;
