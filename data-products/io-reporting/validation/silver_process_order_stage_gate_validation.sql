-- Process-order Silver plant/site stage-gate validation
-- Target: connected_plant_dev (DEV, profile TG, warehouse 8fae28f1808dbf75)
--   source schema = connected_plant_dev.sap ; silver schema = connected_plant_dev.silver_io_reporting
-- Contract: source-contracts/site_stage_gate_contract.md. Read-only; safe to re-run. Swap catalog for UAT/PROD.
--
-- Purpose: verify process-order Bronze->Silver is scoped to onboarded plants, and make the recurring
-- COST IMPACT visible (all-plant input vs gated output, % retained). Bronze stays raw — "before" reads
-- Bronze; "after" reads the gated Silver output. Run AFTER a silver_fast rerun with the gate active.

-- ============================================================================
-- SECTION 1 — active process-order plants in the gate (process_manufacturing_flag)
-- ============================================================================
SELECT 'active_process_order_plants' AS metric, COUNT(*) AS n,
       concat_ws(',', sort_array(collect_set(plant_code))) AS plants
FROM connected_plant_dev.silver_io_reporting.site_config_plant
WHERE is_active AND go_live_status NOT IN ('BLOCKED','DECOMMISSIONED','SUSPENDED')
  AND process_manufacturing_flag;

-- ============================================================================
-- SECTION 2 — COST IMPACT for process_order (header). before = Bronze AUFK; after = gated Silver.
--   AUFK holds ALL order types; the flow further restricts to PP/PI (AUTYP='40'). The gate cuts to
--   onboarded plants. percent_retained shows the recurring-cost reduction.
-- ============================================================================
SELECT
  (SELECT COUNT(*) FROM connected_plant_dev.sap.ordermaster_aufk)                          AS bronze_aufk_all_order_types,
  (SELECT COUNT(*) FROM connected_plant_dev.sap.ordermaster_aufk WHERE AUTYP = '40')        AS bronze_aufk_pp_pi_all_plants,
  (SELECT COUNT(*) FROM connected_plant_dev.silver_io_reporting.process_order)              AS silver_process_order_after_gate,
  ROUND(100.0 * (SELECT COUNT(*) FROM connected_plant_dev.silver_io_reporting.process_order)
        / NULLIF((SELECT COUNT(*) FROM connected_plant_dev.sap.ordermaster_aufk WHERE AUTYP='40'), 0), 2)
                                                                                            AS percent_of_pp_pi_retained;

-- ============================================================================
-- SECTION 3 — by-plant row counts for Silver process_order (post-gate; expect ONLY active plants)
-- ============================================================================
SELECT plant_code, COUNT(*) AS n
FROM connected_plant_dev.silver_io_reporting.process_order
GROUP BY plant_code
ORDER BY n DESC;

-- ============================================================================
-- SECTION 4 — LEAK CHECK: Silver process_order plant not in the active gate. MUST be zero rows.
-- ============================================================================
SELECT 'process_order_unapproved_plant' AS check, plant_code, COUNT(*) AS n
FROM connected_plant_dev.silver_io_reporting.process_order
WHERE plant_code NOT IN (
  SELECT plant_code FROM connected_plant_dev.silver_io_reporting.site_config_plant
  WHERE is_active AND go_live_status NOT IN ('BLOCKED','DECOMMISSIONED','SUSPENDED')
    AND process_manufacturing_flag
    AND plant_code IS NOT NULL)   -- NULL-safe NOT IN
GROUP BY plant_code;

-- ============================================================================
-- SECTION 5 — null plant_code after gate (expect 0; the gate's inner join drops null-plant rows,
--   including null-plant delete rows from changed_keys with no matching active-plant AUFK).
-- ============================================================================
SELECT SUM(CASE WHEN plant_code IS NULL THEN 1 ELSE 0 END) AS null_plant_should_be_0,
       COUNT(*) AS rows_total
FROM connected_plant_dev.silver_io_reporting.process_order;

-- ============================================================================
-- SECTION 6 — source-guarded process-order flows (gate applied, but NOT materialised yet)
--   process_order_operation / pi_sheet_execution / downtime_event are source-guarded OFF because their
--   sources (AFVV / zmanpex / zpexpm_dwnt) lack AERUNID/AERECNO CDC metadata. The plant gate IS applied
--   in code (gate-ready) — it activates when CDC is replicated. Expect these tables to be ABSENT.
-- ============================================================================
SELECT table_name,
       'present (unexpected — should be source-guarded off until CDC)' AS note
FROM connected_plant_dev.information_schema.tables
WHERE table_schema = 'silver_io_reporting'
  AND table_name IN ('process_order_operation', 'pi_sheet_execution', 'downtime_event');
-- (zero rows = all three correctly absent / source-guarded)
