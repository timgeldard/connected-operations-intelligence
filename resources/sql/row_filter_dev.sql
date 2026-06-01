-- Unity Catalog Row Filter — plant-level access control for silver tables (DEV).
-- Run once as a Unity Catalog admin after the first dev deploy.
-- Requires: CREATE FUNCTION privilege on connected_plant_dev.silver_dev.
-- Ordering is intentional: CREATE OR REPLACE FUNCTION must run before any ALTER TABLE SET ROW FILTER.
-- WARNING: Generated automatically by scripts/generate_row_filter_sql.py. Do not edit manually.

CREATE OR REPLACE FUNCTION connected_plant_dev.silver_dev.plant_access_filter(plant_code STRING)
RETURNS BOOLEAN
RETURN CASE
  WHEN IS_ACCOUNT_GROUP_MEMBER('silver_admin') THEN TRUE
  WHEN plant_code = 'SHARED' AND current_user_attribute('allowed_plants') IS NOT NULL THEN TRUE
  ELSE array_contains(
    transform(split(current_user_attribute('allowed_plants'), ','), x -> trim(x)),
    plant_code
  )
END;

-- Apply to all silver tables with a plant_code column.

ALTER TABLE connected_plant_dev.silver_dev.process_order
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.process_order_operation
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.pi_sheet_execution
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.goods_movement
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.batch_stock
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.warehouse_transfer_order
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.warehouse_transfer_requirement
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.downtime_event
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.quality_inspection_lot
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.material
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.storage_location
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.work_centre
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.capacity_utilisation
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.storage_bin
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.plant
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.reservation_requirement
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.outbound_delivery
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.stock_at_location
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.purchase_order
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_dev.silver_dev.handling_unit
  SET ROW FILTER connected_plant_dev.silver_dev.plant_access_filter ON (plant_code);
