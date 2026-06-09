-- ─────────────────────────────────────────────────────────────────────────────────────────────────────
-- Onboard ONE test identity to the Warehouse360 governed UAT app (validation_fixture / Gate B).
-- Operator tool — run as the Gold object owner against the UAT SQL warehouse. NOT a deployed artefact.
-- See docs/runbooks/warehouse360-app-wiring-validation-fixture.md.
--
-- Replace the placeholders, then run the whole script:
--   :email        lowercase UPN, must equal current_user() exactly   e.g. 'jane.doe@kerry.com'
--   :access_type  'full view'  (all onboarded plants)  OR  'filter'  (only :filter_plant)
--   :filter_plant array('C061','P817')  when access_type='filter'   (use NULL for 'full view')
-- ─────────────────────────────────────────────────────────────────────────────────────────────────────

-- 1. Entitlement row (idempotent: clears this email's io_reporting row first — scoped to the
--    application_key so a user's entitlements for other apps in this shared table are untouched;
--    LOWER() keeps email lowercase to match the case-sensitive current_user() = email predicate)
DELETE FROM connected_plant_uat.gold_io_reporting.security_model_fixture
WHERE email = LOWER('REPLACE_EMAIL') AND application_key = 'io_reporting';

INSERT INTO connected_plant_uat.gold_io_reporting.security_model_fixture
  (email, application_key, access_type, filter_plant, test_case, enabled) VALUES
  (LOWER('REPLACE_EMAIL'), 'io_reporting', 'full view', NULL, 'manual onboard', true);
  -- single-plant example instead of the line above:
  -- (LOWER('REPLACE_EMAIL'), 'io_reporting', 'filter', array('C061'), 'manual onboard (C061 only)', true);

-- 2. Grants — each end-user queries as themselves (identity passthrough); ownership chaining covers the
--    underlying *_live/*_secured/Gold + the fixture table. Do NOT grant base tables to consumers.
GRANT USE CATALOG ON CATALOG connected_plant_uat TO `REPLACE_EMAIL`;
GRANT USE SCHEMA  ON SCHEMA  connected_plant_uat.gold_io_reporting TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_overview            TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog     TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog    TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_staging_workload    TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions    TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_shortfalls          TO `REPLACE_EMAIL`;
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation TO `REPLACE_EMAIL`;

-- 3. Verify (run AS that user, or check the row):
-- SELECT email, access_type, filter_plant, enabled FROM connected_plant_uat.gold_io_reporting.security_model_fixture WHERE email='REPLACE_EMAIL';
