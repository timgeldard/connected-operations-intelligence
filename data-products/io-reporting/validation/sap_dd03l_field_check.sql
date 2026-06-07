-- SAP DDIC (DD03L) field-existence check vs replicated availability
-- Target: profile TG, warehouse 8fae28f1808dbf75. Read-only; safe to re-run. Swap catalogs for UAT.
--
-- EVIDENCE HIERARCHY for SAP field disputes (use in this order):
--   1. DD03L  — published_dev.central_services.datadictionaryfields_dd03l : proves the field EXISTS in
--               SAP and on which SAP table (authoritative DDIC field catalogue).
--   2. info_schema (DEV) — connected_plant_dev.information_schema.columns : proves the field is actually
--               REPLICATED into the DEV Databricks SAP schema (Aecorsoft, 1:1 column names).
--   3. info_schema (UAT) — connected_plant_uat.information_schema.columns : UAT replicated availability.
--   4. SAP functional sign-off : proves BUSINESS MEANING / approved mapping.
--   5. Source contracts (this repo) : record the decision.
-- DD03L proves existence; info_schema proves replicated availability; functional sign-off proves meaning.
--
-- GOTCHAS (verified 2026-06-07):
--   * DD03L TABNAME and FIELDNAME are CHAR, SPACE-PADDED — you MUST TRIM() before comparing.
--   * TABNAME holds standard SAP names (LTAP, MSEG, …) AND namespaced extractor structures
--     (/AECOR/LTAP, …). Use the standard names. Replicated Databricks tables use Aecorsoft "friendly"
--     names (transferorderobjects_ltap, …) — mapped to their SAP table below.
--
-- Classification per (sap_table, field):
--   DDIC_AND_REPLICATED            present in DD03L AND in the replicated schema (the normal, healthy case)
--   DDIC_ONLY_NOT_REPLICATED       a real SAP field, but NOT selected into the Databricks replication
--   REPLICATED_ONLY_NOT_IN_DDIC    replicated but not a standard SAP DDIC field (e.g. Aecorsoft CDC
--                                  metadata AERUNID/AERECNO/RecordActivity, or S/4-only fields absent
--                                  from this DDIC)
--   NOT_FOUND                      neither — the field does not exist in SAP on that table and is not
--                                  replicated (e.g. the original-code fields ANFME/ENMNG/ISPOS/ENQTY)

WITH expected AS (
  SELECT * FROM VALUES
    -- sap_table, replicated_table, field
    ('LTAP','transferorderobjects_ltap','ANFME'),
    ('LTAP','transferorderobjects_ltap','ENMNG'),
    ('LTAP','transferorderobjects_ltap','ISPOS'),
    ('LTAP','transferorderobjects_ltap','VSOLM'),
    ('LTAP','transferorderobjects_ltap','VSOLA'),
    ('LTAP','transferorderobjects_ltap','VISTM'),
    ('LTAP','transferorderobjects_ltap','VISTA'),
    ('LTBP','transferrequirementobjects_ltbp','ENQTY'),
    ('LTBP','transferrequirementobjects_ltbp','MENGE'),
    ('LTBP','transferrequirementobjects_ltbp','MENGA'),
    ('LTBP','transferrequirementobjects_ltbp','TAMEN'),
    ('MSEG','inventorymovement_mseg','VBELN'),
    ('MSEG','inventorymovement_mseg','VBELN_IM'),
    ('MSEG','inventorymovement_mseg','VBELP_IM'),
    ('MCHB','batchstock_mchb','MEINS'),
    ('MCHB','batchstock_mchb','MANDT'),
    ('MCHB','batchstock_mchb','MATNR'),
    ('MCHB','batchstock_mchb','WERKS'),
    ('MCHB','batchstock_mchb','LGORT'),
    ('MCHB','batchstock_mchb','CHARG'),
    ('MARA','materialmaster_mara','MEINS'),
    ('MARA','materialmaster_mara','MANDT'),
    ('MARA','materialmaster_mara','MATNR')
  AS t(sap_table, replicated_table, field)
),
ddic AS (
  SELECT TRIM(TABNAME) AS sap_table, TRIM(FIELDNAME) AS field,
         KEYFLAG, TRIM(ROLLNAME) AS rollname, TRIM(DATATYPE) AS datatype, LENG, DECIMALS
  FROM published_dev.central_services.datadictionaryfields_dd03l
  WHERE TRIM(TABNAME) IN ('LTAP','LTBP','MSEG','MCHB','MARA')
),
repl AS (
  SELECT table_name AS replicated_table, column_name AS field
  FROM connected_plant_dev.information_schema.columns
  WHERE table_schema = 'sap'
)
SELECT
  e.sap_table,
  e.field,
  d.field IS NOT NULL AS in_ddic,
  r.field IS NOT NULL AS in_replicated,
  d.KEYFLAG  AS ddic_keyflag,
  d.rollname AS ddic_data_element,
  d.datatype AS ddic_type,
  d.LENG     AS ddic_length,
  CASE
    WHEN d.field IS NOT NULL AND r.field IS NOT NULL THEN 'DDIC_AND_REPLICATED'
    WHEN d.field IS NOT NULL AND r.field IS NULL     THEN 'DDIC_ONLY_NOT_REPLICATED'
    WHEN d.field IS NULL     AND r.field IS NOT NULL THEN 'REPLICATED_ONLY_NOT_IN_DDIC'
    ELSE 'NOT_FOUND'
  END AS classification
FROM expected e
LEFT JOIN ddic d ON d.sap_table = e.sap_table AND d.field = e.field
LEFT JOIN repl r ON r.replicated_table = e.replicated_table AND r.field = e.field
ORDER BY e.sap_table, e.field;
