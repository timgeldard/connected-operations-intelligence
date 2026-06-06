-- IOReporting UAT full-validation preflight
-- Target: connected_plant_uat (UAT workspace/profile)
-- Mode: full_validation (enable_hu_reconciliation = true)
-- Purpose: UAT is the first environment for full HU/business validation. Unlike dev_shakedown,
-- the complete published_uat.central_services set IS REQUIRED — including the HU tables
-- (handlingunit_vekp/vepo). Any missing required table is a FAIL.
-- Read-only; safe to re-run. See docs/architecture/adr-ioreporting-dev-shakedown-vs-uat-validation.md.

-- 1. UAT SAP source schema exists.
SELECT
  'connected_plant_uat.sap' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM connected_plant_uat.information_schema.schemata
WHERE schema_name = 'sap';

-- 2. UAT reference catalog/schema exists.
SELECT
  'published_uat.central_services' AS object,
  CASE WHEN COUNT(*) > 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM published_uat.information_schema.schemata
WHERE schema_name = 'central_services';

-- 3. ALL required central-services tables, INCLUDING HU. handlingunit_vekp/vepo are REQUIRED here
--    (full_validation). Any MISSING is a FAIL — UAT must not proceed without full HU coverage.
WITH required_all AS (
  SELECT 'plantcode_t001w' AS table_name, 'reference' AS kind UNION ALL
  SELECT 'customermaster_kna1', 'reference' UNION ALL
  SELECT 'vendormaster_lfa1', 'reference' UNION ALL
  SELECT 'warehouseforplant_t320', 'reference' UNION ALL
  SELECT 'internalnumberobjectlink_inob', 'reference' UNION ALL
  SELECT 'objectcharacteristics_ausp', 'reference' UNION ALL
  SELECT 'characteristicvaluedescription_cawnt', 'reference' UNION ALL
  SELECT 'procurementorderobject_ekko', 'reference' UNION ALL
  SELECT 'procurementorderobject_ekpo', 'reference' UNION ALL
  SELECT 'handlingunit_vekp', 'HU (required in UAT)' UNION ALL
  SELECT 'handlingunit_vepo', 'HU (required in UAT)'
),
actual AS (
  SELECT table_name FROM published_uat.information_schema.tables
  WHERE table_schema = 'central_services'
)
SELECT
  r.table_name,
  r.kind,
  CASE WHEN a.table_name IS NULL THEN 'FAIL (required for full validation)' ELSE 'PASS' END AS status
FROM required_all r
LEFT JOIN actual a ON r.table_name = a.table_name
ORDER BY (a.table_name IS NULL) DESC, r.table_name;

-- 4. Explicit HU gate: full_validation FAILS if either HU table is missing.
WITH actual AS (
  SELECT table_name FROM published_uat.information_schema.tables
  WHERE table_schema = 'central_services'
)
SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM actual WHERE table_name IN ('handlingunit_vekp', 'handlingunit_vepo')) = 2
    THEN 'PASS — HU tables present, HU reconciliation can be fully validated'
    ELSE 'FAIL — HU tables missing; UAT full validation cannot proceed (enable_hu_reconciliation=true)'
  END AS hu_gate_status;

-- 5. Target schema conventions: UAT must write silver_io_reporting + gold_io_reporting.
SELECT
  schema_name,
  'PASS' AS status
FROM connected_plant_uat.information_schema.schemata
WHERE schema_name IN ('silver_io_reporting', 'gold_io_reporting')
ORDER BY schema_name;
-- (Both schemas are created by the first UAT pipeline run; absence before deploy is expected.)
