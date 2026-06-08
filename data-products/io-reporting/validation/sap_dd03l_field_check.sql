-- SAP DDIC field-existence + normalisation-policy check vs replicated availability.
-- Multi-statement Databricks SQL script (run in the SQL editor / a multi-statement runner — the leading
-- DECLAREs parameterise the environment in ONE place). Read-only; safe to re-run.
--
-- EVIDENCE HIERARCHY for SAP field disputes (use in this order):
--   1. DD03L (datadictionaryfields_dd03l)        : field EXISTS in SAP + on which table + KEYFLAG + data element
--   2. DD04L (metadata_dataelement_dd04l)         : data-element domain/type + CONVEXIT (conversion routine)
--   3. DD02L (metadata_saptable_dd02l)            : table class + CLIDEP (client dependency)
--   4. <catalog>.information_schema.columns       : is the field actually REPLICATED into Databricks (DEV/UAT)
--   5. SAP functional sign-off                    : business MEANING / approved mapping
--   6. repo source contracts                      : record the decision
-- DD03L/DD04L/DD02L prove SAP existence + technical attributes; information_schema proves replicated
-- availability; functional sign-off proves meaning. (No DD03T/DD04T text tables are available here, so
-- field DESCRIPTIONS are not a source — meaning still comes from functional sign-off.)
--
-- GOTCHAS (verified 2026-06-07): DDIC TABNAME/FIELDNAME/ROLLNAME are space-padded CHAR — always TRIM().
-- TABNAME holds standard SAP names (LTAP,…) AND /AECOR/* extractor structures — use the standard names.
--
-- ── ENVIRONMENT (swap these three for UAT / PROD) ────────────────────────────────────────────────
--   DEV  : published_dev.central_services.*           + connected_plant_dev.information_schema.columns
--   UAT  : published_uat.central_services.*            + connected_plant_uat.information_schema.columns
--   PROD : published_prod.central_services.* (if repl) + connected_plant_prod.information_schema.columns
DECLARE OR REPLACE VARIABLE v_dd03l STRING DEFAULT 'published_dev.central_services.datadictionaryfields_dd03l';
DECLARE OR REPLACE VARIABLE v_dd04l STRING DEFAULT 'published_dev.central_services.metadata_dataelement_dd04l';
DECLARE OR REPLACE VARIABLE v_dd02l STRING DEFAULT 'published_dev.central_services.metadata_saptable_dd02l';
DECLARE OR REPLACE VARIABLE v_repl_cols STRING DEFAULT 'connected_plant_dev.information_schema.columns';

-- ============================================================================
-- SECTION 1 — field classification (DDIC existence vs replicated) + CONVEXIT normalisation evidence
--   classification: DDIC_AND_REPLICATED | DDIC_ONLY_NOT_REPLICATED | REPLICATED_ONLY_NOT_IN_DDIC | NOT_FOUND
--   conv_exit: '' = no conversion routine -> leading zeros SIGNIFICANT -> preserve exactly (e.g. CHARG_D);
--              'ALPHA'/'MATN1'/... = display ALPHA conversion -> zero-stripping is SAP-correct (MATNR, VBELN).
-- ============================================================================
WITH expected AS (
  SELECT * FROM VALUES
    ('LTAP','transferorderobjects_ltap','ANFME'), ('LTAP','transferorderobjects_ltap','ENMNG'),
    ('LTAP','transferorderobjects_ltap','ISPOS'), ('LTAP','transferorderobjects_ltap','VSOLM'),
    ('LTAP','transferorderobjects_ltap','VSOLA'), ('LTAP','transferorderobjects_ltap','VISTM'),
    ('LTAP','transferorderobjects_ltap','VISTA'),
    ('LTBP','transferrequirementobjects_ltbp','ENQTY'), ('LTBP','transferrequirementobjects_ltbp','MENGE'),
    ('LTBP','transferrequirementobjects_ltbp','MENGA'), ('LTBP','transferrequirementobjects_ltbp','TAMEN'),
    ('MSEG','inventorymovement_mseg','VBELN'), ('MSEG','inventorymovement_mseg','VBELN_IM'),
    ('MSEG','inventorymovement_mseg','VBELP_IM'),
    ('MCHB','batchstock_mchb','MEINS'), ('MCHB','batchstock_mchb','MANDT'),
    ('MCHB','batchstock_mchb','MATNR'), ('MCHB','batchstock_mchb','WERKS'),
    ('MCHB','batchstock_mchb','LGORT'), ('MCHB','batchstock_mchb','CHARG'),
    ('MCHB','batchstock_mchb','AERUNID'), ('MCHB','batchstock_mchb','AERECNO'),
    ('MCHB','batchstock_mchb','RecordActivity'),
    ('MARA','materialmaster_mara','MEINS'), ('MARA','materialmaster_mara','MANDT'),
    ('MARA','materialmaster_mara','MATNR')
  AS t(sap_table, replicated_table, field)
),
ddic AS (
  SELECT TRIM(TABNAME) AS sap_table, TRIM(FIELDNAME) AS field, KEYFLAG,
         TRIM(ROLLNAME) AS data_element, TRIM(DATATYPE) AS datatype, LENG, DECIMALS
  FROM IDENTIFIER(v_dd03l)
  WHERE TRIM(TABNAME) IN ('LTAP','LTBP','MSEG','MCHB','MARA')
),
dtel AS (
  SELECT TRIM(ROLLNAME) AS data_element, TRIM(CONVEXIT) AS conv_exit, LOWERCASE
  FROM IDENTIFIER(v_dd04l)
),
repl AS (
  -- information_schema casing varies by environment; compare case-insensitively (DEV stores the SAP
  -- column names upper-case + table names lower-case, but UAT/PROD may differ — this check is env-portable).
  SELECT table_name AS replicated_table, column_name AS field
  FROM IDENTIFIER(v_repl_cols)
  WHERE LOWER(table_schema) = 'sap'
)
SELECT
  e.sap_table, e.field,
  d.field IS NOT NULL AS in_ddic,
  r.field IS NOT NULL AS in_replicated,
  d.KEYFLAG AS ddic_keyflag,
  d.data_element AS ddic_data_element,
  d.datatype AS ddic_type, d.LENG AS ddic_length,
  de.conv_exit AS ddic_conv_exit,   -- '' => preserve leading zeros exactly; ALPHA/MATN1 => zero-strip is correct
  CASE
    WHEN d.field IS NOT NULL AND r.field IS NOT NULL THEN 'DDIC_AND_REPLICATED'
    WHEN d.field IS NOT NULL AND r.field IS NULL     THEN 'DDIC_ONLY_NOT_REPLICATED'
    WHEN d.field IS NULL     AND r.field IS NOT NULL THEN 'REPLICATED_ONLY_NOT_IN_DDIC'
    ELSE 'NOT_FOUND'
  END AS classification
FROM expected e
LEFT JOIN ddic d ON d.sap_table = e.sap_table AND d.field = e.field   -- DD03L is reliably upper-case SAP
LEFT JOIN dtel de ON de.data_element = d.data_element
-- information_schema casing is env-dependent: match case-insensitively to avoid false NOT_FOUND.
LEFT JOIN repl r ON LOWER(r.replicated_table) = LOWER(e.replicated_table) AND LOWER(r.field) = LOWER(e.field)
ORDER BY e.sap_table, e.field;

-- ============================================================================
-- SECTION 2 — normalisation policy evidence (CONVEXIT per identifier data element)
--   Confirms the strip-MATNR / preserve-CHARG split: CHARG_D has NO conversion exit (exact identifier);
--   MATNR=MATN1 and VBELN_VL=ALPHA (display ALPHA -> zero-stripping is the SAP-correct display form).
-- ============================================================================
SELECT TRIM(ROLLNAME) AS data_element, TRIM(DOMNAME) AS domain, TRIM(DATATYPE) AS dtype, LENG,
       TRIM(CONVEXIT) AS conv_exit, LOWERCASE
FROM IDENTIFIER(v_dd04l)
WHERE TRIM(ROLLNAME) IN ('CHARG_D','MATNR','VBELN_VL','POSNR_VL','MEINS',
                         'LTAP_VSOLM','LTAP_VISTA','LTBP_MENGE','LTBP_TAMEN')
ORDER BY data_element;

-- ============================================================================
-- SECTION 3 — table-level client dependency (DD02L). CLIDEP='X' => client-dependent => MANDT is part of
--   the key => `client` (MANDT) belongs in the batch_stock natural key (see §E1 in
--   silver_fast_mapping_validation.sql). Expect TABCLASS=TRANSP, CLIDEP=X for all five.
-- ============================================================================
SELECT TRIM(TABNAME) AS sap_table, TRIM(TABCLASS) AS table_class, CLIDEP AS client_dependent
FROM IDENTIFIER(v_dd02l)
WHERE TRIM(TABNAME) IN ('LTAP','LTBP','MSEG','MCHB','MARA')
ORDER BY sap_table;
