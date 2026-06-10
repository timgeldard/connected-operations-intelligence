-- Unity Catalog Gold row-level security — secured serving views (UAT).
-- Run once as a Unity Catalog admin after the first uat deploy. Re-runnable.
-- Requires: CREATE VIEW on connected_plant_uat.gold_io_reporting.
-- WARNING: Generated automatically by scripts/generate_gold_security_sql.py. Do not edit manually.
--
-- Model: Gold MVs stay trusted (not row-filtered, to avoid full MV refreshes). Each plant-scoped
-- Gold table gets a <table>_secured view that enforces plant access via published_<env>.security.model
-- (application_key = 'io_reporting'). access_type 'full view' = all plants; 'filter' = filter_plant
-- array. Dev secured views are pass-through (no security model available in dev).
-- Consumers ('users' group) are granted SELECT on the *_secured views only.
--
-- SECURITY MODE: validation-fixture (UAT/DEV ONLY). The *_secured views filter on the
-- LOCAL <catalog>.<gold_schema>.security_model_fixture table (placeholder test identities), NOT the
-- corporate published_<env>.security.model. Proves the secured-view PREDICATE logic and
-- representative plant scoping, NOT real corporate-RLS integration. MUST NOT be used in prod.

-- ── Secured views + consumer grants ──

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_transfer_order_performance_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_transfer_order_performance
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_transfer_order_performance_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_inbound_outbound_throughput_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_inbound_outbound_throughput
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_inbound_outbound_throughput_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_bin_occupancy_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_bin_occupancy
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_bin_occupancy_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_availability_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_availability
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_availability_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_transfer_requirement_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_backlog
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_transfer_requirement_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_transfer_requirement_material_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_material_backlog
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_transfer_requirement_material_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_expiry_risk_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_expiry_risk
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_expiry_risk_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_shift_output_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_shift_output_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_shift_output_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_process_order_schedule_adherence_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_process_order_schedule_adherence
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_process_order_schedule_adherence_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_plant_production_quality_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_plant_production_quality_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_plant_production_quality_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_process_order_operations_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_process_order_operations
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_process_order_operations_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_order_downtime_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_order_downtime_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_order_downtime_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_process_order_component_status_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_process_order_component_status
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_process_order_component_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_dispensary_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_dispensary_backlog
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_dispensary_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_lineside_stock_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_lineside_stock
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_lineside_stock_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_delivery_pick_status_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_delivery_pick_status
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_delivery_pick_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_reconciliation
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_process_order_staging_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_process_order_staging
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_process_order_staging_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_process_order_staging_validation_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_process_order_staging_validation
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_process_order_staging_validation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_storage_type_role_coverage_status_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_storage_type_role_coverage_status
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_storage_type_role_coverage_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_v2_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_v2
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_value_reconciliation_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_value_reconciliation
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_value_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_reconciliation_audit_log_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_reconciliation_audit_log
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_reconciliation_audit_log_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_movement_reconciliation_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_movement_reconciliation
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_movement_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_hu_reconciliation_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_hu_reconciliation
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_hu_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_physical_inventory_recon_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_physical_inventory_recon
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_physical_inventory_recon_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_reconciliation_alerts_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_reconciliation_alerts
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_reconciliation_alerts_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_exceptions_v2_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_exceptions_v2
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_exceptions_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_summary_v2_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_summary_v2
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_summary_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_reconciliation_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_stock_holds_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_stock_holds
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_stock_holds_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_transfer_order_open_items_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_transfer_order_open_items
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_transfer_order_open_items_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_transfer_requirement_open_items_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_transfer_requirement_open_items
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_transfer_requirement_open_items_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_goods_movement_activity_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_goods_movement_activity
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_goods_movement_activity_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_enhanced_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_enhanced
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_inbound_po_backlog_enhanced_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_inbound_po_line_backlog_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_inbound_po_line_backlog
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_inbound_po_line_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_handling_unit_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_handling_unit_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_handling_unit_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_warehouse_exceptions_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_warehouse_exceptions
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_warehouse_exceptions_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_warehouse_kpi_snapshot_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_warehouse_kpi_snapshot
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_warehouse_kpi_snapshot_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_staging_worklist_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_staging_worklist
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_staging_worklist_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_worklist_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_worklist_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_worklist_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_order_readiness_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_order_readiness
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_order_readiness_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_bin_stock_detail_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_bin_stock_detail
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_bin_stock_detail_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_order_component_detail_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_order_component_detail
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_order_component_detail_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_operator_activity_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_operator_activity
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_operator_activity_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_queue_workload_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_queue_workload
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_queue_workload_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_campaign_summary_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_campaign_summary
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_campaign_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_uat.gold_io_reporting.gold_wm_daily_activity_secured AS
  SELECT * FROM connected_plant_uat.gold_io_reporting.gold_wm_daily_activity
  WHERE EXISTS (
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'full view'
      AND COALESCE(enabled, true)
    UNION ALL
    SELECT 1 FROM connected_plant_uat.gold_io_reporting.security_model_fixture
    WHERE current_user() = email
      AND application_key = 'io_reporting'
      AND LOWER(access_type) = 'filter'
      AND array_contains(filter_plant, plant_code)
      AND COALESCE(enabled, true)
  );
GRANT SELECT ON VIEW connected_plant_uat.gold_io_reporting.gold_wm_daily_activity_secured TO `users`;

-- ── Base-table access hardening ──
-- The actual REVOKE statements are generated as a SEPARATE admin script
-- (resources/sql/gold_security_harden_uat.sql). Apply it AFTER this script so plant-scoped users
-- can only read the *_secured views, not the un-trimmed base Gold tables (ADR 012).
-- It is kept separate because revoking broad access is operationally sensitive and irreversible-ish.
