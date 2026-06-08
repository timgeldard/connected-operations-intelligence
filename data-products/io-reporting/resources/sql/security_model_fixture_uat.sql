-- UAT RLS test fixture (Gate B — validation_fixture). UAT/DEV ONLY — never prod.
-- A LOCAL stand-in for published_uat.security.model so the secured-view plant-filter predicate can be
-- exercised with representative identities when the corporate model is unavailable to the validator.
-- The validation-fixture secured views (gold_security_uat_validation_fixture.sql) filter on this table.
--
-- Schema mirrors the corporate model columns the predicate reads (email, application_key, access_type,
-- filter_plant) plus test_case/enabled for management. The fixture predicate honours `enabled`
-- (COALESCE(enabled,true)), so a disabled row grants nothing.
--
-- Placeholder emails use @example.invalid — the UAT owner must replace them with REAL test identities
-- for the result to count as representative entitlement evidence (otherwise it only proves predicate
-- logic, not real-identity behaviour). Re-runnable: only the placeholder rows are replaced.

CREATE TABLE IF NOT EXISTS connected_plant_uat.gold_io_reporting.security_model_fixture (
  email STRING,
  application_key STRING,
  access_type STRING,
  filter_plant ARRAY<STRING>,
  test_case STRING,
  enabled BOOLEAN
) USING DELTA;

DELETE FROM connected_plant_uat.gold_io_reporting.security_model_fixture
WHERE email LIKE '%@example.invalid';

INSERT INTO connected_plant_uat.gold_io_reporting.security_model_fixture
  (email, application_key, access_type, filter_plant, test_case, enabled) VALUES
  ('warehouse360.fullview@example.invalid',    'io_reporting', 'full view', NULL,                       'full-view: sees all permitted plants',          true),
  ('warehouse360.singleplant@example.invalid', 'io_reporting', 'filter',    array('C061'),              'single-plant: sees only C061',                  true),
  ('warehouse360.multiplant@example.invalid',  'io_reporting', 'filter',    array('C061','P817'),       'multi-plant: sees C061 + P817',                 true),
  ('warehouse360.disabled@example.invalid',    'io_reporting', 'full view', NULL,                       'disabled: enabled=false grants nothing',        false),
  ('warehouse360.wrongapp@example.invalid',    'other_app',    'full view', NULL,                       'wrong application_key: grants nothing',         true);
-- no-access user: intentionally has NO fixture row → sees nothing (the EXISTS predicate matches nothing).
