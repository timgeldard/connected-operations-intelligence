-- Warehouse360 DEV schema validation
-- Target Catalog: connected_plant_dev
-- Target Schema: gold_io_reporting

-- 1. Check all Warehouse360 consumption views existence
SELECT
  table_catalog,
  table_schema,
  table_name,
  table_type
FROM connected_plant_dev.information_schema.views
WHERE table_schema = 'gold_io_reporting'
  AND table_name LIKE 'vw_consumption_warehouse360_%'
ORDER BY table_name;

-- 2. Verify all columns and types for consumption views
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'gold_io_reporting'
  AND table_name LIKE 'vw_consumption_warehouse360_%'
ORDER BY table_name, ordinal_position;
