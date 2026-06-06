-- Warehouse360 DEV Contract Compatibility Verification
-- Target Catalog: connected_plant_dev
-- Target Schema: gold_io_reporting

-- This script validates that the columns present in the views match the contracts.
-- Output should be manually verified against app_contract_manifest.yml fields.

-- 1. Check overview columns
SELECT
  'warehouse360.overview' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'snapshot_ts') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_overview'
ORDER BY ordinal_position;

-- 2. Check inbound_backlog columns
SELECT
  'warehouse360.inbound_backlog' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'po_id', 'po_item') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_inbound_backlog'
ORDER BY ordinal_position;

-- 3. Check outbound_backlog columns
SELECT
  'warehouse360.outbound_backlog' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'delivery_id') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_outbound_backlog'
ORDER BY ordinal_position;

-- 4. Check staging_workload columns
SELECT
  'warehouse360.staging_workload' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'order_id', 'reservation_no', 'batch_id') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_staging_workload'
ORDER BY ordinal_position;

-- 5. Check stock_exceptions columns
SELECT
  'warehouse360.stock_exceptions' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'material_id', 'batch_id', 'storage_loc', 'exception_type') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_stock_exceptions'
ORDER BY ordinal_position;

-- 6. Check shortfalls columns
SELECT
  'warehouse360.shortfalls' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'material_id') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_shortfalls'
ORDER BY ordinal_position;

-- 7. Check im_wm_reconciliation columns
SELECT
  'warehouse360.im_wm_reconciliation' AS contract_id,
  column_name,
  data_type,
  CASE
    WHEN column_name IN ('plant_id', 'material_id', 'batch_id', 'storage_loc', 'bin_id', 'exception_type') THEN 'REQUIRED'
    ELSE 'OPTIONAL'
  END AS contract_requirement
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name = 'vw_consumption_warehouse360_im_wm_reconciliation'
ORDER BY ordinal_position;
