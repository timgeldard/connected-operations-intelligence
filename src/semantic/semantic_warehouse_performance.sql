-- Curated warehouse performance view.
-- Run in the Gold schema after secured/live serving views are created.

CREATE OR REPLACE VIEW semantic_warehouse_performance AS
WITH to_perf AS (
  SELECT
    plant_code,
    warehouse_number,
    sum(to_item_count) AS confirmed_to_item_count,
    sum(confirmed_qty) AS confirmed_qty,
    avg(pick_accuracy) AS avg_pick_accuracy,
    avg(fully_confirmed_rate) AS avg_fully_confirmed_rate
  FROM gold_transfer_order_performance_secured
  GROUP BY plant_code, warehouse_number
),
tr_backlog AS (
  SELECT
    plant_code,
    warehouse_number,
    sum(backlog_item_count) AS tr_backlog_item_count,
    sum(open_qty) AS tr_open_qty,
    min(oldest_created_datetime) AS oldest_tr_created_datetime
  FROM gold_transfer_requirement_backlog_secured
  GROUP BY plant_code, warehouse_number
),
inbound AS (
  SELECT
    plant_code,
    sum(open_item_count) AS inbound_open_item_count,
    sum(remaining_open_qty) AS inbound_remaining_open_qty,
    max(oldest_po_age_days) AS oldest_po_age_days,
    max(inbound_backlog_risk_band) AS inbound_backlog_risk_band
  FROM gold_inbound_po_backlog_enhanced_live
  GROUP BY plant_code
)
SELECT
  coalesce(t.plant_code, r.plant_code, i.plant_code) AS plant_code,
  coalesce(t.warehouse_number, r.warehouse_number) AS warehouse_number,
  t.confirmed_to_item_count,
  t.confirmed_qty,
  t.avg_pick_accuracy,
  t.avg_fully_confirmed_rate,
  r.tr_backlog_item_count,
  r.tr_open_qty,
  r.oldest_tr_created_datetime,
  i.inbound_open_item_count,
  i.inbound_remaining_open_qty,
  i.oldest_po_age_days,
  i.inbound_backlog_risk_band
FROM to_perf AS t
FULL OUTER JOIN tr_backlog AS r
  ON t.plant_code = r.plant_code
 AND t.warehouse_number = r.warehouse_number
LEFT JOIN inbound AS i
  ON coalesce(t.plant_code, r.plant_code) = i.plant_code;
