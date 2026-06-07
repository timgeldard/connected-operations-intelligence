-- QM (inspection_qals) field-contract + CDC characterisation
-- Target: connected_plant_dev (DEV, profile TG, warehouse 8fae28f1808dbf75). Read-only; swap catalogs for UAT.
-- DDIC: published_dev.central_services.datadictionaryfields_dd03l (TRIM TABNAME/FIELDNAME — space-padded CHAR).
--
-- Purpose: CHARACTERISE (not fix) the gap that source-guards quality_inspection_lot. Evidence for the QM
-- reconciliation follow-up (sap_unresolved_sources.yml: quality_inspection_qals_field_contract_and_cdc_gap).
-- Do NOT guess-remap from this output — it is diagnostic; the remap needs functional sign-off.
--
-- RECORDED RESULTS (DD03L rec, 2026-06-07) — of the transform's QALS refs, ONLY WERK is a real QALS field:
--   CONFIRMED renames (real QALS fields, present in replicated inspection_qals):
--     plant_code            : WERKS  -> QALS.WERK
--     inspection_lot_origin : LOTORIGIN -> QALS.HERKUNFT   (QHERK)
--     inspection_lot_qty    : MENGE  -> QALS.LOSMENGE      (QLOSMENGE)
--     inspection_lot_uom    : MEINH  -> QALS.MENGENEINH    (QLOSMENGEH)
--     client                : MANDT  -> QALS.MANDANT       (fixed #27)
--   USAGE DECISION is a SEPARATE table/grain — QAVE, 1:many per lot (PK PRUEFLOS+KZART+ZAEHLER):
--     usage_decision_code   : VCODE  -> QAVE.VCODE  (plant-specific catalog code, NOT accept/reject)
--     usage_decision_date   : VENDAT -> QAVE.VDATUM  (VENDAT was wrong; legacy maps VDATUM)
--     accept/reject signal  : QAVE.VBEWERTUNG (valuation) — NOT VCODE. Value domain A/R pending data.
--     => model as quality_inspection_usage_decision (child), NOT folded into the lot row 1:1.
--   RESOLVED via legacy (silver_qals.csv) — previously "needs functional sign-off":
--     inspection_start_date : QALS.PASTRTERM (planned inspection start, lot grain). ENSTDE was wrong.
--     inspection_end_date   : QALS.PAENDTERM (planned inspection end, lot grain).   EENDDE was wrong.
--       (ENSTEHDAT is a DISTINCT field = lot-creation date, not inspection start.)
--     order_number          : QALS.AUFNR directly (NOT qmih.AUFNR — lossy 1:many notification object).
--     is_deletion_flagged   : NO KZLOESCH field on QALS -> drop the bespoke flag; deletion is
--                             system-status-derived (OBJNR/STATxx) if ever needed.
--   CDC: BOTH inspection_qals AND inspection_qave lack AERUNID/AERECNO (only AEDATTM) -> corrected SCD1
--        sequences on AEDATTM (current-state / MCHB pattern), NOT struct(_run_id,_record_seq).
--   => Field contract + grain split + ingestion model are RESOLVED in docs/quality_qm_functional_model.md.
--      NOT applied as run-eligible code: the flow stays source-guarded (guard NOT flipped) until the
--      quality plant gate is verified in — "we don't run anything until the plant gate is in".

-- ============================================================================
-- SECTION 1 — CDC metadata gap on inspection_qals (drives the source-guard)
--   Expect AERUNID/AERECNO/RecordActivity ABSENT (only AEDATTM). Same gap class as AFVV/zmanpex/zpexpm/MCHB.
-- ============================================================================
SELECT 'inspection_qals_cdc_metadata' AS check,
       concat_ws(',', sort_array(collect_set(column_name))) AS present_cdc_cols
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'sap' AND table_name = 'inspection_qals'
  AND upper(column_name) IN ('AERUNID', 'AERECNO', 'RECORDACTIVITY', 'AEDATTM');

-- ============================================================================
-- SECTION 2 — field contract: each field the transform references vs (a) replicated inspection_qals,
--   (b) DD03L QALS (is it a real QALS field?). classification flags renamed / wrong-table / absent.
-- ============================================================================
WITH expected AS (
  SELECT * FROM VALUES
    ('MANDANT',  'client (qals)'),            ('MANDT',   'client (WRONG — qals uses MANDANT)'),
    ('WERK',     'plant_code (qals)'),         ('WERKS',   'plant_code (WRONG — qals uses WERK)'),
    ('PRUEFLOS', 'inspection_lot_number'),     ('MATNR',   'material_code'),
    ('CHARG',    'batch_number'),
    ('LOTORIGIN','inspection_lot_origin_code (candidate: HERKUNFT)'),
    ('MENGE',    'inspection_lot_quantity (candidate: LOSMENGE)'),
    ('MEINH',    'inspection_lot_uom (candidate: MENGENEINH)'),
    ('ENSTDE',   'inspection_start_date'),     ('EENDDE',  'inspection_end_date'),
    ('VCODE',    'usage_decision_code (NOT QALS — QAVE)'),
    ('VENDAT',   'usage_decision_date (NOT QALS — QAVE)'),
    ('KZLOESCH', 'is_deletion_flagged'),
    ('AERUNID',  'CDC seq'), ('AERECNO', 'CDC seq')
  AS t(field, transform_use)
),
ddic_qals AS (
  SELECT TRIM(FIELDNAME) AS field FROM published_dev.central_services.datadictionaryfields_dd03l
  WHERE TRIM(TABNAME) = 'QALS'
),
repl AS (
  SELECT column_name AS field FROM connected_plant_dev.information_schema.columns
  WHERE table_schema = 'sap' AND table_name = 'inspection_qals'
)
SELECT
  e.field, e.transform_use,
  d.field IS NOT NULL AS on_qals_in_ddic,
  r.field IS NOT NULL AS replicated_in_inspection_qals,
  CASE
    WHEN d.field IS NOT NULL AND r.field IS NOT NULL THEN 'DDIC_AND_REPLICATED'
    WHEN d.field IS NOT NULL AND r.field IS NULL     THEN 'DDIC_ONLY_NOT_REPLICATED'
    WHEN d.field IS NULL     AND r.field IS NOT NULL THEN 'REPLICATED_ONLY_NOT_IN_DDIC'
    ELSE 'NOT_FOUND (absent on QALS — renamed or on another table e.g. QAVE)'
  END AS classification
FROM expected e
LEFT JOIN ddic_qals d ON upper(d.field) = upper(e.field)
LEFT JOIN repl r      ON upper(r.field) = upper(e.field)
ORDER BY classification, e.field;

-- ============================================================================
-- SECTION 3 — are VCODE/VENDAT actually QAVE (usage decision) fields? (confirms "wrong table", not "renamed")
-- ============================================================================
SELECT TRIM(TABNAME) AS sap_table, TRIM(FIELDNAME) AS field
FROM published_dev.central_services.datadictionaryfields_dd03l
WHERE TRIM(FIELDNAME) IN ('VCODE', 'VENDAT') AND TRIM(TABNAME) IN ('QALS', 'QAVE')
ORDER BY field, sap_table;

-- ============================================================================
-- SECTION 4 — confirm quality_inspection_lot is source-guarded (NOT materialised). Expect zero rows.
-- ============================================================================
SELECT table_name
FROM connected_plant_dev.information_schema.tables
WHERE table_schema = 'silver_io_reporting' AND table_name = 'quality_inspection_lot';
