-- WM Operations Consumption Views (PROD)
-- Target: connected_plant_prod.gold_io_reporting
-- Serves the WM Operations app workspace (apps/api routes /api/wm-operations/*) via the
-- governed contract pattern: app -> vw_consumption_wm_operations_* -> *_live/_secured -> gold MV.
-- Run once as a UC admin AFTER gold_security_prod.sql and gold_serving_views_prod.sql.

USE CATALOG connected_plant_prod;
CREATE SCHEMA IF NOT EXISTS gold_io_reporting;
USE SCHEMA gold_io_reporting;

-- 1. Staging / picking worklist
-- Grain: 1 row per plant_id + warehouse_id + tr_id (TR header). RLS inherited from
-- gold_wm_staging_worklist_secured via the _live view.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_worklist AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  transfer_requirement_number AS tr_id,
  work_area,
  worklist_status,
  source_reference_type AS reference_type,
  source_reference_number AS reference_id,
  order_material_code AS order_material_id,
  CAST(order_scheduled_start_date AS DATE) AS order_scheduled_start_date,
  source_storage_type,
  source_zone,
  destination_storage_type,
  destination_zone,
  destination_bin,
  queue,
  campaign_reference AS campaign_id,
  assigned_operator,
  job_sequence,
  transfer_priority,
  created_by_user,
  CAST(created_datetime AS TIMESTAMP) AS created_ts,
  CAST(planned_execution_datetime AS TIMESTAMP) AS planned_execution_ts,
  item_count,
  open_item_count,
  material_count,
  single_material_code AS material_id,
  single_material_description AS material_name,
  required_qty,
  open_qty,
  base_uom AS uom,
  has_mixed_base_uom,
  to_item_count,
  to_items_confirmed,
  to_confirmed_qty,
  CAST(latest_to_confirmed_date AS DATE) AS latest_to_confirmed_date,
  pick_progress_fraction,
  CAST(latest_to_confirmed_datetime AS TIMESTAMP) AS latest_to_confirmed_ts,
  cycle_hours,
  age_hours,
  is_overdue
FROM connected_plant_prod.gold_io_reporting.gold_wm_staging_worklist_live
WHERE plant_code IS NOT NULL;

-- 2. Worklist summary (manager KPI strip)
-- Grain: 1 row per plant_id + warehouse_id + work_area + worklist_status. No date-relative
-- columns, so it reads the _secured view directly.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_worklist_summary AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  work_area,
  worklist_status,
  tr_count,
  total_open_qty,
  total_required_qty,
  operator_count,
  CAST(earliest_planned_datetime AS TIMESTAMP) AS earliest_planned_ts,
  CAST(earliest_created_datetime AS TIMESTAMP) AS earliest_created_ts
FROM connected_plant_prod.gold_io_reporting.gold_wm_worklist_summary_secured
WHERE plant_code IS NOT NULL;

-- 3. Order staging readiness
-- Grain: 1 row per plant_id + order_id (released, not-closed process orders).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_readiness AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  warehouse_number AS warehouse_id,
  material_code AS material_id,
  material_name,
  order_quantity AS order_qty,
  uom,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  production_supply_area,
  component_count,
  wm_component_count,
  wm_component_required_qty,
  component_open_qty,
  tr_count,
  tr_required_qty,
  tr_open_qty,
  tr_coverage_status,
  psa_supplied_qty,
  supply_status,
  readiness_status,
  days_to_start,
  readiness_band
FROM connected_plant_prod.gold_io_reporting.gold_wm_order_readiness_live
WHERE plant_code IS NOT NULL;

-- 4. Bin / stock explorer
-- Grain: 1 row per plant_id + warehouse_id + quant_id (occupied bin quants only).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_bin_stock AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  storage_type,
  storage_zone,
  bin_code AS bin_id,
  picking_area,
  quant_number AS quant_id,
  material_code AS material_id,
  material_description AS material_name,
  batch_number AS batch_id,
  stock_category,
  total_quantity AS total_qty,
  available_quantity AS available_qty,
  putaway_quantity AS putaway_qty,
  pick_quantity AS pick_qty,
  open_transfer_quantity AS open_transfer_qty,
  base_uom AS uom,
  CAST(goods_receipt_date AS DATE) AS goods_receipt_date,
  CAST(expiry_date AS DATE) AS expiry_date,
  CAST(last_movement_datetime AS TIMESTAMP) AS last_movement_ts,
  is_blocked_for_stock_removal,
  is_blocked_for_putaway,
  is_bin_blocked,
  blocking_reason_code,
  days_to_expiry,
  is_expired
FROM connected_plant_prod.gold_io_reporting.gold_wm_bin_stock_detail_live
WHERE plant_code IS NOT NULL;

-- TODO_SECURITY: grants pending the approved consumer group. Applies to EVERY
-- vw_consumption_wm_operations_* view in this file (not just the first four) — grant in one
-- block once the principal is approved. The deployed app reads via its own identity flow
-- (fixture/RLS scripts), so these grants gate ad-hoc/pilot user access only. Example:
-- GRANT SELECT ON VIEW vw_consumption_wm_operations_worklist TO `<approved_group>`;  -- repeat per view


-- 5. Order component detail (drill-through behind Order Readiness)
-- Grain: 1 row per plant_id + order_id + reservation_id + reservation_item.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_components AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  reservation_number AS reservation_id,
  reservation_item,
  operation_number,
  warehouse_number AS warehouse_id,
  material_code AS material_id,
  material_description AS material_name,
  batch_number AS batch_id,
  required_quantity AS required_qty,
  open_quantity AS open_qty,
  uom,
  production_supply_area,
  CAST(requirement_date AS DATE) AS requirement_date,
  material_component_count,
  tr_count,
  tr_required_qty,
  tr_open_qty,
  tr_coverage_status,
  to_item_count,
  to_items_confirmed,
  to_confirmed_qty,
  pick_progress_fraction,
  psa_supplied_qty,
  is_supplied
FROM connected_plant_prod.gold_io_reporting.gold_wm_order_component_detail_secured
WHERE plant_code IS NOT NULL;

-- 6. Operator activity (pick performance history)
-- Grain: 1 row per plant_id + warehouse_id + operator + activity_date.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_operator_activity AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  operator,
  CAST(activity_date AS DATE) AS activity_date,
  shift,
  items_confirmed,
  transfer_orders,
  materials,
  transfer_requirements,
  confirmed_qty
FROM connected_plant_prod.gold_io_reporting.gold_wm_operator_activity_secured
WHERE plant_code IS NOT NULL;

-- 7. Queue workload (current open jobs by queue and work area)
-- Grain: 1 row per plant_id + warehouse_id + queue + work_area.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_queue_workload AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  queue,
  work_area,
  open_jobs,
  in_progress_jobs,
  parked_jobs,
  no_stock_jobs,
  operator_count,
  CAST(earliest_planned_datetime AS TIMESTAMP) AS earliest_planned_ts,
  CAST(earliest_created_datetime AS TIMESTAMP) AS earliest_created_ts
FROM connected_plant_prod.gold_io_reporting.gold_wm_queue_workload_secured
WHERE plant_code IS NOT NULL;

-- 8. Outbound delivery picking board (reuses the existing delivery-pick gold + live bands)
-- Grain: 1 row per plant_id + delivery_id.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_outbound AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  delivery_number AS delivery_id,
  delivery_type,
  ship_to_customer AS ship_to_customer_id,
  ship_to_customer_name,
  line_count,
  delivery_qty,
  picked_qty,
  pick_fraction,
  has_mixed_base_uom,
  CAST(planned_goods_issue_date AS DATE) AS planned_goods_issue_date,
  CAST(actual_goods_issue_date AS DATE) AS actual_goods_issue_date,
  is_shipped,
  days_to_goods_issue,
  risk_band
FROM connected_plant_prod.gold_io_reporting.gold_delivery_pick_status_live
WHERE plant_code IS NOT NULL;

-- 9. Reconciliation alerts (shift-handover digest input; severe IM<->WM / PI variances)
-- Grain: 1 row per alert_key.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recon_alerts AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  alert_key,
  alert_type,
  alert_priority,
  material_code AS material_id,
  batch_number AS batch_id,
  reason_code,
  delta_quantity AS delta_qty,
  delta_value
FROM connected_plant_prod.gold_io_reporting.gold_reconciliation_alerts_secured
WHERE plant_code IS NOT NULL;


-- 10. Handling-unit summary (inbound/putaway board)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_handling_units AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, handling_unit_status,
  reference_document_category, hu_item_count, distinct_sscc_count, distinct_hu_count,
  linked_delivery_count, distinct_material_count, total_gross_weight
FROM connected_plant_prod.gold_io_reporting.gold_handling_unit_summary_secured
WHERE plant_code IS NOT NULL;

-- 11. Stock expiry risk (stock health)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_expiry_risk AS
SELECT plant_code AS plant_id, material_code AS material_id, material_description AS material_name,
  batch_number AS batch_id, base_uom AS uom, CAST(minimum_expiry_date AS DATE) AS minimum_expiry_date,
  shelf_life_days, minimum_remaining_shelf_life_days, total_stock_qty,
  minimum_days_to_expiry, expired_qty, highest_expiry_risk_bucket, has_minimum_shelf_life_breach
FROM connected_plant_prod.gold_io_reporting.gold_stock_expiry_risk_live
WHERE plant_code IS NOT NULL;

-- 12. Stock holds (stock health)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_stock_holds AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, storage_type,
  storage_bin AS bin_id, quant_number AS quant_id, material_code AS material_id,
  batch_number AS batch_id, hold_type, quantity AS qty, base_uom AS uom,
  CAST(goods_receipt_date AS DATE) AS goods_receipt_date, age_hours
FROM connected_plant_prod.gold_io_reporting.gold_stock_holds_live
WHERE plant_code IS NOT NULL;

-- 13. Aged warehouse exceptions (MUST read _live — _secured rows are candidates, not confirmed)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_exceptions AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, exception_type, severity,
  sla_hours, material_code AS material_id, batch_number AS batch_id, reference_id,
  quantity AS qty, CAST(aging_reference_date AS DATE) AS aging_reference_date, age_days, detail
FROM connected_plant_prod.gold_io_reporting.gold_warehouse_exceptions_live
WHERE plant_code IS NOT NULL;

-- 14. Reconciliation exceptions (workbench detail)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recon_exceptions AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, material_code AS material_id,
  material_description AS material_name, batch_number AS batch_id, stock_category,
  base_uom AS uom, im_quantity AS im_qty, wm_quantity AS wm_qty, delta_quantity AS delta_qty,
  delta_percent, delta_value, mismatch_reason, mismatch_severity,
  is_operationally_trusted AS is_trusted
FROM connected_plant_prod.gold_io_reporting.gold_stock_reconciliation_exceptions_v2_secured
WHERE plant_code IS NOT NULL;

-- 15. Reconciliation value rollup (workbench summary)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recon_value_summary AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, mismatch_reason,
  mismatch_severity, row_count, tolerance_exceeded_count, net_delta_value,
  abs_delta_value, abs_delta_quantity, value_reconciliation_status
FROM connected_plant_prod.gold_io_reporting.gold_stock_value_reconciliation_secured
WHERE plant_code IS NOT NULL;

-- 16. Campaign summary (campaign board)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_campaigns AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id,
  campaign_reference AS campaign_id, tr_count, complete_trs, in_progress_trs, parked_trs,
  no_stock_trs, order_count, operator_count, work_area, required_qty, open_qty,
  CAST(earliest_planned_datetime AS TIMESTAMP) AS earliest_planned_ts,
  CAST(earliest_created_datetime AS TIMESTAMP) AS earliest_created_ts
FROM connected_plant_prod.gold_io_reporting.gold_wm_campaign_summary_secured
WHERE plant_code IS NOT NULL;

-- 17. Daily activity (trend facts)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_daily_activity AS
SELECT plant_code AS plant_id, CAST(activity_date AS DATE) AS activity_date,
  to_items_confirmed, active_operators, trs_created, goods_receipt_lines, goods_issue_lines
FROM connected_plant_prod.gold_io_reporting.gold_wm_daily_activity_secured
WHERE plant_code IS NOT NULL;

-- 18. Physical inventory reconciliation (handover section)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_physical_inventory AS
SELECT plant_code AS plant_id, physical_inventory_document_number AS pi_document_id,
  fiscal_year, item_number, storage_location_code AS storage_location_id,
  material_code AS material_id, batch_number AS batch_id,
  CAST(planned_count_date AS DATE) AS planned_count_date, CAST(count_date AS DATE) AS count_date,
  book_quantity AS book_qty, counted_quantity AS counted_qty, delta_quantity AS delta_qty,
  delta_value, is_counted, is_recount_required, is_difference_posted, physical_inventory_status
FROM connected_plant_prod.gold_io_reporting.gold_physical_inventory_recon_secured
WHERE plant_code IS NOT NULL;


-- 19. Bin occupancy & capacity (putaway planning)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_bin_occupancy AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, storage_type, bin_type,
  bin_record_count, occupied_bin_count, empty_bin_count, blocked_bin_count,
  stock_removal_blocked_bin_count, putaway_blocked_bin_count, occupancy_rate,
  total_stock_qty, available_stock_qty, open_transfer_stock_qty,
  total_max_quant_count, total_maximum_weight, quant_utilisation_fraction
FROM connected_plant_prod.gold_io_reporting.gold_bin_occupancy_secured
WHERE plant_code IS NOT NULL;

-- 20. Slow movers / dead stock (query-time aging)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_slow_movers AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, material_code AS material_id,
  material_description AS material_name, batch_number AS batch_id, base_uom AS uom,
  quant_count, total_qty, stock_value, standard_price,
  CAST(last_movement_datetime AS TIMESTAMP) AS last_movement_ts,
  CAST(earliest_goods_receipt_date AS DATE) AS earliest_goods_receipt_date,
  CAST(earliest_expiry_date AS DATE) AS earliest_expiry_date,
  days_since_last_movement, age_bucket
FROM connected_plant_prod.gold_io_reporting.gold_wm_slow_movers_live
WHERE plant_code IS NOT NULL;

-- 21. Movement control (IM postings vs WM confirmations)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_movement_control AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id,
  CAST(posting_date AS DATE) AS posting_date, material_code AS material_id,
  batch_number AS batch_id, base_uom AS uom, movement_type_code,
  im_document_line_count, im_movement_quantity AS im_qty, im_movement_value AS im_value,
  wm_to_line_count, wm_confirmed_quantity AS wm_qty,
  delta_quantity AS delta_qty, abs_delta_quantity AS abs_delta_qty,
  movement_reconciliation_status
FROM connected_plant_prod.gold_io_reporting.gold_movement_reconciliation_secured
WHERE plant_code IS NOT NULL;

-- 22. Staging pace (hourly staged-in throughput — derived from TO flows; bulk-drop log not replicated)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_staging_pace AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, destination_zone,
  CAST(activity_hour AS TIMESTAMP) AS activity_hour, items_staged, qty_staged, operators
FROM connected_plant_prod.gold_io_reporting.gold_wm_staging_pace_hourly_secured
WHERE plant_code IS NOT NULL;

-- 23. Staging demand wave (open TR qty by planned execution hour)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_staging_demand AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, work_area,
  production_supply_area,
  CAST(demand_hour AS TIMESTAMP) AS demand_hour, open_trs, open_qty
FROM connected_plant_prod.gold_io_reporting.gold_wm_staging_demand_hourly_secured
WHERE plant_code IS NOT NULL;


-- 24. Staging buffer flow (hourly in/out of palletising — B(t) reconstruction input)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_buffer_flow AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id,
  CAST(activity_hour AS TIMESTAMP) AS activity_hour,
  items_in, qty_in, items_out, qty_out, net_qty
FROM connected_plant_prod.gold_io_reporting.gold_wm_staging_buffer_flow_hourly_secured
WHERE plant_code IS NOT NULL;

-- 25. QM lot context (held-stock / inbound enrichment)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_qm_lots AS
SELECT plant_code AS plant_id, material_code AS material_id, batch_number AS batch_id,
  lot_count, open_lot_count, latest_lot_number, lot_origin_code,
  CAST(oldest_open_start_date AS DATE) AS oldest_open_start_date,
  last_usage_decision, last_usage_decision_date
FROM connected_plant_prod.gold_io_reporting.gold_wm_qm_lot_context_secured
WHERE plant_code IS NOT NULL;

-- 26. Order operations (operation-level drill for Order Detail overlay)
-- Grain: 1 row per plant_id + order_number + routing_number + operation_counter.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_operations AS
SELECT
  plant_code AS plant_id,
  order_number,
  routing_number,
  operation_counter,
  operation_number,
  operation_description,
  control_key,
  work_centre_code,
  work_centre_description,
  CAST(scheduled_start_datetime AS TIMESTAMP) AS scheduled_start_datetime,
  CAST(scheduled_finish_datetime AS TIMESTAMP) AS scheduled_finish_datetime,
  CAST(actual_start_datetime AS TIMESTAMP) AS actual_start_datetime,
  CAST(actual_finish_date AS DATE) AS actual_finish_date,
  operation_quantity,
  confirmed_yield_quantity,
  confirmed_scrap_quantity,
  is_confirmed
FROM connected_plant_prod.gold_io_reporting.gold_wm_order_operations_secured
WHERE plant_code IS NOT NULL;

-- 27. Downtime pareto (weekly aggregated pareto by reason — Production Health view)
-- Grain: 1 row per plant_id + week_start + downtime_reason_code + sub_reason_code + work_centre_code.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_downtime_pareto AS
SELECT
  plant_code AS plant_id,
  CAST(week_start AS DATE) AS week_start,
  downtime_reason_code,
  sub_reason_code,
  work_centre_code,
  downtime_reason_description,
  sub_reason_description,
  production_line_description,
  event_count,
  total_duration_minutes,
  avg_duration_minutes,
  distinct_order_count
FROM connected_plant_prod.gold_io_reporting.gold_wm_downtime_pareto_secured
WHERE plant_code IS NOT NULL;

-- 28. Downtime event detail (event-grain passthrough — Production Health recent-events table)
-- Grain: 1 row per downtime entry (plant_id + order_number + operation_number + item_number is the
-- closest natural key; multiple downtime entries can share these fields).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_downtime_events AS
SELECT
  plant_code AS plant_id,
  work_centre_code,
  machine_code,
  machine_description,
  production_line_description,
  order_number,
  material_code,
  operation_number,
  item_number,
  downtime_reason_code,
  downtime_reason_description,
  sub_reason_code,
  sub_reason_description,
  CAST(start_datetime AS TIMESTAMP) AS start_datetime,
  CAST(end_datetime AS TIMESTAMP) AS end_datetime,
  duration_minutes,
  reported_by_user,
  comment
FROM connected_plant_prod.gold_io_reporting.gold_wm_downtime_event_detail_secured
WHERE plant_code IS NOT NULL;
