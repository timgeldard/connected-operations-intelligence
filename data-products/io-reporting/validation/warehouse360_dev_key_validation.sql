-- Warehouse360 DEV Primary Key Validation
-- Target Schema: connected_plant_dev.gold_io_reporting

-- 1. Overview View PK (plant_id, snapshot_ts)
SELECT
  'vw_consumption_warehouse360_overview' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, CAST(snapshot_ts AS STRING))) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, CAST(snapshot_ts AS STRING))) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 2. Inbound Backlog View PK (plant_id, po_id, po_item)
SELECT
  'vw_consumption_warehouse360_inbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, po_id, po_item)) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, po_id, po_item)) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog;

-- 3. Outbound Backlog View PK (plant_id, delivery_id)
SELECT
  'vw_consumption_warehouse360_outbound_backlog' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, delivery_id)) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, delivery_id)) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog;

-- 4. Staging Workload View PK (plant_id, order_id, reservation_no, batch_id)
SELECT
  'vw_consumption_warehouse360_staging_workload' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, order_id, reservation_no, batch_id)) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, order_id, reservation_no, batch_id)) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_staging_workload;

-- 5. Stock Exceptions View PK (plant_id, material_id, batch_id, storage_loc, exception_type)
SELECT
  'vw_consumption_warehouse360_stock_exceptions' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, material_id, batch_id, storage_loc, exception_type)) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, material_id, batch_id, storage_loc, exception_type)) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions;

-- 6. Shortfalls View PK (plant_id, material_id)
SELECT
  'vw_consumption_warehouse360_shortfalls' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, material_id)) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, material_id)) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_shortfalls;

-- 7. IM/WM Reconciliation View PK (plant_id, material_id, batch_id, storage_loc, bin_id, exception_type)
SELECT
  'vw_consumption_warehouse360_im_wm_reconciliation' AS view_name,
  COUNT(*) AS total_rows,
  COUNT(DISTINCT concat_ws('||', plant_id, material_id, batch_id, storage_loc, bin_id, exception_type)) AS distinct_key_count,
  COUNT(*) - COUNT(DISTINCT concat_ws('||', plant_id, material_id, batch_id, storage_loc, bin_id, exception_type)) AS duplicate_key_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation;
