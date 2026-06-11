-- Governed readiness configuration (UAT).
-- WARNING: Generated automatically by scripts/generate_readiness_config_sql.py. Do not edit manually.

-- ── site_config_plant ──
CREATE TABLE IF NOT EXISTS connected_plant_uat.silver_io_reporting.site_config_plant (
  plant_code STRING,
  plant_name STRING,
  country STRING,
  region STRING,
  business_unit STRING,
  timezone STRING,
  sap_system_id STRING,
  go_live_status STRING,
  wm_enabled_flag BOOLEAN,
  hu_enabled_flag BOOLEAN,
  qm_enabled_flag BOOLEAN,
  spc_enabled_flag BOOLEAN,
  batch_managed_flag BOOLEAN,
  process_manufacturing_flag BOOLEAN,
  default_language_code STRING,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN,
  config_owner STRING,
  last_validated_at DATE
) USING DELTA;

BEGIN;
DELETE FROM connected_plant_uat.silver_io_reporting.site_config_plant WHERE config_owner = 'wm-config-owner';
INSERT INTO connected_plant_uat.silver_io_reporting.site_config_plant (plant_code, plant_name, country, region, business_unit, timezone, sap_system_id, go_live_status, wm_enabled_flag, hu_enabled_flag, qm_enabled_flag, spc_enabled_flag, batch_managed_flag, process_manufacturing_flag, default_language_code, valid_from, valid_to, is_active, config_owner, last_validated_at) VALUES
  ('C061', 'Portbury [MFG]', 'GB', 'Europe', 'Operations', 'Europe/London', 'ECC', 'PRODUCTION', true, true, true, true, true, true, 'EN', DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner', DATE'2026-06-03'),
  ('P817', 'Jackson [MFG]', 'US', 'Americas', 'Operations', 'America/Chicago', 'ECC', 'PRODUCTION', true, true, true, true, true, true, 'EN', DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner', DATE'2026-06-08'),
  ('P806', 'Clark North [MFG]', 'US', 'Americas', 'Operations', 'America/New_York', 'ECC', 'PRODUCTION', true, true, true, true, true, true, 'EN', DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner', DATE'2026-06-11'),
  ('C351', 'Olesnica [MFG]', 'PL', 'Europe', 'Operations', 'Europe/Warsaw', 'ECC', 'PRODUCTION', true, true, true, true, true, true, 'EN', DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner', DATE'2026-06-11');
COMMIT;

-- ── site_config_warehouse ──
CREATE TABLE IF NOT EXISTS connected_plant_uat.silver_io_reporting.site_config_warehouse (
  plant_code STRING,
  warehouse_number STRING,
  warehouse_description STRING,
  relationship_type STRING,
  wm_usage_type STRING,
  is_shared_warehouse BOOLEAN,
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN,
  config_owner STRING
) USING DELTA;

BEGIN;
DELETE FROM connected_plant_uat.silver_io_reporting.site_config_warehouse WHERE config_owner = 'wm-config-owner';
INSERT INTO connected_plant_uat.silver_io_reporting.site_config_warehouse (plant_code, warehouse_number, warehouse_description, relationship_type, wm_usage_type, is_shared_warehouse, valid_from, valid_to, is_active, config_owner) VALUES
  ('C061', '104', 'Portbury Main WH', 'PRIMARY', 'FULL_WM', false, DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner'),
  ('P817', '208', 'Jackson Main WH', 'PRIMARY', 'FULL_WM', false, DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner'),
  ('P806', '190', 'Clark North Main WH', 'PRIMARY', 'FULL_WM', false, DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner'),
  ('C351', '105', 'Olesnica Main WH', 'PRIMARY', 'FULL_WM', false, DATE'2026-01-01', DATE'9999-12-31', true, 'wm-config-owner');
COMMIT;

-- ── site_config_storage_type_role ──
CREATE TABLE IF NOT EXISTS connected_plant_uat.silver_io_reporting.site_config_storage_type_role (
  plant_code STRING,
  warehouse_number STRING,
  storage_type STRING,
  storage_type_description STRING,
  storage_role STRING,
  role_confidence STRING,
  is_wm_managed BOOLEAN,
  include_in_lineside_stock BOOLEAN,
  include_in_staging BOOLEAN,
  include_in_reconciliation BOOLEAN,
  valid_from DATE,
  valid_to DATE,
  validated_by STRING,
  validated_at DATE
) USING DELTA;

BEGIN;
DELETE FROM connected_plant_uat.silver_io_reporting.site_config_storage_type_role WHERE validated_by = 'wm-config-owner';
INSERT INTO connected_plant_uat.silver_io_reporting.site_config_storage_type_role (plant_code, warehouse_number, storage_type, storage_type_description, storage_role, role_confidence, is_wm_managed, include_in_lineside_stock, include_in_staging, include_in_reconciliation, valid_from, valid_to, validated_by, validated_at) VALUES
  ('C061', '104', '100', 'Production Supply', 'LINESIDE', 'CONFIRMED', true, true, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '801', 'Palletising (for Prodc.)', 'LINESIDE', 'CONFIRMED', true, true, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '802', 'Palletising (for Dispn.)', 'LINESIDE', 'CONFIRMED', true, true, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '901', 'GR Area for Production', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '902', 'GR Area External Rcpts', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '911', 'GI Area for Cost Center', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '922', 'Posting Change Area', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('C061', '104', '999', 'Differences', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '100', 'Production Supply', 'LINESIDE', 'CONFIRMED', true, true, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '801', 'Palletising (for Prodc.)', 'LINESIDE', 'CONFIRMED', true, true, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '802', 'Palletising (for Dispn.)', 'LINESIDE', 'CONFIRMED', true, true, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '901', 'GR Area for Production', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '902', 'GR Area External Rcpts', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '911', 'GI Area for Cost Center', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '922', 'Posting Change Area', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08'),
  ('P817', '208', '999', 'Differences', 'INTERIM', 'CONFIRMED', true, false, false, true, DATE'2026-01-01', DATE'9999-12-31', 'wm-config-owner', DATE'2026-06-08');
COMMIT;

-- ── site_config_movement_type_classification ──
CREATE TABLE IF NOT EXISTS connected_plant_uat.silver_io_reporting.site_config_movement_type_classification (
  plant_code STRING,
  movement_type_code STRING,
  movement_text STRING,
  event_category STRING,
  is_production_receipt BOOLEAN,
  is_production_consumption BOOLEAN,
  is_scrap BOOLEAN,
  is_reversal BOOLEAN,
  reversal_of_movement_type STRING,
  is_inbound_receipt BOOLEAN,
  is_outbound_issue BOOLEAN,
  is_stock_adjustment BOOLEAN,
  classification_source STRING,
  validation_status STRING,
  valid_from DATE,
  valid_to DATE
) USING DELTA;

BEGIN;
DELETE FROM connected_plant_uat.silver_io_reporting.site_config_movement_type_classification WHERE plant_code = 'C061' OR plant_code IS NULL;
INSERT INTO connected_plant_uat.silver_io_reporting.site_config_movement_type_classification (plant_code, movement_type_code, movement_text, event_category, is_production_receipt, is_production_consumption, is_scrap, is_reversal, reversal_of_movement_type, is_inbound_receipt, is_outbound_issue, is_stock_adjustment, classification_source, validation_status, valid_from, valid_to) VALUES
  (NULL, '101', 'Goods Receipt Production', 'GOODS_RECEIPT', true, false, false, false, NULL, false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '102', 'Reversal GR Production', 'GOODS_RECEIPT', false, false, false, true, '101', false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '261', 'Goods Issue Production', 'GOODS_ISSUE', false, true, false, false, NULL, false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '262', 'Reversal GI Production', 'GOODS_ISSUE', false, false, false, true, '261', false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '551', 'Goods Issue Scrapping', 'GOODS_ISSUE', false, false, true, false, NULL, false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '552', 'Reversal GI Scrapping', 'GOODS_ISSUE', false, false, false, true, '551', false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '601', 'Goods Issue Delivery', 'GOODS_ISSUE', false, false, false, false, NULL, false, true, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '602', 'Reversal GI Delivery', 'GOODS_ISSUE', false, false, false, true, '601', false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '103', 'Goods Receipt PO', 'GOODS_RECEIPT', false, false, false, false, NULL, true, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31'),
  (NULL, '104', 'Reversal GR PO', 'GOODS_RECEIPT', false, false, false, true, '103', false, false, false, 'GLOBAL_OVERLAY', 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31');
COMMIT;

-- ── site_config_staging_method ──
CREATE TABLE IF NOT EXISTS connected_plant_uat.silver_io_reporting.site_config_staging_method (
  plant_code STRING,
  warehouse_number STRING,
  production_supply_area STRING,
  storage_type STRING,
  staging_method STRING,
  sap_reference_pattern STRING,
  requires_batch_scan BOOLEAN,
  requires_sscc BOOLEAN,
  validation_status STRING,
  valid_from DATE,
  valid_to DATE
) USING DELTA;

BEGIN;
DELETE FROM connected_plant_uat.silver_io_reporting.site_config_staging_method WHERE plant_code = 'C061' OR plant_code IS NULL;
INSERT INTO connected_plant_uat.silver_io_reporting.site_config_staging_method (plant_code, warehouse_number, production_supply_area, storage_type, staging_method, sap_reference_pattern, requires_batch_scan, requires_sscc, validation_status, valid_from, valid_to) VALUES
  ('C061', '208', 'Supply Area 1', '100', 'ORDER_SPECIFIC', 'TO_BENUM_EQUALS_AUFNR', false, false, 'CONFIRMED', DATE'2026-01-01', DATE'9999-12-31');
COMMIT;

-- ── site_config_kpi_enablement ──
CREATE TABLE IF NOT EXISTS connected_plant_uat.silver_io_reporting.site_config_kpi_enablement (
  plant_code STRING,
  data_product_name STRING,
  kpi_name STRING,
  enablement_status STRING,
  reason_code STRING,
  approved_by STRING,
  approved_at DATE,
  review_due_at DATE
) USING DELTA;

BEGIN;
DELETE FROM connected_plant_uat.silver_io_reporting.site_config_kpi_enablement WHERE approved_by = 'wm-config-owner';
INSERT INTO connected_plant_uat.silver_io_reporting.site_config_kpi_enablement (plant_code, data_product_name, kpi_name, enablement_status, reason_code, approved_by, approved_at, review_due_at) VALUES
  ('C061', 'gold_transfer_requirement_backlog', 'TR Backlog', 'ENABLED', 'GO_LIVE', 'wm-config-owner', DATE'2026-06-03', DATE'2027-06-03'),
  ('C061', 'gold_lineside_stock', 'Lineside Stock', 'ENABLED', 'GO_LIVE', 'wm-config-owner', DATE'2026-06-03', DATE'2027-06-03'),
  ('C061', 'gold_process_order_staging', 'PO Staging', 'ENABLED', 'GO_LIVE', 'wm-config-owner', DATE'2026-06-03', DATE'2027-06-03'),
  ('C061', 'gold_stock_reconciliation', 'Stock Reconciliation', 'PILOT_ONLY', 'PILOT', 'wm-config-owner', DATE'2026-06-03', DATE'2027-06-03'),
  ('C061', 'gold_shift_output_summary', 'Shift Output', 'BLOCKED', 'NO_SHIFT_CALENDAR', 'wm-config-owner', DATE'2026-06-03', DATE'2027-06-03');
COMMIT;

