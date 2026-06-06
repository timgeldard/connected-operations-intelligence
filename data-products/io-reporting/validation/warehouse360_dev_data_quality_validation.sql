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

-- 2. Validate date/timestamp column typing (checks if date/time columns are string-typed)
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

-- 3. Freshness metadata verification (overview view only, since it has snapshot_ts)
SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  MAX(snapshot_ts) AS latest_snapshot_ts,
  current_timestamp() AS checked_at,
  timestampdiff(MINUTE, MAX(snapshot_ts), current_timestamp()) AS freshness_age_minutes
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 4. Sample non-sensitive rows from each view
SELECT 'SAMPLE - overview' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview LIMIT 5;
SELECT 'SAMPLE - inbound' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog LIMIT 5;
SELECT 'SAMPLE - outbound' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog LIMIT 5;
SELECT 'SAMPLE - staging' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload LIMIT 5;
SELECT 'SAMPLE - stock_exceptions' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions LIMIT 5;
SELECT 'SAMPLE - shortfalls' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls LIMIT 5;
SELECT 'SAMPLE - reconciliation' as label, * FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation LIMIT 5;
