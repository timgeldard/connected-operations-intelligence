-- Unity Catalog Row Filter — plant-level access control for silver tables (PROD).
-- Run once as a Unity Catalog admin after the first prod deploy.
-- Requires: CREATE FUNCTION privilege on connected_plant_prod.silver.

CREATE OR REPLACE FUNCTION connected_plant_prod.silver.plant_access_filter(plant_code STRING)
RETURNS BOOLEAN
RETURN CASE
  WHEN IS_ACCOUNT_GROUP_MEMBER('silver_admin') THEN TRUE
  ELSE array_contains(
    split(current_user_attribute('allowed_plants'), ','),
    plant_code
  )
END;

-- Apply to all silver tables with a plant_code column.

ALTER TABLE connected_plant_prod.silver.process_order
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.process_order_operation
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.pi_sheet_execution
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.goods_movement
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.batch_stock
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.warehouse_transfer_order
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.warehouse_transfer_requirement
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.downtime_event
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.quality_inspection_lot
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.material
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.storage_location
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.work_centre
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.capacity_utilisation
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);
