-- Unity Catalog Row Filter — plant-level access control for silver tables (UAT).
-- Run once as a Unity Catalog admin after the first UAT deploy.
-- Requires: CREATE FUNCTION privilege on connected_plant_uat.silver.

CREATE OR REPLACE FUNCTION connected_plant_uat.silver.plant_access_filter(plant_code STRING)
RETURNS BOOLEAN
RETURN CASE
  WHEN IS_ACCOUNT_GROUP_MEMBER('silver_admin') THEN TRUE
  ELSE array_contains(
    split(current_user_attribute('allowed_plants'), ','),
    plant_code
  )
END;

-- Apply to all silver tables with a plant_code column.

ALTER TABLE connected_plant_uat.silver.process_order
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.process_order_operation
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.pi_sheet_execution
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.goods_movement
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.batch_stock
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.warehouse_transfer_order
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.warehouse_transfer_requirement
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.downtime_event
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.quality_inspection_lot
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.material
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.storage_location
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.work_centre
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_uat.silver.capacity_utilisation
  SET ROW FILTER connected_plant_uat.silver.plant_access_filter ON (plant_code);
