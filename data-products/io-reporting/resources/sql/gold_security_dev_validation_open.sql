-- Unity Catalog Gold row-level security — secured serving views (DEV).
-- Run once as a Unity Catalog admin after the first dev deploy. Re-runnable.
-- Requires: CREATE VIEW on connected_plant_dev.gold_io_reporting.
-- WARNING: Generated automatically by scripts/generate_gold_security_sql.py. Do not edit manually.
--
-- Model: Gold MVs stay trusted (not row-filtered, to avoid full MV refreshes). Each plant-scoped
-- Gold table gets a <table>_secured view that enforces plant access via published_<env>.security.model
-- (application_key = 'io_reporting'). access_type 'full view' = all plants; 'filter' = filter_plant
-- array. Dev secured views are pass-through (no security model available in dev).
-- Consumers ('users' group) are granted SELECT on the *_secured views only.
--
-- SECURITY MODE: validation-open (UAT/DEV ONLY). The *_secured views below are
-- PASS-THROUGHS (no security predicate) so UAT data-shape validation can run when
-- published_<env>.security.model is unavailable. This preserves the secured-view boundary
-- and view names, but does NOT prove RLS / plant filtering / entitlement. MUST NOT be used
-- in prod or to claim cutover readiness. Run gold_security_harden_<env>.sql after it so the
-- base Gold tables remain revoked from `users`.

-- NOTE: enable_hu_reconciliation=false — HU-dependent secured views (gold_handling_unit_summary, gold_hu_reconciliation) are intentionally omitted.

-- ── Secured views + consumer grants ──

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_transfer_order_performance_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_transfer_order_performance;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_transfer_order_performance_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_inbound_outbound_throughput_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_inbound_outbound_throughput;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_inbound_outbound_throughput_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_bin_occupancy_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_bin_occupancy;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_bin_occupancy_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_availability_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_availability;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_availability_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_transfer_requirement_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_transfer_requirement_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_transfer_requirement_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_transfer_requirement_material_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_transfer_requirement_material_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_transfer_requirement_material_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_expiry_risk_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_expiry_risk;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_expiry_risk_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_shift_output_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_shift_output_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_shift_output_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_process_order_schedule_adherence_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_process_order_schedule_adherence;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_process_order_schedule_adherence_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_plant_production_quality_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_plant_production_quality_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_plant_production_quality_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_process_order_operations_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_process_order_operations;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_process_order_operations_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_order_downtime_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_order_downtime_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_order_downtime_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_process_order_component_status_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_process_order_component_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_process_order_component_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_dispensary_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_dispensary_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_dispensary_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_lineside_stock_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_lineside_stock;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_lineside_stock_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_delivery_pick_status_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_delivery_pick_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_delivery_pick_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_inbound_deliveries_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_inbound_deliveries;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_inbound_deliveries_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_process_order_staging_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_process_order_staging;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_process_order_staging_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_process_order_staging_validation_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_process_order_staging_validation;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_process_order_staging_validation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_storage_type_role_coverage_status_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_storage_type_role_coverage_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_storage_type_role_coverage_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_v2_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_v2;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_value_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_value_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_value_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_reconciliation_audit_log_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_reconciliation_audit_log;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_reconciliation_audit_log_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_movement_reconciliation_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_movement_reconciliation;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_movement_reconciliation_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_physical_inventory_recon_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_physical_inventory_recon;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_physical_inventory_recon_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_reconciliation_alerts_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_reconciliation_alerts;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_reconciliation_alerts_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_exceptions_v2_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_exceptions_v2;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_exceptions_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_summary_v2_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_summary_v2;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_summary_v2_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_reconciliation_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_stock_holds_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_stock_holds;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_stock_holds_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_transfer_order_open_items_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_transfer_order_open_items;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_transfer_order_open_items_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_transfer_requirement_open_items_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_transfer_requirement_open_items;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_transfer_requirement_open_items_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_goods_movement_activity_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_goods_movement_activity;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_goods_movement_activity_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_enhanced_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_enhanced;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_inbound_po_backlog_enhanced_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_inbound_po_line_backlog_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_inbound_po_line_backlog;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_inbound_po_line_backlog_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_warehouse_exceptions_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_warehouse_exceptions;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_warehouse_exceptions_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_warehouse_kpi_snapshot_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_warehouse_kpi_snapshot;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_warehouse_kpi_snapshot_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_worklist_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_worklist;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_worklist_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_worklist_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_worklist_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_worklist_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_readiness_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_readiness;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_readiness_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_bin_stock_detail_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_bin_stock_detail;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_bin_stock_detail_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_component_detail_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_component_detail;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_component_detail_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_operator_activity_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_operator_activity;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_operator_activity_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_queue_workload_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_queue_workload;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_queue_workload_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_campaign_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_campaign_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_campaign_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_daily_activity_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_daily_activity;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_daily_activity_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_slow_movers_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_slow_movers;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_slow_movers_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_expiry_risk_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_expiry_risk;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_expiry_risk_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_pace_hourly_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_pace_hourly;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_pace_hourly_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_demand_hourly_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_demand_hourly;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_demand_hourly_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_buffer_flow_hourly_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_staging_buffer_flow_hourly;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_staging_buffer_flow_hourly_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_context_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_context;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_context_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_status_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_status;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_qm_lot_status_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_qm_disposition_queue_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_qm_disposition_queue;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_qm_disposition_queue_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_operations_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_operations;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_operations_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_downtime_pareto_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_downtime_pareto;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_downtime_pareto_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_downtime_event_detail_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_downtime_event_detail;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_downtime_event_detail_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_journey_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_journey_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_journey_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_journey_events_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_journey_events;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_journey_events_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_wip_stage_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_wip_stage;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_wip_stage_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_yield_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_yield;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_yield_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_recipe_run_benchmark_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_recipe_run_benchmark;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_recipe_run_benchmark_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_component_variance_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_component_variance;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_component_variance_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_supply_demand_ledger_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_supply_demand_ledger;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_supply_demand_ledger_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_shortage_projection_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_order_shortage_projection;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_order_shortage_projection_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_adherence_root_cause_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_adherence_root_cause;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_adherence_root_cause_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_lineside_now_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_lineside_now;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_lineside_now_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_wm_lineside_lines_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_wm_lineside_lines;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_wm_lineside_lines_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_spc_quality_metric_subgroup_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_spc_quality_metric_subgroup;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_spc_quality_metric_subgroup_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_trace_anchor_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_trace_anchor;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_trace_anchor_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_batch_stock_summary_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_batch_stock_summary;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_batch_stock_summary_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_qm_lab_result_signal_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_qm_lab_result_signal;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_qm_lab_result_signal_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_qm_characteristic_pareto_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_qm_characteristic_pareto;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_qm_characteristic_pareto_secured TO `users`;

CREATE OR REPLACE VIEW connected_plant_dev.gold_io_reporting.gold_qm_ud_code_pareto_secured AS
  SELECT * FROM connected_plant_dev.gold_io_reporting.gold_qm_ud_code_pareto;
GRANT SELECT ON VIEW connected_plant_dev.gold_io_reporting.gold_qm_ud_code_pareto_secured TO `users`;

-- ── Base-table access hardening ──
-- The actual REVOKE statements are generated as a SEPARATE admin script
-- (resources/sql/gold_security_harden_dev.sql). Apply it AFTER this script so plant-scoped users
-- can only read the *_secured views, not the un-trimmed base Gold tables (ADR 012).
-- It is kept separate because revoking broad access is operationally sensitive and irreversible-ish.
