-- IOReporting DEV shakedown preflight
-- Target: connected_plant_dev (DEV workspace, profile TG, warehouse 8fae28f1808dbf75)
-- Mode: dev_shakedown (enable_hu_reconciliation = false)
-- Purpose: confirm the DEV deployment has the inputs needed for a TECHNICAL shakedown of the
-- non-HU Silver/Gold layer. HU central-services tables (handlingunit_vekp/vepo) are EXTERNALLY
-- OWNED and ALLOWED to be missing in DEV — they only gate full_validation (UAT), not shakedown.
-- Read-only; safe to re-run. See docs/architecture/adr-ioreporting-dev-shakedown-vs-uat-validation.md.

-- 1. SAP source schema exists (transactional source for Silver).
SELECT
  'connected_plant_dev.sap' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  'SAP source schema required for Silver shakedown' AS note
FROM connected_plant_dev.information_schema.schemata
WHERE schema_name = 'sap';

-- 2. DEV-native reference catalog/schema exists.
SELECT
  'published_dev.central_services' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS status,
  'DEV reference data source (externally owned)' AS note
FROM published_dev.information_schema.schemata
WHERE schema_name = 'central_services';

-- 3. Required NON-HU central-services reference tables. These are needed for the slow/reference
--    Silver pipeline and the non-HU Gold shakedown. Any MISSING here is a FAIL (blocks shakedown).
WITH required_non_hu AS (
  SELECT 'plantcode_t001w' AS table_name UNION ALL
  SELECT 'customermaster_kna1' UNION ALL
  SELECT 'vendormaster_lfa1' UNION ALL
  SELECT 'warehouseforplant_t320' UNION ALL
  SELECT 'internalnumberobjectlink_inob' UNION ALL
  SELECT 'objectcharacteristics_ausp' UNION ALL
  SELECT 'characteristicvaluedescription_cawnt' UNION ALL
  SELECT 'procurementorderobject_ekko' UNION ALL
  SELECT 'procurementorderobject_ekpo'
),
actual AS (
  SELECT table_name FROM published_dev.information_schema.tables
  WHERE table_schema = 'central_services'
)
SELECT
  r.table_name,
  CASE WHEN a.table_name IS NULL THEN 'FAIL (required for shakedown)' ELSE 'PASS' END AS status
FROM required_non_hu r
LEFT JOIN actual a ON r.table_name = a.table_name
ORDER BY r.table_name;

-- 4. HU central-services tables. ALLOWED to be missing in dev_shakedown — reported for visibility
--    only. (They are REQUIRED in UAT full_validation — see ioreporting_uat_full_validation_preflight.sql.)
WITH hu AS (
  SELECT 'handlingunit_vekp' AS table_name UNION ALL
  SELECT 'handlingunit_vepo'
),
actual AS (
  SELECT table_name FROM published_dev.information_schema.tables
  WHERE table_schema = 'central_services'
)
SELECT
  h.table_name,
  CASE WHEN a.table_name IS NULL THEN 'ABSENT' ELSE 'PRESENT' END AS presence,
  'OK to be missing in dev_shakedown — HU-dependent models are not materialised' AS note
FROM hu h
LEFT JOIN actual a ON h.table_name = a.table_name
ORDER BY h.table_name;

-- 5. Shakedown gate summary. Shakedown is runnable when SAP + central_services + all 9 non-HU
--    reference tables are present. HU presence does NOT affect this verdict in dev_shakedown.
WITH actual AS (
  SELECT table_name FROM published_dev.information_schema.tables
  WHERE table_schema = 'central_services'
),
required_non_hu AS (
  SELECT 'plantcode_t001w' AS table_name UNION ALL
  SELECT 'customermaster_kna1' UNION ALL
  SELECT 'vendormaster_lfa1' UNION ALL
  SELECT 'warehouseforplant_t320' UNION ALL
  SELECT 'internalnumberobjectlink_inob' UNION ALL
  SELECT 'objectcharacteristics_ausp' UNION ALL
  SELECT 'characteristicvaluedescription_cawnt' UNION ALL
  SELECT 'procurementorderobject_ekko' UNION ALL
  SELECT 'procurementorderobject_ekpo'
)
SELECT
  (SELECT COUNT(*) FROM required_non_hu) AS required_non_hu_tables,
  (SELECT COUNT(*) FROM required_non_hu r JOIN actual a ON r.table_name = a.table_name) AS present_non_hu_tables,
  CASE
    WHEN (SELECT COUNT(*) FROM required_non_hu r LEFT JOIN actual a ON r.table_name = a.table_name WHERE a.table_name IS NULL) = 0
    THEN 'SHAKEDOWN READY (non-HU). HU-dependent outputs intentionally excluded — NOT business-validated.'
    ELSE 'BLOCKED — non-HU reference tables missing (see query 3).'
  END AS shakedown_verdict;
