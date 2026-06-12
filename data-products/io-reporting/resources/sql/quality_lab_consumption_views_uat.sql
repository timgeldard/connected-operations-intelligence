-- Quality Lab Board Consumption Views (UAT)
-- Target: connected_plant_uat.gold_io_reporting
-- Serves the Connected Quality Lab Board app route (apps/api/routes/quality_lab.py) via the
-- governed contract pattern: app -> vw_consumption_quality_lab_* -> *_secured -> gold MV.
-- Run once as a UC admin AFTER gold_security_uat.sql.

USE CATALOG connected_plant_uat;
CREATE SCHEMA IF NOT EXISTS gold_io_reporting;
USE SCHEMA gold_io_reporting;

-- Lab Board result signal view.
-- Grain: 1 row per plant + inspection lot + operation + MIC (failed/warned results only).
-- RLS inherited from gold_qm_lab_result_signal_secured via the CSM security model.
CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.vw_consumption_quality_lab_fails AS
SELECT
  plant_code                                          AS plant_code,
  material_code                                       AS mat_no,
  material_code                                       AS mat,
  inspection_lot_number                               AS lot,
  batch_number                                        AS batch,
  production_line                                     AS line,
  characteristic_id                                   AS char,
  characteristic_text                                 AS text,
  CAST(result_value AS DOUBLE)                        AS res,
  CAST(lower_limit AS DOUBLE)                         AS lo,
  CAST(upper_limit AS DOUBLE)                         AS hi,
  unit                                                AS units,
  severity                                            AS sev,
  CAST(result_recording_start_date AS STRING)         AS ts,
  lot_type                                            AS lot_type
FROM connected_plant_uat.gold_io_reporting.gold_qm_lab_result_signal_secured
WHERE plant_code IS NOT NULL;

GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_quality_lab_fails TO `users`;
