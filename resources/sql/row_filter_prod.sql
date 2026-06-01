-- Unity Catalog Row Filter — plant-level access control for silver tables (PROD).
-- Run once as a Unity Catalog admin after the first prod deploy.
-- Requires: CREATE FUNCTION privilege on connected_plant_prod.silver.
-- Ordering is intentional: CREATE OR REPLACE FUNCTION must run before any ALTER TABLE SET ROW FILTER.
-- WARNING: Generated automatically by scripts/generate_row_filter_sql.py. Do not edit manually.

CREATE OR REPLACE FUNCTION connected_plant_prod.silver.plant_access_filter(plant_code STRING)
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

ALTER TABLE connected_plant_prod.silver.storage_bin
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.plant
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.reservation_requirement
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.outbound_delivery
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);

ALTER TABLE connected_plant_prod.silver.stock_at_location
  SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);
