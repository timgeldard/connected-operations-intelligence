-- Seed a SAMPLED central_services into the DEV catalog so the `dev_sample` target is fully
-- isolated (its published_* now points at connected_plant_dev.central_services, not live UAT).
--
-- Run ONCE as an admin from a workspace/identity with READ on published_uat.central_services and
-- WRITE on connected_plant_dev. Re-runnable (CREATE OR REPLACE). After seeding, the dev_sample
-- pipelines read only connected_plant_dev at runtime — no reach into published_uat.
--
-- Sampling strategy:
--   * Dimensions (T001W / KNA1 / LFA1) and warehouse map (T320): full copy — small, and every row
--     may be referenced by the sampled SAP source.
--   * Classification (INOB / AUSP / CAWNT): copy only the slice the readers use (class type 018,
--     PLKO objects, value descriptions), which keeps the large AUSP table small while still
--     resolving recipe_process_line for any classified recipe.
--   * Transactional header/item pairs (EKKO→EKPO, VEKP→VEPO): sample the header, then pull only
--     the matching items, so purchase_order / handling_unit joins stay referentially consistent.
--     Adjust SAMPLE_HEADERS or add a plant (WERKS) filter to align with connected_plant_dev.sap_sample.

CREATE SCHEMA IF NOT EXISTS connected_plant_dev.central_services;

-- ── Dimensions (full copy) ────────────────────────────────────────────────────
CREATE OR REPLACE TABLE connected_plant_dev.central_services.plantcode_t001w AS
  SELECT * FROM published_uat.central_services.plantcode_t001w;

CREATE OR REPLACE TABLE connected_plant_dev.central_services.customermaster_kna1 AS
  SELECT * FROM published_uat.central_services.customermaster_kna1;

CREATE OR REPLACE TABLE connected_plant_dev.central_services.vendormaster_lfa1 AS
  SELECT * FROM published_uat.central_services.vendormaster_lfa1;

CREATE OR REPLACE TABLE connected_plant_dev.central_services.warehouseforplant_t320 AS
  SELECT * FROM published_uat.central_services.warehouseforplant_t320;

-- ── Classification for recipe_process_line (filtered to the readers' slice) ─────
CREATE OR REPLACE TABLE connected_plant_dev.central_services.internalnumberobjectlink_inob AS
  SELECT * FROM published_uat.central_services.internalnumberobjectlink_inob
  WHERE KLART = '018' AND OBTAB = 'PLKO';

CREATE OR REPLACE TABLE connected_plant_dev.central_services.objectcharacteristics_ausp AS
  SELECT * FROM published_uat.central_services.objectcharacteristics_ausp
  WHERE KLART = '018';

CREATE OR REPLACE TABLE connected_plant_dev.central_services.characteristicvaluedescription_cawnt AS
  SELECT * FROM published_uat.central_services.characteristicvaluedescription_cawnt;

-- ── Purchase orders (EKKO header → EKPO items, referentially consistent) ────────
CREATE OR REPLACE TABLE connected_plant_dev.central_services.procurementorderobject_ekko AS
  SELECT * FROM published_uat.central_services.procurementorderobject_ekko
  ORDER BY EBELN  -- deterministic sample (LIMIT alone is non-deterministic under parallel scan)
  LIMIT 20000;  -- SAMPLE_HEADERS

CREATE OR REPLACE TABLE connected_plant_dev.central_services.procurementorderobject_ekpo AS
  SELECT i.* FROM published_uat.central_services.procurementorderobject_ekpo i
  WHERE i.EBELN IN (
    SELECT EBELN FROM connected_plant_dev.central_services.procurementorderobject_ekko
  );

-- ── Handling units (VEKP header → VEPO items, referentially consistent) ─────────
CREATE OR REPLACE TABLE connected_plant_dev.central_services.handlingunit_vekp AS
  SELECT * FROM published_uat.central_services.handlingunit_vekp
  ORDER BY VENUM  -- deterministic sample (LIMIT alone is non-deterministic under parallel scan)
  LIMIT 20000;  -- SAMPLE_HEADERS

CREATE OR REPLACE TABLE connected_plant_dev.central_services.handlingunit_vepo AS
  SELECT i.* FROM published_uat.central_services.handlingunit_vepo i
  WHERE i.VENUM IN (
    SELECT VENUM FROM connected_plant_dev.central_services.handlingunit_vekp
  );
