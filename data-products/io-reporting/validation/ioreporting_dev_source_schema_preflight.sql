-- IOReporting DEV source-schema preflight
-- Target: connected_plant_dev.sap (DEV workspace, profile TG, warehouse 8fae28f1808dbf75)
-- Purpose: before running silver_slow in dev_shakedown, confirm the SAP source schema actually
-- supports the non-HU Silver/Gold models. Distinguishes hard blockers (required tables/columns
-- absent) from shakedown-tolerated gaps (known unreplicated source objects/columns that degrade to
-- typed-NULL or skip without breaking the run). Read-only; safe to re-run.
--
-- IMPORTANT: the tolerated gaps below were confirmed absent in BOTH connected_plant_dev.sap AND
-- connected_plant_uat.sap (2026-06-07) — they are source-replication gaps, NOT DEV-only. They
-- therefore also affect UAT full_validation. See
-- docs/architecture/adr-ioreporting-dev-shakedown-vs-uat-validation.md and the UAT readiness runbook.

-- 1. Required SAP source tables (BLOCKER if MISSING). These feed the non-HU Silver→Gold→Warehouse360
--    chain. (HU tables handlingunit_vekp/vepo live in central_services and are gated separately.)
WITH required_tables AS (
  SELECT explode(array(
    'batchstock_mchb','quant_lqua','storagebin_lagp','storagelocation_t001l','storagelocationmaterial_mard',
    'deliveryobjects_likp','deliveryobjects_lips','procurementorderobject_ekko','procurementorderobject_ekpo',
    'inventorymovement_mseg','materialdocument_mkpf','materialmaster_mara','materialforplant_marc',
    'materialdescription_makt','materialconversion_marm','materialvaluation_mbew',
    'ordermaster_aufk','productionorderobject_afko','processorderobject_afvc',
    'dbstructureoperationquantitydatevalues_afvv','reservationrequirement_resb',
    'transferorderobjects_ltak','transferorderobjects_ltap','transferrequirementobjects_ltbk',
    'transferrequirementobjects_ltbp','wm_storagetypes_t301','wm_storagetypesdescription_t301t',
    'capacityheadersegment_kako','shiftparametersavailablecapacity_kapa','inspection_qals','qualitymessage_qmih',
    'actualpistartenddatetime_zmanpex_e04_002','downtime_zpexpm_dwnt'
  )) AS table_name
),
actual AS (SELECT table_name FROM connected_plant_dev.information_schema.tables WHERE table_schema='sap')
SELECT
  r.table_name,
  CASE WHEN a.table_name IS NULL THEN 'FAIL (required table MISSING — blocks shakedown)' ELSE 'PASS' END AS status
FROM required_tables r LEFT JOIN actual a ON r.table_name=a.table_name
ORDER BY (a.table_name IS NULL) DESC, r.table_name;

-- 2. Tolerated source-table gaps (NOT a shakedown blocker). Known unreplicated; the dependent model
--    is source-guarded so it is simply not built. Reported for visibility (also affects UAT).
WITH tolerated AS (
  SELECT 'workcenterheader_crhd' AS table_name, 'work_centre not built (no Warehouse360 dependency)' AS impact UNION ALL
  SELECT 'workcentertext_crtx', 'work_centre not built (no Warehouse360 dependency)'
),
actual AS (SELECT table_name FROM connected_plant_dev.information_schema.tables WHERE table_schema='sap')
SELECT
  t.table_name,
  CASE WHEN a.table_name IS NULL THEN 'ABSENT (tolerated — also absent in UAT)' ELSE 'present' END AS presence,
  t.impact
FROM tolerated t LEFT JOIN actual a ON t.table_name=a.table_name
ORDER BY t.table_name;

-- 3. Required columns on a key table (BLOCKER if MISSING): storagebin_lagp natural key + plant link.
WITH required_cols AS (
  SELECT explode(array('LGNUM','LGTYP','LGPLA','MANDT','AEDATTM')) AS column_name
),
actual AS (
  SELECT column_name FROM connected_plant_dev.information_schema.columns
  WHERE table_schema='sap' AND table_name='storagebin_lagp'
)
SELECT
  'storagebin_lagp' AS table_name, c.column_name,
  CASE WHEN a.column_name IS NULL THEN 'FAIL (required column MISSING)' ELSE 'PASS' END AS status
FROM required_cols c LEFT JOIN actual a ON c.column_name=a.column_name
ORDER BY (a.column_name IS NULL) DESC, c.column_name;

-- 4. Degraded/optional columns (WARNING, not a blocker): storagebin_lagp descriptive bin attributes
--    that are absent in the replicated LAGP. The silver model emits typed NULL via col_or_null.
--    bin_type (LGBKT) degrades the bin_type grouping dimension in gold_bin_occupancy, but bin COUNTS
--    — and therefore the Warehouse360 overview KPIs — are unaffected. NOT remapped to LPTYP (a
--    data-team mapping decision). Also absent in UAT.
WITH optional_cols AS (
  SELECT 'LGBKT' AS column_name, 'bin_type — degrades gold_bin_occupancy dimension, WH360 overview counts unaffected, candidate field LPTYP (confirm with data team)' AS impact UNION ALL
  SELECT 'LGPBE', 'storage_bin_structure — no gold consumer' UNION ALL
  SELECT 'MAXGW', 'maximum_weight — no gold consumer' UNION ALL
  SELECT 'MAXEI', 'maximum_capacity_units — no gold consumer' UNION ALL
  SELECT 'ANZRE', 'current_capacity_units_used — no gold consumer'
),
actual AS (
  SELECT column_name FROM connected_plant_dev.information_schema.columns
  WHERE table_schema='sap' AND table_name='storagebin_lagp'
)
SELECT
  'storagebin_lagp' AS table_name, c.column_name,
  CASE WHEN a.column_name IS NULL THEN 'WARN — absent, emitted as typed NULL' ELSE 'present' END AS status,
  c.impact
FROM optional_cols c LEFT JOIN actual a ON c.column_name=a.column_name
ORDER BY c.column_name;

-- 4b. KAPA extended columns (WARNING / tolerated gap): shiftparametersavailablecapacity_kapa is
--     missing the columns stg_capacity_utilisation needs. capacity_utilisation has NO downstream
--     pipeline consumers and is NOT in the Warehouse360 critical path, so the whole model is
--     source-guarded OFF in dev_shakedown (tolerated — not a blocker). These columns are also absent
--     in UAT, so capacity_utilisation is likewise gated in UAT full_validation until a source-mapping
--     decision is made (it is NOT required by the 7 Warehouse360 source objects). NOT remapped/inferred.
WITH kapa_cols AS (
  SELECT explode(array('DAFBI','DAFEI','PAUSA','BEGDA','ENDDA','KAPAZ','MEINH','OEFFZ','NORMA','RUEZT')) AS column_name
),
actual AS (
  SELECT column_name FROM connected_plant_dev.information_schema.columns
  WHERE table_schema='sap' AND table_name='shiftparametersavailablecapacity_kapa'
)
SELECT
  'shiftparametersavailablecapacity_kapa' AS table_name, k.column_name,
  CASE WHEN a.column_name IS NULL
    THEN 'WARN — absent, capacity_utilisation source-guarded OFF (tolerated in shakedown, also gates UAT)'
    ELSE 'present' END AS status
FROM kapa_cols k LEFT JOIN actual a ON k.column_name=a.column_name
ORDER BY (a.column_name IS NULL) DESC, k.column_name;

-- 5. Verdict: shakedown source-schema is READY when every required table (query 1) and required
--    column (query 3) is present. Tolerated gaps (2), degraded LAGP columns (4) and the KAPA
--    capacity gap (4b, source-guarded off) do NOT block.
WITH required_tables AS (
  SELECT explode(array(
    'batchstock_mchb','quant_lqua','storagebin_lagp','storagelocation_t001l','storagelocationmaterial_mard',
    'deliveryobjects_likp','deliveryobjects_lips','procurementorderobject_ekko','procurementorderobject_ekpo',
    'inventorymovement_mseg','materialdocument_mkpf','materialmaster_mara','materialforplant_marc',
    'materialdescription_makt','materialconversion_marm','materialvaluation_mbew',
    'ordermaster_aufk','productionorderobject_afko','processorderobject_afvc',
    'dbstructureoperationquantitydatevalues_afvv','reservationrequirement_resb',
    'transferorderobjects_ltak','transferorderobjects_ltap','transferrequirementobjects_ltbk',
    'transferrequirementobjects_ltbp','wm_storagetypes_t301','wm_storagetypesdescription_t301t',
    'capacityheadersegment_kako','shiftparametersavailablecapacity_kapa','inspection_qals','qualitymessage_qmih',
    'actualpistartenddatetime_zmanpex_e04_002','downtime_zpexpm_dwnt'
  )) AS table_name
),
actual AS (SELECT table_name FROM connected_plant_dev.information_schema.tables WHERE table_schema='sap')
SELECT
  CASE WHEN COUNT(*) = 0
    THEN 'SOURCE-SCHEMA READY for dev_shakedown (all required tables present, tolerated gaps documented)'
    ELSE CONCAT(CAST(COUNT(*) AS STRING), ' required source table(s) MISSING — shakedown BLOCKED')
  END AS verdict
FROM required_tables r LEFT JOIN actual a ON r.table_name=a.table_name
WHERE a.table_name IS NULL;
