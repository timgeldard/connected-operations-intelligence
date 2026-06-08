-- Warehouse360 DEV source-layer PREFLIGHT
-- Target: connected_plant_dev.gold_io_reporting (DEV workspace, profile TG, warehouse 8fae28f1808dbf75)
-- Purpose: before running the Warehouse360 validation pack, confirm the governed IOReporting
-- gold source layer actually exists in the CHOSEN schema (gold_io_reporting), is not stranded
-- in the legacy gold_dev schema, and is not split across the two. Read-only; safe to re-run.
--
-- Decision of record (ADR adr-ioreporting-dev-deployment-baseline):
--   DEV governed serving schema == connected_plant_dev.gold_io_reporting (NOT gold_dev).
--   Warehouse360 consumption views read from gold_io_reporting.

-- 1. Does the chosen serving schema exist?
SELECT
  'gold_io_reporting' AS expected_schema,
  CASE WHEN COUNT(*) > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM connected_plant_dev.information_schema.schemata
WHERE schema_name = 'gold_io_reporting';

-- 2. Does the legacy gold_dev schema still exist? (expected MISSING / unused after alignment)
SELECT
  'gold_dev' AS legacy_schema,
  CASE WHEN COUNT(*) > 0 THEN 'PRESENT (investigate — should be unused for IOReporting)' ELSE 'ABSENT' END AS status
FROM connected_plant_dev.information_schema.schemata
WHERE schema_name = 'gold_dev';

-- 3. Expected 7 Warehouse360 governed source objects, in gold_io_reporting.
WITH expected AS (
  SELECT 'gold_warehouse_kpi_snapshot_secured' AS table_name UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live' UNION ALL
  SELECT 'gold_delivery_pick_status_live' UNION ALL
  SELECT 'gold_process_order_staging_live' UNION ALL
  SELECT 'gold_stock_expiry_risk_live' UNION ALL
  SELECT 'gold_transfer_requirement_backlog' UNION ALL
  SELECT 'gold_warehouse_exceptions'
),
actual AS (
  SELECT table_name
  FROM connected_plant_dev.information_schema.tables
  WHERE table_schema = 'gold_io_reporting'
)
SELECT
  e.table_name,
  CASE WHEN a.table_name IS NULL THEN 'MISSING' ELSE 'FOUND' END AS status_in_gold_io_reporting
FROM expected e
LEFT JOIN actual a ON e.table_name = a.table_name
ORDER BY e.table_name;

-- 4. Are any of the 7 objects stranded in the legacy gold_dev schema (split-layer detection)?
SELECT
  table_schema,
  table_name,
  table_type
FROM connected_plant_dev.information_schema.tables
WHERE table_schema IN ('gold_dev', 'gold_io_reporting')
  AND table_name IN (
    'gold_warehouse_kpi_snapshot_secured',
    'gold_inbound_po_backlog_enhanced_live',
    'gold_delivery_pick_status_live',
    'gold_process_order_staging_live',
    'gold_stock_expiry_risk_live',
    'gold_transfer_requirement_backlog',
    'gold_warehouse_exceptions'
  )
ORDER BY table_name, table_schema;

-- 5. Split-layer summary: count of the 7 objects found per schema. A healthy state has all 7 in
--    gold_io_reporting and 0 in gold_dev. Anything else means the layer is split or misplaced.
SELECT
  table_schema,
  COUNT(*) AS expected_objects_found
FROM connected_plant_dev.information_schema.tables
WHERE table_schema IN ('gold_dev', 'gold_io_reporting')
  AND table_name IN (
    'gold_warehouse_kpi_snapshot_secured',
    'gold_inbound_po_backlog_enhanced_live',
    'gold_delivery_pick_status_live',
    'gold_process_order_staging_live',
    'gold_stock_expiry_risk_live',
    'gold_transfer_requirement_backlog',
    'gold_warehouse_exceptions'
  )
GROUP BY table_schema
ORDER BY table_schema;

-- 6. Does the deployed consumption-view layer (if any) read from the chosen schema? Inspect the
--    view definitions for the source schema they reference. After deployment, every active
--    vw_consumption_warehouse360_* should reference connected_plant_dev.gold_io_reporting and
--    never gold_dev.
SELECT
  table_name AS view_name,
  CASE
    WHEN view_definition ILIKE '%connected_plant_dev.gold_dev.%' THEN 'READS gold_dev — MISALIGNED'
    WHEN view_definition ILIKE '%connected_plant_dev.gold_io_reporting.%' THEN 'reads gold_io_reporting — aligned'
    ELSE 'source schema not detected'
  END AS source_alignment
FROM connected_plant_dev.information_schema.views
WHERE table_schema = 'gold_io_reporting'
  AND table_name LIKE 'vw_consumption_warehouse360_%'
ORDER BY table_name;
