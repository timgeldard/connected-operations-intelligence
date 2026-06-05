-- Curated stock health view.
-- Run in the Gold schema after secured/live serving views are created.

CREATE OR REPLACE VIEW semantic_stock_health AS
WITH availability AS (
  SELECT
    plant_code,
    sum(available_qty) AS available_qty,
    sum(unavailable_qty) AS unavailable_qty,
    sum(total_stock_qty) AS total_stock_qty
  FROM gold_stock_availability_secured
  GROUP BY plant_code
),
expiry AS (
  SELECT
    plant_code,
    sum(expired_qty) AS expired_qty,
    sum(expiry_risk_lt_7d_qty) AS expiry_risk_lt_7d_qty,
    sum(expiry_risk_7_30d_qty) AS expiry_risk_7_30d_qty,
    sum(minimum_shelf_life_breach_qty) AS minimum_shelf_life_breach_qty
  FROM gold_stock_expiry_risk_live
  GROUP BY plant_code
),
reconciliation AS (
  SELECT
    plant_code,
    sum(exception_count) AS reconciliation_exception_count,
    sum(abs_delta_quantity_total) AS abs_delta_quantity_total,
    sum(abs_delta_value_total) AS abs_delta_value_total,
    max(CASE WHEN reconciliation_status = 'ACTION_REQUIRED' THEN 1 ELSE 0 END) AS has_action_required_recon
  FROM gold_stock_reconciliation_summary_secured
  GROUP BY plant_code
)
SELECT
  coalesce(a.plant_code, e.plant_code, r.plant_code) AS plant_code,
  a.available_qty,
  a.unavailable_qty,
  a.total_stock_qty,
  e.expired_qty,
  e.expiry_risk_lt_7d_qty,
  e.expiry_risk_7_30d_qty,
  e.minimum_shelf_life_breach_qty,
  r.reconciliation_exception_count,
  r.abs_delta_quantity_total,
  r.abs_delta_value_total,
  coalesce(r.has_action_required_recon, 0) = 1 AS has_action_required_recon
FROM availability AS a
FULL OUTER JOIN expiry AS e
  ON a.plant_code = e.plant_code
FULL OUTER JOIN reconciliation AS r
  ON coalesce(a.plant_code, e.plant_code) = r.plant_code;
