-- Silver plant/site stage-gate validation
-- Target: connected_plant_dev (DEV, profile TG, warehouse 8fae28f1808dbf75)
--   source schema = connected_plant_dev.sap ; silver schema = connected_plant_dev.silver_io_reporting
-- Contract: source-contracts/site_stage_gate_contract.md. Read-only; safe to re-run. Swap catalog for UAT/PROD.
--
-- Verifies that operational Silver outputs contain ONLY plants/warehouses approved by the governed gate
-- (site_config_plant / site_config_warehouse), with before/after evidence. Bronze stays raw — "before"
-- counts read Bronze directly; "after" counts read the gated Silver output.

-- ============================================================================
-- SECTION 1 — the active gate (must be non-empty; empty gate => misconfiguration)
-- ============================================================================
SELECT 'active_plants' AS metric, COUNT(*) AS n,
       concat_ws(',', sort_array(collect_set(plant_code))) AS values
FROM connected_plant_dev.silver_io_reporting.site_config_plant
WHERE is_active AND go_live_status NOT IN ('BLOCKED','DECOMMISSIONED','SUSPENDED');

SELECT 'active_warehouses' AS metric, COUNT(*) AS n,
       concat_ws(',', sort_array(collect_set(concat(warehouse_number,'->',plant_code)))) AS values
FROM connected_plant_dev.silver_io_reporting.site_config_warehouse
WHERE is_active;

-- ============================================================================
-- SECTION 2 — before/after row counts for the ENFORCED reference flows
--   before = Bronze (all plants/warehouses, raw) ; after = gated Silver output
-- ============================================================================
-- Direct-plant flows (gate field WERKS):
SELECT 'goods_movement' AS flow,
       (SELECT COUNT(*) FROM connected_plant_dev.sap.inventorymovement_mseg)            AS bronze_rows,
       (SELECT COUNT(*) FROM connected_plant_dev.silver_io_reporting.goods_movement)    AS silver_rows_after_gate;
SELECT 'batch_stock' AS flow,
       (SELECT COUNT(*) FROM connected_plant_dev.sap.batchstock_mchb)                   AS bronze_rows,
       (SELECT COUNT(*) FROM connected_plant_dev.silver_io_reporting.batch_stock)       AS silver_rows_after_gate;
-- Warehouse-gated flows:
SELECT 'warehouse_transfer_order' AS flow,
       (SELECT COUNT(*) FROM connected_plant_dev.sap.transferorderobjects_ltap)         AS bronze_item_rows,
       (SELECT COUNT(*) FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_order) AS silver_rows_after_gate;
SELECT 'warehouse_transfer_requirement' AS flow,
       (SELECT COUNT(*) FROM connected_plant_dev.sap.transferrequirementobjects_ltbp)   AS bronze_item_rows,
       (SELECT COUNT(*) FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_requirement) AS silver_rows_after_gate;

-- ============================================================================
-- SECTION 3 — LEAK CHECK: any ENFORCED operational output containing a plant/warehouse NOT in the gate.
--   Every query MUST return zero rows. A non-zero result is a gate failure.
-- ============================================================================
-- 3a. goods_movement plant_code not active:
SELECT 'goods_movement_unapproved_plant' AS check, plant_code, COUNT(*) AS n
FROM connected_plant_dev.silver_io_reporting.goods_movement
WHERE plant_code NOT IN (
  SELECT plant_code FROM connected_plant_dev.silver_io_reporting.site_config_plant
  WHERE is_active AND go_live_status NOT IN ('BLOCKED','DECOMMISSIONED','SUSPENDED'))
GROUP BY plant_code;

-- 3b. batch_stock plant_code not active:
SELECT 'batch_stock_unapproved_plant' AS check, plant_code, COUNT(*) AS n
FROM connected_plant_dev.silver_io_reporting.batch_stock
WHERE plant_code NOT IN (
  SELECT plant_code FROM connected_plant_dev.silver_io_reporting.site_config_plant
  WHERE is_active AND go_live_status NOT IN ('BLOCKED','DECOMMISSIONED','SUSPENDED'))
GROUP BY plant_code;

-- 3c. transfer_order warehouse_number not active:
SELECT 'transfer_order_unapproved_warehouse' AS check, warehouse_number, COUNT(*) AS n
FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_order
WHERE warehouse_number NOT IN (
  SELECT warehouse_number FROM connected_plant_dev.silver_io_reporting.site_config_warehouse WHERE is_active)
GROUP BY warehouse_number;

-- 3d. transfer_requirement warehouse_number not active:
SELECT 'transfer_requirement_unapproved_warehouse' AS check, warehouse_number, COUNT(*) AS n
FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_requirement
WHERE warehouse_number NOT IN (
  SELECT warehouse_number FROM connected_plant_dev.silver_io_reporting.site_config_warehouse WHERE is_active)
GROUP BY warehouse_number;

-- ============================================================================
-- SECTION 4 — governed plant_id enrichment on warehouse-gated flows
-- ============================================================================
-- 4a. plant_id must be populated (came from the mapping) on every gated WM row — expect 0 nulls:
SELECT 'transfer_order_null_plant_id' AS check,
       SUM(CASE WHEN plant_id IS NULL THEN 1 ELSE 0 END) AS null_plant_id_should_be_0,
       COUNT(*) AS rows_total
FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_order;

-- 4b. governed plant_id vs raw WERKS (plant_code) divergence — INFORMATIONAL (proves LGNUM != WERKS):
SELECT 'transfer_order_plantid_vs_werks' AS metric,
       SUM(CASE WHEN plant_id IS DISTINCT FROM plant_code THEN 1 ELSE 0 END) AS diverging_rows,
       COUNT(*) AS rows_total
FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_order;

-- ============================================================================
-- SECTION 5 — unmapped warehouses in Bronze (warehouses present in source but NOT in the gate mapping)
--   INFORMATIONAL: shows what the warehouse gate excludes. Read against Bronze LTAK.
-- ============================================================================
SELECT 'bronze_warehouses_not_in_gate' AS metric, LGNUM AS warehouse_number, COUNT(*) AS bronze_rows
FROM connected_plant_dev.sap.transferorderobjects_ltak
WHERE LGNUM NOT IN (
  SELECT warehouse_number FROM connected_plant_dev.silver_io_reporting.site_config_warehouse WHERE is_active)
GROUP BY LGNUM ORDER BY bronze_rows DESC LIMIT 25;

-- ============================================================================
-- SECTION 6 — by-plant row counts for the ENFORCED Silver Fast tables (post-gate; expect gate plants only)
-- ============================================================================
SELECT 'goods_movement' AS flow, plant_code, COUNT(*) n FROM connected_plant_dev.silver_io_reporting.goods_movement GROUP BY plant_code
UNION ALL SELECT 'batch_stock', plant_code, COUNT(*) FROM connected_plant_dev.silver_io_reporting.batch_stock GROUP BY plant_code
UNION ALL SELECT 'transfer_order(plant_id)', plant_id, COUNT(*) FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_order GROUP BY plant_id
UNION ALL SELECT 'transfer_requirement(plant_id)', plant_id, COUNT(*) FROM connected_plant_dev.silver_io_reporting.warehouse_transfer_requirement GROUP BY plant_id
ORDER BY flow, plant_code;
