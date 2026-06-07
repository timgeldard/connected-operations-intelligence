-- Warehouse360 — governed vs legacy validation (READ-ONLY).
-- Companion to docs/architecture/warehouse360-duplicate-overlap-review.md.
-- UAT warehouse e76480b94bea6ed5 (profile DEFAULT). Swap catalog for DEV/PROD.
-- Single-statement tools: run each numbered block separately. NOTHING here writes/drops/modifies.
--
-- RECORDED RESULTS (2026-06-07, UAT):
--   - gold_io_reporting schema: ABSENT in UAT (present in DEV via bootstrap). Only gold/gold_test/silver/wh360.
--   - vw_consumption_warehouse360_*: 0 found in UAT AND DEV  -> governed path not built; app runs legacy_wh360 only.
--   - Legacy connected_plant_uat.wh360: 15 views live. Profiled (route-backed 5):
--       wh360_kpi_snapshot_v       1 row,  NO plant_id/snapshot_ts (global)  -> contract PK [plant_id,snapshot_ts] = RE-GRAIN
--       wh360_inbound_v        18,834 rows, 1 plant
--       wh360_deliveries_v          1 row,  1 plant (near-empty)
--       wh360_process_orders_v     23 rows, 1 plant
--       imwm_exceptions_v   1,051,919 rows, 331 plants, 0 null  -> UNFILTERED across all plants
--   - Adapter applies WHERE plant_id=:plant_id ONLY when request.plant_id supplied (conditional, not an
--     enforced user_plant_access join) -> entitlement gap to validate.

-- ============================================================================
-- 1 — Governed serving schema present? (expect gold_io_reporting absent in UAT)
-- ============================================================================
SELECT schema_name
FROM connected_plant_uat.information_schema.schemata
WHERE lower(schema_name) RLIKE 'gold|wh360|silver'
ORDER BY schema_name;

-- ============================================================================
-- 2 — Do the governed consumption views exist anywhere? (expect ZERO rows)
--     If this returns rows, the governed path is (partially) built -> run blocks 5-9.
-- ============================================================================
SELECT table_schema, table_name, table_type
FROM connected_plant_uat.information_schema.tables
WHERE lower(table_name) LIKE 'vw_consumption_warehouse360%'
   OR lower(table_name) LIKE 'vw_genie_%'
ORDER BY table_schema, table_name;

-- ============================================================================
-- 3 — Legacy serving layer the app actually reads (expect 15 views in wh360)
-- ============================================================================
SELECT table_name, table_type
FROM connected_plant_uat.information_schema.tables
WHERE table_schema = 'wh360'
ORDER BY table_name;

-- ============================================================================
-- 4 — Profile the legacy views backing the route-covered contracts.
--     Characterises what each governed view MUST reproduce (scope, grain, volume).
-- ============================================================================
SELECT 'wh360_kpi_snapshot_v' AS v, COUNT(*) AS rows, CAST(NULL AS BIGINT) AS plants, CAST(NULL AS BIGINT) AS null_plant
FROM connected_plant_uat.wh360.wh360_kpi_snapshot_v
UNION ALL SELECT 'wh360_inbound_v',        COUNT(*), COUNT(DISTINCT plant_id), COUNT_IF(plant_id IS NULL) FROM connected_plant_uat.wh360.wh360_inbound_v
UNION ALL SELECT 'wh360_deliveries_v',     COUNT(*), COUNT(DISTINCT plant_id), COUNT_IF(plant_id IS NULL) FROM connected_plant_uat.wh360.wh360_deliveries_v
UNION ALL SELECT 'wh360_process_orders_v', COUNT(*), COUNT(DISTINCT plant_id), COUNT_IF(plant_id IS NULL) FROM connected_plant_uat.wh360.wh360_process_orders_v
UNION ALL SELECT 'imwm_exceptions_v',      COUNT(*), COUNT(DISTINCT plant_id), COUNT_IF(plant_id IS NULL) FROM connected_plant_uat.wh360.imwm_exceptions_v
ORDER BY v;

-- ============================================================================
-- TEMPLATES — run per contract ONCE the governed view exists (block 2 returns rows).
-- Replace <CATALOG>.<SCHEMA>.<VIEW> and the PK columns with the contract values.
-- These are aggregate/LIMIT, read-only.
-- ============================================================================

-- 5 — Columns (compare to app_contract_manifest.yml `fields` for the contract)
-- DESCRIBE TABLE <CATALOG>.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 6 — Row count
-- SELECT COUNT(*) AS row_count FROM <CATALOG>.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 7 — plant_id scope (global vs plant-scoped vs incorrectly unfiltered)
-- SELECT COUNT(*) AS total_rows, COUNT_IF(plant_id IS NULL) AS null_plant_id_rows,
--        COUNT(DISTINCT plant_id) AS distinct_plants
-- FROM <CATALOG>.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 8 — Primary-key uniqueness (adapt pk cols per contract; overview = plant_id, snapshot_ts)
-- SELECT COUNT(*) AS total_rows,
--        COUNT(DISTINCT CONCAT_WS('||', plant_id, snapshot_ts)) AS distinct_pk_rows,
--        COUNT(*) - COUNT(DISTINCT CONCAT_WS('||', plant_id, snapshot_ts)) AS duplicate_pk_rows
-- FROM <CATALOG>.gold_io_reporting.vw_consumption_warehouse360_overview;

-- 9 — Parity vs legacy (example: overview per-plant totals must reconcile to the legacy global KPI row).
--     Because wh360_kpi_snapshot_v is a single global row, the governed per-plant view must SUM back to it.
-- SELECT
--   (SELECT orders_total FROM connected_plant_uat.wh360.wh360_kpi_snapshot_v)                          AS legacy_orders_total,
--   (SELECT SUM(orders_total) FROM <CATALOG>.gold_io_reporting.vw_consumption_warehouse360_overview)   AS governed_orders_total;
