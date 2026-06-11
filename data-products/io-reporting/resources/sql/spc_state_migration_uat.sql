-- SPC State Migration (UAT)
-- Target: connected_plant_uat.gold_io_reporting
--
-- Run AFTER: app smoke test confirms all SPC read endpoints are healthy against
-- the new gold_io_reporting schema (SPC_SCHEMA=gold_io_reporting in app.yaml).
--
-- Migrates four legacy app-state/config tables from connected_plant_uat.gold into
-- connected_plant_uat.gold_io_reporting using DEEP CLONE + RENAME so app writes
-- continue uninterrupted after the cut-over.
--
-- Idempotency semantics (tolerated failures on re-run):
--   Step (a) CREATE TABLE IF NOT EXISTS ... DEEP CLONE: harmless if _migrated
--            already exists — the IF NOT EXISTS guard skips it silently.
--   Step (b) DROP VIEW IF EXISTS: always safe.
--   Step (c) ALTER TABLE ... RENAME TO: WILL FAIL if the target name already
--            exists (i.e. after a successful first run). This is EXPECTED and
--            TOLERATED — same pattern as storage_type_role_mapping ALTER notes.
--            Check for the final table name before re-running steps a/c.
--
-- DESTRUCTIVE section at the bottom is intentionally separated — execute ONLY on
-- explicit instruction after full validation.

-- ── spc_locked_limits ────────────────────────────────────────────────────────

-- (a) Clone legacy table into governed schema
CREATE TABLE IF NOT EXISTS connected_plant_uat.gold_io_reporting.spc_locked_limits_migrated
  DEEP CLONE connected_plant_uat.gold.spc_locked_limits;

-- (b) Drop the bridge view that routed reads to the legacy table (only
--     spc_locked_limits has a bridge today; harmless for the others).
DROP VIEW IF EXISTS connected_plant_uat.gold_io_reporting.spc_locked_limits;

-- (c) Promote the migrated clone to the canonical name.
--     Re-runs after success will fail harmlessly here (target already exists).
ALTER TABLE connected_plant_uat.gold_io_reporting.spc_locked_limits_migrated
  RENAME TO connected_plant_uat.gold_io_reporting.spc_locked_limits;

-- ── spc_exclusions ───────────────────────────────────────────────────────────

-- (a)
CREATE TABLE IF NOT EXISTS connected_plant_uat.gold_io_reporting.spc_exclusions_migrated
  DEEP CLONE connected_plant_uat.gold.spc_exclusions;

-- (b) No bridge view exists today; DROP VIEW IF EXISTS is harmless.
DROP VIEW IF EXISTS connected_plant_uat.gold_io_reporting.spc_exclusions;

-- (c) Re-runs after success will fail harmlessly here.
ALTER TABLE connected_plant_uat.gold_io_reporting.spc_exclusions_migrated
  RENAME TO connected_plant_uat.gold_io_reporting.spc_exclusions;

-- ── spc_mic_chart_config ─────────────────────────────────────────────────────

-- (a)
CREATE TABLE IF NOT EXISTS connected_plant_uat.gold_io_reporting.spc_mic_chart_config_migrated
  DEEP CLONE connected_plant_uat.gold.spc_mic_chart_config;

-- (b) No bridge view exists today; DROP VIEW IF EXISTS is harmless.
DROP VIEW IF EXISTS connected_plant_uat.gold_io_reporting.spc_mic_chart_config;

-- (c) Re-runs after success will fail harmlessly here.
ALTER TABLE connected_plant_uat.gold_io_reporting.spc_mic_chart_config_migrated
  RENAME TO connected_plant_uat.gold_io_reporting.spc_mic_chart_config;

-- ── spc_query_audit ──────────────────────────────────────────────────────────

-- (a)
CREATE TABLE IF NOT EXISTS connected_plant_uat.gold_io_reporting.spc_query_audit_migrated
  DEEP CLONE connected_plant_uat.gold.spc_query_audit;

-- (b) No bridge view exists today; DROP VIEW IF EXISTS is harmless.
DROP VIEW IF EXISTS connected_plant_uat.gold_io_reporting.spc_query_audit;

-- (c) Re-runs after success will fail harmlessly here.
ALTER TABLE connected_plant_uat.gold_io_reporting.spc_query_audit_migrated
  RENAME TO connected_plant_uat.gold_io_reporting.spc_query_audit;

-- ════════════════════════════════════════════════════════════════════════════
-- EXECUTE ONLY ON EXPLICIT INSTRUCTION — destructive
-- Run ONLY after all four tables above are confirmed live in gold_io_reporting
-- and the app has been smoke-tested end-to-end against the new schema.
-- ════════════════════════════════════════════════════════════════════════════

-- DROP TABLE IF EXISTS connected_plant_uat.gold.spc_locked_limits;
-- DROP TABLE IF EXISTS connected_plant_uat.gold.spc_exclusions;
-- DROP TABLE IF EXISTS connected_plant_uat.gold.spc_mic_chart_config;
-- DROP TABLE IF EXISTS connected_plant_uat.gold.spc_query_audit;
