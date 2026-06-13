-- WM Operations Consumption Views (DEV)
-- Target: connected_plant_dev.gold_io_reporting
-- Serves the WM Operations app workspace (apps/api routes /api/wm-operations/*) via the
-- governed contract pattern: app -> vw_consumption_wm_operations_* -> *_live/_secured -> gold MV.
-- Run once as a UC admin AFTER gold_security_dev.sql and gold_serving_views_dev.sql.

USE CATALOG connected_plant_dev;
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
  CAST(demand_due_ts AS TIMESTAMP) AS demand_due_ts,
  CASE
    WHEN demand_due_ts IS NULL THEN 10
    WHEN demand_due_ts < current_timestamp() THEN 100
    WHEN demand_due_ts <= current_timestamp() + INTERVAL 2 HOURS THEN 80
    WHEN demand_due_ts <= current_timestamp() + INTERVAL 8 HOURS THEN 60
    WHEN demand_due_ts <= current_timestamp() + INTERVAL 24 HOURS THEN 40
    ELSE 20
  END + COALESCE(priority_intervention_bump, 0) AS priority_score,
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
  is_overdue,
  short_pick_qty,
  short_pick_item_count,
  order_production_line
FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_worklist_live
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_worklist_summary_secured
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
  qty_unrestricted,
  quality_hold_qty,
  open_lot_count,
  quality_release_status,
  days_to_start,
  readiness_band,
  readiness_reason,
  production_line
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_readiness_live
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_bin_stock_detail_live
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_component_detail_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_operator_activity_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_queue_workload_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_delivery_pick_status_live
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
FROM connected_plant_dev.gold_io_reporting.gold_reconciliation_alerts_secured
WHERE plant_code IS NOT NULL;


-- 10. Handling-unit summary (inbound/putaway board)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_handling_units AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, handling_unit_status,
  reference_document_category, hu_item_count, distinct_sscc_count, distinct_hu_count,
  linked_delivery_count, distinct_material_count, total_gross_weight
FROM connected_plant_dev.gold_io_reporting.gold_handling_unit_summary_secured
WHERE plant_code IS NOT NULL;

-- 11. Stock expiry risk (stock health)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_expiry_risk AS
SELECT plant_code AS plant_id, material_code AS material_id, material_description AS material_name,
  batch_number AS batch_id, base_uom AS uom,
  unrestricted_qty, quality_inspection_qty, blocked_qty, restricted_use_qty,
  in_transfer_qty, blocked_returns_qty, total_stock_qty,
  CAST(expiry_date AS DATE) AS expiry_date,
  CASE WHEN expiry_date IS NULL THEN NULL ELSE datediff(expiry_date, current_date()) END AS days_to_expiry,
  CASE
    WHEN expiry_date IS NULL THEN 'NO_DATE'
    WHEN datediff(expiry_date, current_date()) < 0 THEN 'EXPIRED'
    WHEN datediff(expiry_date, current_date()) < 30 THEN 'LT_30_DAYS'
    WHEN datediff(expiry_date, current_date()) < 90 THEN 'DAYS_30_90'
    WHEN datediff(expiry_date, current_date()) < 180 THEN 'DAYS_90_180'
    ELSE 'GT_180_DAYS'
  END AS expiry_band,
  CAST(manufacture_date AS DATE) AS manufacture_date, vendor_batch_number,
  shelf_life_days, minimum_remaining_shelf_life_days,
  standard_price, price_unit, est_stock_value,
  fefo_risk_flag, earlier_expiring_batch, CAST(latest_issue_date AS DATE) AS latest_issue_date
FROM connected_plant_dev.gold_io_reporting.gold_wm_expiry_risk_secured
WHERE plant_code IS NOT NULL;

-- 12. Stock holds (stock health)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_stock_holds AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, storage_type,
  storage_bin AS bin_id, quant_number AS quant_id, material_code AS material_id,
  batch_number AS batch_id, hold_type, quantity AS qty, base_uom AS uom,
  CAST(goods_receipt_date AS DATE) AS goods_receipt_date, age_hours
FROM connected_plant_dev.gold_io_reporting.gold_stock_holds_live
WHERE plant_code IS NOT NULL;

-- 13. Aged warehouse exceptions (MUST read _live — _secured rows are candidates, not confirmed)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_exceptions AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, exception_type, severity,
  sla_hours, material_code AS material_id, batch_number AS batch_id, reference_id,
  quantity AS qty, CAST(aging_reference_date AS DATE) AS aging_reference_date, age_days, detail
FROM connected_plant_dev.gold_io_reporting.gold_warehouse_exceptions_live
WHERE plant_code IS NOT NULL;

-- 14. Reconciliation exceptions (workbench detail)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recon_exceptions AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, material_code AS material_id,
  material_description AS material_name, batch_number AS batch_id, stock_category,
  base_uom AS uom, im_quantity AS im_qty, wm_quantity AS wm_qty, delta_quantity AS delta_qty,
  delta_percent, delta_value, mismatch_reason, mismatch_severity,
  is_operationally_trusted AS is_trusted
FROM connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_exceptions_v2_secured
WHERE plant_code IS NOT NULL;

-- 15. Reconciliation value rollup (workbench summary)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recon_value_summary AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, mismatch_reason,
  mismatch_severity, row_count, tolerance_exceeded_count, net_delta_value,
  abs_delta_value, abs_delta_quantity, value_reconciliation_status
FROM connected_plant_dev.gold_io_reporting.gold_stock_value_reconciliation_secured
WHERE plant_code IS NOT NULL;

-- 16. Campaign summary (campaign board)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_campaigns AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id,
  campaign_reference AS campaign_id, tr_count, complete_trs, in_progress_trs, parked_trs,
  no_stock_trs, order_count, operator_count, work_area, required_qty, open_qty,
  CAST(earliest_planned_datetime AS TIMESTAMP) AS earliest_planned_ts,
  CAST(earliest_created_datetime AS TIMESTAMP) AS earliest_created_ts
FROM connected_plant_dev.gold_io_reporting.gold_wm_campaign_summary_secured
WHERE plant_code IS NOT NULL;

-- 17. Daily activity (trend facts)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_daily_activity AS
SELECT plant_code AS plant_id, CAST(activity_date AS DATE) AS activity_date,
  to_items_confirmed, active_operators, trs_created, goods_receipt_lines, goods_issue_lines
FROM connected_plant_dev.gold_io_reporting.gold_wm_daily_activity_secured
WHERE plant_code IS NOT NULL;

-- 18. Physical inventory reconciliation (handover section)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_physical_inventory AS
SELECT plant_code AS plant_id, physical_inventory_document_number AS pi_document_id,
  fiscal_year, item_number, storage_location_code AS storage_location_id,
  material_code AS material_id, batch_number AS batch_id,
  CAST(planned_count_date AS DATE) AS planned_count_date, CAST(count_date AS DATE) AS count_date,
  book_quantity AS book_qty, counted_quantity AS counted_qty, delta_quantity AS delta_qty,
  delta_value, is_counted, is_recount_required, is_difference_posted, physical_inventory_status
FROM connected_plant_dev.gold_io_reporting.gold_physical_inventory_recon_secured
WHERE plant_code IS NOT NULL;


-- 19. Bin occupancy & capacity (putaway planning)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_bin_occupancy AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, storage_type, bin_type,
  bin_record_count, occupied_bin_count, empty_bin_count, blocked_bin_count,
  stock_removal_blocked_bin_count, putaway_blocked_bin_count, occupancy_rate,
  total_stock_qty, available_stock_qty, open_transfer_stock_qty,
  total_max_quant_count, total_maximum_weight, quant_utilisation_fraction
FROM connected_plant_dev.gold_io_reporting.gold_bin_occupancy_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_slow_movers_live
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
FROM connected_plant_dev.gold_io_reporting.gold_movement_reconciliation_secured
WHERE plant_code IS NOT NULL;

-- 22. Staging pace (hourly staged-in throughput — derived from TO flows; bulk-drop log not replicated)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_staging_pace AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, destination_zone,
  CAST(activity_hour AS TIMESTAMP) AS activity_hour, items_staged, qty_staged, operators
FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_pace_hourly_secured
WHERE plant_code IS NOT NULL;

-- 23. Staging demand wave (open TR qty by planned execution hour)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_staging_demand AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id, work_area,
  production_supply_area,
  CAST(demand_hour AS TIMESTAMP) AS demand_hour, open_trs, open_qty
FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_demand_hourly_secured
WHERE plant_code IS NOT NULL;


-- 24. Staging buffer flow (hourly in/out of palletising — B(t) reconstruction input)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_buffer_flow AS
SELECT plant_code AS plant_id, warehouse_number AS warehouse_id,
  CAST(activity_hour AS TIMESTAMP) AS activity_hour,
  items_in, qty_in, items_out, qty_out, net_qty
FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_buffer_flow_hourly_secured
WHERE plant_code IS NOT NULL;

-- 25. QM lot context (held-stock / inbound enrichment)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_qm_lots AS
SELECT plant_code AS plant_id, material_code AS material_id, batch_number AS batch_id,
  lot_count, open_lot_count, latest_lot_number, lot_origin_code,
  CAST(oldest_open_start_date AS DATE) AS oldest_open_start_date,
  last_usage_decision, last_usage_decision_date
FROM connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_context_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_operations_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_downtime_pareto_secured
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
FROM connected_plant_dev.gold_io_reporting.gold_wm_downtime_event_detail_secured
WHERE plant_code IS NOT NULL;

-- 29. QM lot status (all lots, plant × inspection_lot grain, date-relative from _live view)
-- Grain: 1 row per plant_id + lot_id. RLS inherited via gold_wm_qm_lot_status_secured.
-- Source-guarded: view exists only when silver QM tables are present (quality gate).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_qm_lot_status AS
SELECT
  plant_code AS plant_id,
  inspection_lot_number AS lot_id,
  inspection_lot_origin_code,
  inspection_type,
  material_code AS material_id,
  material_name,
  batch_number AS batch_id,
  order_number AS order_id,
  CAST(lot_created_date AS DATE) AS lot_created_date,
  CAST(inspection_start_date AS DATE) AS inspection_start_date,
  CAST(inspection_end_date AS DATE) AS inspection_end_date,
  inspection_lot_quantity AS lot_qty,
  inspection_lot_uom AS lot_uom,
  has_usage_decision,
  last_usage_decision,
  CAST(last_usage_decision_date AS DATE) AS last_usage_decision_date,
  last_usage_decision_by,
  quality_score,
  lot_age_days,
  ud_lead_time_days,
  is_overdue
FROM connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_status_live
WHERE plant_code IS NOT NULL;

-- 30. QM disposition queue (open lots only, with blocked-stock value estimate)
-- Grain: 1 row per plant_id + lot_id (open = no usage decision). RLS inherited via _secured.
-- Source-guarded: view exists only when silver QM tables are present (quality gate).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_qm_disposition_queue AS
SELECT
  plant_code AS plant_id,
  inspection_lot_number AS lot_id,
  inspection_lot_origin_code,
  inspection_type,
  material_code AS material_id,
  material_name,
  batch_number AS batch_id,
  order_number AS order_id,
  CAST(lot_created_date AS DATE) AS lot_created_date,
  CAST(inspection_start_date AS DATE) AS inspection_start_date,
  CAST(inspection_end_date AS DATE) AS inspection_end_date,
  inspection_lot_quantity AS lot_qty,
  inspection_lot_uom AS lot_uom,
  blocked_qty,
  blocked_uom,
  est_blocked_value,
  lot_age_days,
  is_overdue
FROM connected_plant_dev.gold_io_reporting.gold_wm_qm_disposition_queue_live
WHERE plant_code IS NOT NULL;

-- 31. QM characteristic Pareto (MIC fail counts — Command Centre drill)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_qm_characteristic_pareto AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  characteristic_id,
  characteristic_text,
  unit,
  result_count,
  fail_count,
  warn_count,
  fail_rate,
  CAST(last_result_date AS DATE) AS last_result_date
FROM connected_plant_dev.gold_io_reporting.gold_qm_characteristic_pareto_secured
WHERE plant_code IS NOT NULL;

-- 32. QM usage-decision code Pareto (Command Centre drill)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_qm_ud_code_pareto AS
SELECT
  plant_code AS plant_id,
  usage_decision_code,
  usage_decision,
  usage_decision_valuation,
  lot_count,
  CAST(last_decision_date AS DATE) AS last_decision_date
FROM connected_plant_dev.gold_io_reporting.gold_qm_ud_code_pareto_secured
WHERE plant_code IS NOT NULL;

-- 33. Onboarded plants (command-palette plant picker)

-- 29. Inbound deliveries (EL/ELST SAP delivery types — expected-receipt board)
-- Grain: 1 row per plant_id + delivery_number.
-- Source: gold_wm_inbound_deliveries_live (gold MV filtered to EL/ELST delivery_type, with
-- days_until_expected_receipt and receipt_band served live so the base MV stays deterministic).
-- Inbound != outbound: expected_receipt_date is LIKP.WADAT (SAP planned GI/GR date),
-- renamed for honest semantics. No customer columns (supplier/vendor not replicated on LIKP).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_inbound_deliveries AS
SELECT
  plant_code AS plant_id,
  warehouse_number AS warehouse_id,
  delivery_number AS delivery_id,
  delivery_type,
  shipping_point,
  line_count,
  delivery_qty,
  received_qty,
  receipt_fraction,
  has_mixed_base_uom,
  wm_status_code,
  CAST(expected_receipt_date AS DATE) AS expected_receipt_date,
  CAST(actual_receipt_date AS DATE) AS actual_receipt_date,
  is_received,
  days_until_expected_receipt,
  receipt_band
FROM connected_plant_dev.gold_io_reporting.gold_wm_inbound_deliveries_live
WHERE plant_code IS NOT NULL;

-- 30. Onboarded plants (command-palette plant picker)
-- Grain: 1 row per plant_id + warehouse_id. Derived from the worklist summary secured view
-- (already RLS-governed); no new gold object. Used by the frontend command palette to
-- enumerate onboarded plants dynamically without hardcoding.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_plants AS
SELECT
  plant_id,
  warehouse_id,
  SUM(tr_count) AS worklist_tr_count
FROM connected_plant_dev.gold_io_reporting.vw_consumption_wm_operations_worklist_summary
GROUP BY plant_id, warehouse_id;


-- 31. Order Journey summary (per-order milestone summary -- Order Journey Timeline view)
-- Grain: 1 row per plant_id + order_id.
-- Source: gold_wm_order_journey_summary_secured (no date-relative columns -- no _live wrapper needed).
-- All milestone timestamps nullable; lags computed only when both endpoints exist.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_journey AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code,
  material_name,
  order_qty,
  uom,
  production_line,
  CAST(order_created_ts AS TIMESTAMP) AS order_created_ts,
  CAST(release_date AS DATE) AS release_date,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  CAST(first_tr_created_ts AS TIMESTAMP) AS first_tr_created_ts,
  staging_tr_count,
  CAST(staging_first_confirmed_ts AS TIMESTAMP) AS staging_first_confirmed_ts,
  CAST(staging_last_confirmed_ts AS TIMESTAMP) AS staging_last_confirmed_ts,
  staged_item_count,
  staged_item_total,
  CAST(production_first_actual_start AS TIMESTAMP) AS production_first_actual_start,
  CAST(production_last_actual_finish AS TIMESTAMP) AS production_last_actual_finish,
  confirmed_yield_qty,
  confirmed_scrap_qty,
  CAST(pi_first_start AS TIMESTAMP) AS pi_first_start,
  CAST(pi_last_end AS TIMESTAMP) AS pi_last_end,
  CAST(first_gr_posting_date AS DATE) AS first_gr_posting_date,
  CAST(last_gr_posting_date AS DATE) AS last_gr_posting_date,
  gr_qty,
  issue_qty,
  delivery_count,
  qm_lot_count,
  qm_open_lot_count,
  release_to_first_tr_hours,
  tr_to_staged_hours,
  staged_to_production_hours,
  production_to_gr_hours
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_journey_summary_secured
WHERE plant_code IS NOT NULL;

-- 32. Order Journey events (long-format per-order event timeline -- Order Journey Timeline view)
-- Grain: 1 row per plant_id + order_id + event_seq.
-- Source: gold_wm_order_journey_events_secured (no date-relative columns -- no _live wrapper needed).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_journey_events AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  event_seq,
  CAST(event_ts AS TIMESTAMP) AS event_ts,
  event_type,
  qty,
  uom,
  reference_id,
  detail
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_journey_events_secured
WHERE plant_code IS NOT NULL;

-- 33. WIP Funnel stages (active process orders by WIP stage — Production Progress view)
-- Grain: 1 row per plant_id + order_id (active window: released, not finished).
-- Source: gold_wm_order_wip_stage_secured (deterministic; no date-relative columns).
-- stage values: RELEASED / STAGING / STAGED / IN_PRODUCTION / GR_PARTIAL / GR_COMPLETE.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_wip_stages AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code,
  material_name,
  order_qty,
  uom,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  stage,
  CAST(first_tr_created_ts AS TIMESTAMP) AS first_tr_created_ts,
  CAST(staging_last_confirmed_ts AS TIMESTAMP) AS staging_last_confirmed_ts,
  CAST(production_first_actual_start AS TIMESTAMP) AS production_first_actual_start,
  CAST(first_gr_posting_date AS DATE) AS first_gr_posting_date,
  gr_qty
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_wip_stage_secured
WHERE plant_code IS NOT NULL;

-- 34. Schedule adherence daily (cumulative planned vs actual for S-curve — Production Progress view)
-- Grain: 1 row per plant_id + scheduled_finish_date (day).
-- Source: gold_process_order_schedule_adherence_secured aggregated to day grain.
-- planned_count: orders scheduled to finish on this date.
-- completed_count: orders that actually finished on this date (actual_finish_date present).
-- on_time_count: completed orders where actual_finish_date <= scheduled_finish_date.
-- No date-relative columns; anchored to max(actual_finish_date) in the data (no wall-clock).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_schedule_adherence_daily AS
SELECT
  plant_code AS plant_id,
  CAST(scheduled_finish_date AS DATE) AS scheduled_date,
  COUNT(*) AS planned_count,
  SUM(CASE WHEN actual_finish_date IS NOT NULL THEN 1 ELSE 0 END) AS completed_count,
  SUM(COALESCE(is_on_time, 0)) AS on_time_count,
  CAST(MAX(actual_finish_date) AS DATE) AS max_actual_date
FROM connected_plant_dev.gold_io_reporting.gold_process_order_schedule_adherence_secured
WHERE plant_code IS NOT NULL
  AND scheduled_finish_date IS NOT NULL
GROUP BY plant_code, scheduled_finish_date;

-- 35. Order yield summary (Yield & Loss analytics view — order grain)
-- Grain: 1 row per plant_id + order_id.
-- Source: gold_wm_order_yield_secured (no date-relative columns; _secured direct).
-- planned_qty = order_quantity; delivered_qty = net GR (101 minus 102).
-- yield_pct = delivered/planned (null when no planned qty). is_complete = actual_finish_date set.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_order_yield AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code AS material_id,
  material_name,
  production_line,
  planned_qty,
  delivered_qty,
  uom,
  yield_pct,
  has_goods_receipt,
  is_complete,
  is_released,
  is_completed,
  is_closed,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  CAST(actual_finish_date AS DATE) AS actual_finish_date,
  CAST(first_gr_date AS DATE) AS first_gr_date,
  CAST(last_gr_date AS DATE) AS last_gr_date
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_yield_secured
WHERE plant_code IS NOT NULL;

-- 36. Recipe run benchmark (Campaigns recipe-line comparison — recipe-line grain)
-- Grain: 1 row per plant_id + material_id + production_line.
-- Source: gold_wm_recipe_run_benchmark_secured (no date-relative columns).
-- Percentiles are over complete orders with goods receipt; null production_line is UNASSIGNED.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_recipe_benchmark AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  production_line,
  run_count,
  median_yield_pct,
  p10_yield_pct,
  p90_yield_pct,
  median_duration_hours,
  p10_duration_hours,
  p90_duration_hours,
  CAST(last_run_finish_date AS DATE) AS last_run_finish_date
FROM connected_plant_dev.gold_io_reporting.gold_wm_recipe_run_benchmark_secured
WHERE plant_code IS NOT NULL;

-- 37. Order component variance (Yield & Loss analytics view — order+material grain)
-- Grain: 1 row per plant_id + order_id + material_id.
-- Source: gold_wm_order_component_variance_secured (no date-relative columns).
-- variance_qty > 0 = over-issue (loss); < 0 = under-issue.
-- est_loss_value: over-issued qty × standard_price/price_unit (null when no price data).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_component_variance AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code AS material_id,
  material_name,
  uom,
  movement_type_code,
  required_qty,
  withdrawn_qty,
  issued_qty,
  variance_qty,
  variance_pct,
  est_loss_value,
  standard_price,
  is_final_issue
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_component_variance_secured
WHERE plant_code IS NOT NULL;

-- 37. Supply/demand ledger (Shortage Projection — dated events with running balance)
-- Grain: 1 row per plant_id + material_id + ledger event.
-- Source: gold_wm_supply_demand_ledger_secured (deterministic; no wall-clock).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_supply_demand_ledger AS
SELECT
  plant_code AS plant_id,
  material_code AS material_id,
  material_name,
  event_type,
  event_subtype,
  CAST(event_date AS DATE) AS event_date,
  quantity,
  signed_qty,
  balance_before,
  running_balance,
  source_document_id,
  order_number AS order_id,
  sort_seq,
  base_uom AS uom
FROM connected_plant_dev.gold_io_reporting.gold_wm_supply_demand_ledger_secured
WHERE plant_code IS NOT NULL;

-- 38. Order shortage projection (Shortage Projection — at-risk components)
-- Grain: 1 row per plant_id + order_id + material_id + reservation_ref.
-- Source: gold_wm_order_shortage_projection_secured.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_shortage_projection AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code AS material_id,
  material_name,
  open_qty,
  uom,
  CAST(requirement_date AS DATE) AS requirement_date,
  reservation_ref,
  projected_balance_at_demand,
  is_projected_short,
  CAST(first_short_date AS DATE) AS first_short_date,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  production_line
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_shortage_projection_secured
WHERE plant_code IS NOT NULL;

-- 39. Adherence root cause (Production Progress — late-order classification)
-- Grain: 1 row per plant_id + order_id (miss candidates only).
-- Source: gold_wm_adherence_root_cause_secured.
-- is_open_late uses CURRENT_DATE (query-time) for unfinished orders past schedule;
-- gold carries dates only (deterministic MV).
CREATE OR REPLACE VIEW vw_consumption_wm_operations_adherence_root_cause AS
SELECT
  plant_code AS plant_id,
  order_number AS order_id,
  material_code AS material_id,
  material_name,
  order_qty,
  uom,
  production_line,
  CAST(scheduled_start_date AS DATE) AS scheduled_start_date,
  CAST(scheduled_finish_date AS DATE) AS scheduled_finish_date,
  CAST(actual_release_date AS DATE) AS actual_release_date,
  CAST(actual_finish_date AS DATE) AS actual_finish_date,
  root_cause_class,
  is_late_release,
  has_material_short,
  shortfall_component_count,
  min_variance_qty,
  release_to_production_hours,
  production_first_actual_start,
  (actual_finish_date IS NOT NULL AND actual_finish_date > scheduled_finish_date) AS is_finish_late,
  (actual_finish_date IS NULL AND scheduled_finish_date < CURRENT_DATE()) AS is_open_late
FROM connected_plant_dev.gold_io_reporting.gold_wm_adherence_root_cause_secured
WHERE plant_code IS NOT NULL;

-- 40. Daily activity baseline (DOW percentile bands — trend chart reference bands)
-- Grain: 1 row per plant_id + metric_name + day_of_week.
-- Partial-day exclusion: handled at gold source layer (gold_wm_daily_activity_baseline sources from
-- gold_wm_daily_activity where SAP extracts are closed daily; no activity_date column in this view).
-- Source: gold_wm_daily_activity_baseline_secured.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_daily_activity_baseline AS
SELECT
  plant_code AS plant_id,
  metric_name,
  day_of_week,
  CAST(median_value AS DOUBLE) AS median_value,
  CAST(p10_value AS DOUBLE) AS p10_value,
  CAST(p90_value AS DOUBLE) AS p90_value,
  CAST(sample_days AS BIGINT) AS sample_days
FROM connected_plant_dev.gold_io_reporting.gold_wm_daily_activity_baseline_secured
WHERE plant_code IS NOT NULL;

-- 41. Lineside Now (Lineside Monitor — running orders + current phase, PEX-E-35)
-- Grain: 1 row per plant_id + line_id + order_id.
-- Source: gold_wm_lineside_now_live (adds elapsed_minutes + projected_finish at query time).
-- Wall-clock rule (ADR 012): elapsed_minutes and projected_finish computed in _live layer.
-- pct_complete: yield_pct × 100 clamped [0, 100]; null when no GR evidence.
-- planned_minutes: scheduled_finish − scheduled_start in minutes; null when undated.
-- FRESHNESS CAVEAT: data age reflects the last gold pipeline run (daily/paused cadence).
-- The STALE banner in the UI is driven by the freshness endpoint, not this view.
-- Filter by plant_id AND line_id for wall-display isolation.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_lineside_now AS
SELECT
  plant_code AS plant_id,
  production_line AS line_id,
  order_number AS order_id,
  material_code AS material_id,
  material_name,
  planned_qty,
  uom,
  pct_complete,
  planned_minutes,
  CAST(production_first_actual_start AS TIMESTAMP) AS production_first_actual_start,
  current_operation_number,
  current_operation_description,
  current_activity_type,
  elapsed_minutes,
  CAST(projected_finish AS TIMESTAMP) AS projected_finish
FROM connected_plant_dev.gold_io_reporting.gold_wm_lineside_now_live
WHERE plant_code IS NOT NULL;

-- 42. Lineside Lines (Lineside Monitor — line picker for config panel, PEX-E-35)
-- Grain: 1 row per plant_id + line_id.
-- Source: gold_wm_lineside_lines_secured (deterministic; no date-relative columns).
-- active_order_count: released, not closed, not finished orders on that line right now.
-- line_label: production_line_description where available; falls back to production_line code.
CREATE OR REPLACE VIEW vw_consumption_wm_operations_lineside_lines AS
SELECT
  plant_code AS plant_id,
  production_line AS line_id,
  line_label,
  CAST(active_order_count AS BIGINT) AS active_order_count
FROM connected_plant_dev.gold_io_reporting.gold_wm_lineside_lines_secured
WHERE plant_code IS NOT NULL;

-- 42. Plan Board (Production Planning Board — order-grain Gantt data, PEX-E-36)
-- Grain: 1 row per plant_id + order_id.
-- Date windowing is a query parameter (from/to dates passed at query time); NOT baked
-- into this view — keeps source MVs deterministic and incrementally refreshable.
-- Wall-clock rule (ADR 012): projected_finish, is_overdue, status computed at query time.
-- Status derivation precedence: completed > material-short > atrisk > running > firm > open.
-- OMITTED: changeover/cleaning/maintenance — no governed SAP operation-type source.
-- Sources (all _secured except gold_wm_lineside_now which is _live for wall-clock columns):
--   gold_wm_order_journey_summary_secured (INNER — canonical plant axis)
--   gold_wm_order_yield_secured (INNER — qty, dates, flags)
--   gold_wm_lineside_now_live (LEFT — pct_complete / elapsed_minutes for running orders)
--   gold_wm_adherence_root_cause_secured (LEFT — is_finish_late signal)
--   gold_wm_order_shortage_projection_secured subquery (LEFT — has_shortage rollup)
--   gold_wm_order_readiness_secured (LEFT — tr_coverage_status / supply_status)
CREATE OR REPLACE VIEW vw_consumption_wm_operations_plan_board AS
SELECT
  j.plant_code                                           AS plant_id,
  j.order_number                                         AS order_id,
  j.production_line                                      AS line_id,
  y.material_code                                        AS material_id,
  y.material_name,
  y.order_quantity                                       AS planned_qty,
  y.order_quantity_uom                                   AS uom,
  CAST(y.scheduled_start_date AS DATE)                   AS scheduled_start_date,
  CAST(y.scheduled_finish_date AS DATE)                  AS scheduled_finish_date,
  CAST(j.production_first_actual_start AS TIMESTAMP)     AS actual_start,
  CAST(y.actual_finish_date AS DATE)                     AS actual_finish,
  y.delivered_qty,
  COALESCE(ln.pct_complete, y.yield_pct * 100.0)         AS pct_complete,
  ln.planned_minutes,
  ln.elapsed_minutes,
  -- projected_finish: elapsed/pct extrapolation for running orders (query-time wall-clock)
  CASE
    WHEN y.actual_finish_date IS NOT NULL THEN NULL
    WHEN ln.pct_complete IS NOT NULL AND ln.pct_complete > 0
         AND ln.planned_minutes IS NOT NULL AND ln.planned_minutes > 0
    THEN CAST(
           j.production_first_actual_start
           + MAKE_INTERVAL(0, 0, 0, 0, 0,
               CAST(ROUND(ln.planned_minutes / (ln.pct_complete / 100.0)) AS INT), 0)
         AS TIMESTAMP)
    ELSE NULL
  END                                                    AS projected_finish,
  -- status (query-time precedence)
  CASE
    WHEN y.actual_finish_date IS NOT NULL
      THEN 'completed'
    WHEN j.production_first_actual_start IS NOT NULL
         AND y.actual_finish_date IS NULL
         AND COALESCE(sh.has_shortage, FALSE)
      THEN 'material-short'
    WHEN j.production_first_actual_start IS NOT NULL
         AND y.actual_finish_date IS NULL
         AND (
           COALESCE(arc.is_finish_late, FALSE)
           OR (y.scheduled_finish_date IS NOT NULL
               AND CAST(y.scheduled_finish_date AS DATE) < CURRENT_DATE())
           OR (
             ln.pct_complete IS NOT NULL AND ln.pct_complete > 0
             AND ln.planned_minutes IS NOT NULL AND ln.planned_minutes > 0
             AND CAST(
                   j.production_first_actual_start
                   + MAKE_INTERVAL(0, 0, 0, 0, 0,
                       CAST(ROUND(ln.planned_minutes / (ln.pct_complete / 100.0)) AS INT), 0)
                   AS TIMESTAMP)
                 > CAST(y.scheduled_finish_date AS TIMESTAMP)
           )
         )
      THEN 'atrisk'
    WHEN j.production_first_actual_start IS NOT NULL AND y.actual_finish_date IS NULL
      THEN 'running'
    WHEN y.is_released
      THEN 'firm'
    ELSE 'open'
  END                                                    AS status,
  r.tr_coverage_status                                   AS staging_status,
  r.supply_status,
  (
    y.scheduled_start_date IS NULL
    OR (
      y.scheduled_finish_date IS NOT NULL
      AND CAST(y.scheduled_finish_date AS DATE) < CURRENT_DATE()
      AND j.production_first_actual_start IS NULL
    )
  )                                                      AS is_backlog,
  (
    y.scheduled_finish_date IS NOT NULL
    AND CAST(y.scheduled_finish_date AS DATE) < CURRENT_DATE()
    AND y.actual_finish_date IS NULL
  )                                                      AS is_overdue,
  COALESCE(sh.has_shortage, FALSE)                       AS has_shortage,
  y.is_released,
  y.is_completed,
  y.is_closed
FROM connected_plant_dev.gold_io_reporting.gold_wm_order_journey_summary_secured j
INNER JOIN connected_plant_dev.gold_io_reporting.gold_wm_order_yield_secured y
  ON j.order_number = y.order_number
  AND j.plant_code  = y.plant_code
LEFT JOIN connected_plant_dev.gold_io_reporting.gold_wm_lineside_now_live ln
  ON j.order_number = ln.order_number
  AND j.plant_code  = ln.plant_code
LEFT JOIN connected_plant_dev.gold_io_reporting.gold_wm_adherence_root_cause_secured arc
  ON j.order_number = arc.order_number
  AND j.plant_code  = arc.plant_code
LEFT JOIN (
  SELECT plant_code, order_number, BOOL_OR(is_projected_short) AS has_shortage
  FROM connected_plant_dev.gold_io_reporting.gold_wm_order_shortage_projection_secured
  GROUP BY plant_code, order_number
) sh ON j.order_number = sh.order_number AND j.plant_code = sh.plant_code
LEFT JOIN connected_plant_dev.gold_io_reporting.gold_wm_order_readiness_secured r
  ON j.order_number = r.order_number
  AND j.plant_code  = r.plant_code
WHERE j.plant_code IS NOT NULL
  AND j.production_line IS NOT NULL;
