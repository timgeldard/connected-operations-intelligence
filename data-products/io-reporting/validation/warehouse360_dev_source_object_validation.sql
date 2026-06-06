-- Warehouse360 DEV source object validation
-- Target: connected_plant_dev.gold_io_reporting
-- Purpose: confirm internal governed source objects exist before deploying consumption views.

-- 1. Existing source objects and object types
SELECT
  table_catalog,
  table_schema,
  table_name,
  table_type
FROM connected_plant_dev.information_schema.tables
WHERE table_schema = 'gold_io_reporting'
  AND table_name IN (
    'gold_warehouse_kpi_snapshot_secured',
    'gold_inbound_po_backlog_enhanced_live',
    'gold_delivery_pick_status_live',
    'gold_process_order_staging_live',
    'gold_stock_expiry_risk_live',
    'gold_transfer_requirement_backlog',
    'gold_warehouse_exceptions'
  )
ORDER BY table_name;

-- 2. Required source object status
WITH expected_source_objects AS (
  SELECT 'gold_warehouse_kpi_snapshot_secured' AS table_name UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live' UNION ALL
  SELECT 'gold_delivery_pick_status_live' UNION ALL
  SELECT 'gold_process_order_staging_live' UNION ALL
  SELECT 'gold_stock_expiry_risk_live' UNION ALL
  SELECT 'gold_transfer_requirement_backlog' UNION ALL
  SELECT 'gold_warehouse_exceptions'
),
actual_source_objects AS (
  SELECT table_name
  FROM connected_plant_dev.information_schema.tables
  WHERE table_schema = 'gold_io_reporting'
)
SELECT
  e.table_name,
  CASE WHEN a.table_name IS NULL THEN 'MISSING' ELSE 'FOUND' END AS validation_status
FROM expected_source_objects e
LEFT JOIN actual_source_objects a
  ON e.table_name = a.table_name
ORDER BY e.table_name;
