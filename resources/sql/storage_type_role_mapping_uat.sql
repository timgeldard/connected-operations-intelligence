-- Governed storage-type → role config (UAT). Generated from resources/config/storage_type_role_mapping.csv by scripts/generate_storage_type_role_sql.py — do not edit manually.
-- Run once as a UC admin; thereafter maintain rows directly (or re-seed from the CSV).
-- The silver.storage_type_role_mapping DLT table reads APPROVED, in-window rows from here.

CREATE TABLE IF NOT EXISTS connected_plant_uat.silver.storage_type_role_mapping_config (
  plant_code STRING, warehouse_number STRING, storage_type STRING, role STRING,
  valid_from DATE, valid_to DATE, owner STRING, review_status STRING
) USING DELTA;

-- Reseed from the CSV (idempotent full refresh of the seeded plant(s)):
DELETE FROM connected_plant_uat.silver.storage_type_role_mapping_config WHERE owner = 'wm-config-owner';
INSERT INTO connected_plant_uat.silver.storage_type_role_mapping_config (plant_code, warehouse_number, storage_type, role, valid_from, valid_to, owner, review_status) VALUES
  ('C061', '208', '100', 'LINESIDE', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '801', 'LINESIDE', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '802', 'LINESIDE', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '803', 'LINESIDE', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '804', 'LINESIDE', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '805', 'LINESIDE', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '901', 'INTERIM', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '902', 'INTERIM', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '911', 'INTERIM', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '922', 'INTERIM', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED'),
  ('C061', '208', '999', 'INTERIM', DATE'2024-01-01', NULL, 'wm-config-owner', 'APPROVED');
