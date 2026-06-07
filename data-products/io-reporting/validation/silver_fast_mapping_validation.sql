-- silver_fast approved SAP mapping validation
-- Target: connected_plant_dev (DEV workspace, profile TG, warehouse 8fae28f1808dbf75)
--   source schema  = connected_plant_dev.sap
--   silver schema  = connected_plant_dev.silver_io_reporting
-- Purpose: validate the APPROVED WM/MM field mappings implemented in silver/tables/warehouse_fast.py
-- (functional sign-off 2026-06-07). See source-contracts/sap/silver_fast_field_reconciliation.md.
-- Read-only; safe to re-run. For UAT/PROD swap the catalog prefix.
--
-- SECTION A is a PRE-RUN gate (source-side: do the approved fields exist?) — run BEFORE the pipeline,
-- because `databricks bundle validate` does NOT catch a missing DLT column (only a pipeline update
-- surfaces UNRESOLVED_COLUMN). SECTIONS B–E are POST-RUN checks against the materialised silver output.
--
-- RECORDED RESULTS — DEV update 281cffac, 2026-06-07 (first run where silver_fast COMPLETED, after the
-- PP/PI source-guards + the autoBroadcastJoinThreshold=-1 fix). Row counts: transfer_order 13,485,287;
-- transfer_requirement 15,934,046; goods_movement 10,761,727; batch_stock 11,499,051.
--   §A : 0 missing approved fields; MARA fan-out guard 0 (973,314 rows = keys).
--   §B : alias_mismatch = 0 (actual_quantity_picked === confirmed_quantity holds); requested/confirmed
--        null = 3,472 (0.03%, both equal — TO items with no source quantity).
--   §C : open_quantity null = 0, negative = 0, open > required = 0 — derivation sound.
--   §D : reference_type inconsistent = 0; delivery_number null = 8,377,843 (78%, movement-type dependent,
--        expected); reference_type='DELIVERY' = 2,383,884.
--   §E2: base_uom null = 0 (MARA join covers 100%; no fan-out — output rows = MCHB rows).
--   §E1: FINDING — 2,099 duplicate-natural-key rows (0.018%). NOT a fan-out and NOT a source dup: bronze
--        MCHB is 1:1 on the raw key AND on the stripped key. The collisions come from strip_zeros mapping
--        all-zero/blank CHARG -> NULL (its documented "all-zero -> NULL" rule), so blank-batch stock rows
--        for the same material/plant/storage-location collapse to one (material_code, plant_code,
--        storage_location_code, batch_number=NULL) key. This is a PRE-EXISTING silver-key nuance (the key
--        omits MANDT and normalises identifiers), NOT introduced by the PP/PI gating or PR #23's mappings.
--        Impact is negligible (blank-batch stock arguably should aggregate) but it means the batch_stock
--        snapshot key is not strictly 1:1 in silver. FOLLOW-UP (separate decision): exclude blank-batch
--        rows from the natural-key uniqueness claim, or carry batch_number_raw in the key. Tracked in
--        sap_unresolved_sources.yml. Re-run §E1 in UAT business validation.

-- ============================================================================
-- SECTION A — PRE-RUN: approved source fields must exist in the replicated SAP schema
-- Expect: status = OK for every row. Any MISSING means silver_fast will hard-fail at analysis.
-- ============================================================================
WITH expected AS (
  SELECT * FROM VALUES
    ('transferorderobjects_ltap',        'VSOLM'),   -- requested_quantity
    ('transferorderobjects_ltap',        'VISTA'),   -- confirmed_quantity / actual_quantity_picked (alias)
    ('transferorderobjects_ltap',        'PQUIT'),   -- item status (preserved)
    ('transferorderobjects_ltap',        'PVQUI'),   -- item status (preserved)
    ('transferorderobjects_ltak',        'KQUIT'),   -- header status (preserved)
    ('transferrequirementobjects_ltbp',  'MENGE'),   -- required_quantity
    ('transferrequirementobjects_ltbp',  'TAMEN'),   -- qty already converted to TOs (open_quantity derivation)
    ('transferrequirementobjects_ltbp',  'ELIKZ'),   -- is_processing_complete (exposed, not a filter)
    ('inventorymovement_mseg',           'VBELN_IM'),-- delivery_number
    ('inventorymovement_mseg',           'VBELP_IM'),-- delivery_item
    ('materialmaster_mara',              'MANDT'),   -- MCHB<->MARA join key
    ('materialmaster_mara',              'MATNR'),   -- MCHB<->MARA join key
    ('materialmaster_mara',              'MEINS')    -- batch_stock.base_uom
  AS t(table_name, column_name)
)
SELECT
  e.table_name,
  e.column_name,
  CASE WHEN c.column_name IS NULL THEN 'MISSING (BLOCKER)' ELSE 'OK' END AS status
FROM expected e
LEFT JOIN connected_plant_dev.information_schema.columns c
  ON  c.table_schema = 'sap'
  AND c.table_name   = e.table_name
  AND c.column_name  = e.column_name
ORDER BY status DESC, e.table_name, e.column_name;

-- A2. MARA fan-out guard (CRITICAL for batch_stock correctness): the MCHB↔MARA left-join for
--     base_uom assumes MARA is 1:1 on (MANDT, MATNR). If MARA carried multiple change-records per key
--     (as the transactional LTAK/LTAP/MSEG do — hence their apply_changes), the join would fan out and
--     silently duplicate batch_stock rows. Expect fanout_rows = 0 (verified 0 on 2026-06-07:
--     973,314 rows = 973,314 distinct keys). If > 0: dedupe MARA (latest by its CDC keys) or join the
--     SCD1 silver `material` table instead.
SELECT
  COUNT(*)                                  AS mara_rows,
  COUNT(DISTINCT MANDT, MATNR)              AS mara_keys,
  COUNT(*) - COUNT(DISTINCT MANDT, MATNR)   AS fanout_rows_should_be_0
FROM connected_plant_dev.sap.materialmaster_mara;

-- Guard: confirm the invalid/absent fields the original code used are genuinely NOT present
-- (sanity check that we are not "fixing" a field that actually exists). Expect zero rows.
SELECT table_name, column_name AS unexpectedly_present
FROM connected_plant_dev.information_schema.columns
WHERE table_schema = 'sap'
  AND (
       (table_name = 'transferorderobjects_ltap'       AND column_name IN ('ANFME','ENMNG','ISPOS'))
    OR (table_name = 'transferrequirementobjects_ltbp' AND column_name = 'ENQTY')
    OR (table_name = 'inventorymovement_mseg'          AND column_name = 'VBELN')
    OR (table_name = 'batchstock_mchb'                 AND column_name IN ('MEINS','AERUNID','AERECNO'))
  );

-- ============================================================================
-- SECTION B — LTAP / warehouse_transfer_order (POST-RUN)
-- ============================================================================
-- B1. Quantity null rates + the alias invariant (actual_quantity_picked == confirmed_quantity).
SELECT
  COUNT(*)                                                                   AS rows_total,
  SUM(CASE WHEN requested_quantity   IS NULL THEN 1 ELSE 0 END)              AS requested_qty_null,
  SUM(CASE WHEN confirmed_quantity   IS NULL THEN 1 ELSE 0 END)             AS confirmed_qty_null,
  -- alias invariant: must be 0 (actual_quantity_picked is an alias of confirmed_quantity = VISTA)
  SUM(CASE WHEN NOT (actual_quantity_picked <=> confirmed_quantity) THEN 1 ELSE 0 END)
                                                                            AS alias_mismatch_should_be_0
FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_order;

-- ============================================================================
-- SECTION C — LTBP / warehouse_transfer_requirement (POST-RUN)
-- ============================================================================
-- C1. open_quantity = greatest(MENGE - TAMEN, 0): no negatives, no NULLs; sanity vs required_quantity.
SELECT
  COUNT(*)                                                                   AS rows_total,
  SUM(CASE WHEN open_quantity IS NULL THEN 1 ELSE 0 END)                     AS open_qty_null_should_be_0,
  SUM(CASE WHEN open_quantity < 0     THEN 1 ELSE 0 END)                     AS open_qty_negative_should_be_0,
  -- clamp/derivation sanity: open_quantity must never exceed required_quantity (MENGE)
  SUM(CASE WHEN open_quantity > required_quantity THEN 1 ELSE 0 END)         AS open_gt_required_should_be_0,
  -- completed TRs (is_processing_complete) should generally show no open backlog
  SUM(CASE WHEN is_processing_complete AND open_quantity > 0 THEN 1 ELSE 0 END) AS complete_with_open_qty
FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_requirement;

-- ============================================================================
-- SECTION D — MSEG / goods_movement (POST-RUN)
-- ============================================================================
-- D1. delivery_number (VBELN_IM) null rate + reference_type consistency.
--   reference_type must be 'DELIVERY' exactly when delivery_number_raw is populated, else NULL.
SELECT
  COUNT(*)                                                                   AS rows_total,
  SUM(CASE WHEN delivery_number IS NULL THEN 1 ELSE 0 END)                   AS delivery_number_null,
  SUM(CASE WHEN reference_type = 'DELIVERY' THEN 1 ELSE 0 END)               AS reference_type_delivery,
  -- inconsistency invariant: must be 0
  SUM(CASE WHEN (delivery_number_raw IS NOT NULL AND nullif(delivery_number_raw,'') IS NOT NULL
                 AND reference_type IS DISTINCT FROM 'DELIVERY')
            OR  ((delivery_number_raw IS NULL OR nullif(delivery_number_raw,'') IS NULL)
                 AND reference_type = 'DELIVERY')
           THEN 1 ELSE 0 END)                                                AS reference_type_inconsistent_should_be_0
FROM connected_plant_dev.silver_io_reporting.goods_movement;

-- ============================================================================
-- SECTION E — MCHB / batch_stock (POST-RUN)
-- ============================================================================
-- E1. Natural-key uniqueness (snapshot/current-state MV must be 1:1 on the key).
SELECT
  COUNT(*)                                                                   AS rows_total,
  COUNT(DISTINCT material_code, plant_code, storage_location_code, batch_number) AS distinct_keys,
  COUNT(*) - COUNT(DISTINCT material_code, plant_code, storage_location_code, batch_number)
                                                                            AS dup_rows_should_be_0
FROM connected_plant_dev.silver_io_reporting.batch_stock;

-- E2. base_uom coverage (MARA join). A non-zero null rate = MCHB rows whose MATNR has no MARA row;
--     report it (expected small) — it does not block, but flags master-data gaps.
SELECT
  COUNT(*)                                                                   AS rows_total,
  SUM(CASE WHEN base_uom IS NULL THEN 1 ELSE 0 END)                          AS base_uom_null,
  ROUND(100.0 * SUM(CASE WHEN base_uom IS NULL THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 4)
                                                                            AS base_uom_null_pct
FROM connected_plant_dev.silver_io_reporting.batch_stock;
