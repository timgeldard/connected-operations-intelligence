-- Unity Catalog Grant Audit Script
-- Run to audit database access control grants for the IOReporting serving boundary.
-- This verifies:
-- 1. No broad consumer groups (e.g. `users`) have direct SELECT privileges on raw Gold tables.
-- 2. Consuming groups have SELECT privileges only on conformed views (*_secured, *_live).
-- 3. Access is granted to readiness tables as expected.
--
-- The audit is environment-specific and filters on target catalogs (dev/uat/prod) 
-- and uses an explicit allow-list of permitted conformed serving views and readiness tables
-- to avoid substring matching issues or future raw table leaks.

-- Query 1: Audit direct SELECT on raw Gold tables (should return 0 rows for `users` / broad groups)
SELECT 
  table_catalog, 
  table_schema, 
  table_name, 
  grantee, 
  privilege_type,
  is_grantable
FROM system.information_schema.table_privileges
WHERE table_catalog IN ('connected_plant_dev', 'connected_plant_uat', 'connected_plant_prod')
  AND table_schema = 'gold'
  AND grantee = 'users'
  AND table_name NOT IN (
    -- Conformed serving views (_secured)
    'gold_transfer_order_performance_secured',
    'gold_inbound_outbound_throughput_secured',
    'gold_bin_occupancy_secured',
    'gold_stock_availability_secured',
    'gold_transfer_requirement_backlog_secured',
    'gold_stock_expiry_risk_secured',
    'gold_shift_output_summary_secured',
    'gold_process_order_schedule_adherence_secured',
    'gold_plant_production_quality_summary_secured',
    'gold_process_order_operations_secured',
    'gold_order_downtime_summary_secured',
    'gold_process_order_component_status_secured',
    'gold_dispensary_backlog_secured',
    'gold_lineside_stock_secured',
    'gold_delivery_pick_status_secured',
    'gold_stock_reconciliation_secured',
    'gold_process_order_staging_secured',
    'gold_stock_reconciliation_v2_secured',
    'gold_stock_value_reconciliation_secured',
    'gold_reconciliation_audit_log_secured',
    'gold_movement_reconciliation_secured',
    'gold_hu_reconciliation_secured',
    'gold_physical_inventory_recon_secured',
    'gold_reconciliation_alerts_secured',
    'gold_stock_reconciliation_exceptions_v2_secured',
    'gold_stock_reconciliation_summary_v2_secured',
    'gold_stock_reconciliation_summary_secured',
    'gold_inbound_po_backlog_secured',
    'gold_inbound_po_backlog_enhanced_secured',
    'gold_handling_unit_summary_secured',
    'gold_warehouse_exceptions_secured',
    'gold_warehouse_kpi_snapshot_secured',
    
    -- Conformed serving views (_live)
    'gold_lineside_stock_live',
    'gold_delivery_pick_status_live',
    'gold_process_order_staging_live',
    'gold_stock_expiry_risk_live',
    'gold_inbound_po_backlog_enhanced_live',
    
    -- Readiness validation tables/views
    'gold_storage_type_role_coverage_status',
    'gold_movement_type_classification_coverage',
    'gold_process_order_staging_validation',
    'gold_recipe_line_enrichment_coverage',
    'gold_delivery_pick_status_validation',
    'gold_stock_reconciliation_readiness',
    'gold_plant_freshness_readiness',
    'gold_validation_failure_detail',
    'gold_plant_readiness_status',
    'gold_data_product_safety_status',
    'gold_readiness_dashboard_source'
  )
ORDER BY table_catalog, table_name, grantee;

-- Query 2: Audit conformed view SELECT access (should show `users` group has SELECT on conformed views)
SELECT 
  table_catalog, 
  table_schema, 
  table_name, 
  grantee, 
  privilege_type
FROM system.information_schema.table_privileges
WHERE table_catalog IN ('connected_plant_dev', 'connected_plant_uat', 'connected_plant_prod')
  AND table_schema = 'gold'
  AND grantee = 'users'
  AND table_name IN (
    -- Conformed serving views (_secured)
    'gold_transfer_order_performance_secured',
    'gold_inbound_outbound_throughput_secured',
    'gold_bin_occupancy_secured',
    'gold_stock_availability_secured',
    'gold_transfer_requirement_backlog_secured',
    'gold_stock_expiry_risk_secured',
    'gold_shift_output_summary_secured',
    'gold_process_order_schedule_adherence_secured',
    'gold_plant_production_quality_summary_secured',
    'gold_process_order_operations_secured',
    'gold_order_downtime_summary_secured',
    'gold_process_order_component_status_secured',
    'gold_dispensary_backlog_secured',
    'gold_lineside_stock_secured',
    'gold_delivery_pick_status_secured',
    'gold_stock_reconciliation_secured',
    'gold_process_order_staging_secured',
    'gold_stock_reconciliation_v2_secured',
    'gold_stock_value_reconciliation_secured',
    'gold_reconciliation_audit_log_secured',
    'gold_movement_reconciliation_secured',
    'gold_hu_reconciliation_secured',
    'gold_physical_inventory_recon_secured',
    'gold_reconciliation_alerts_secured',
    'gold_stock_reconciliation_exceptions_v2_secured',
    'gold_stock_reconciliation_summary_v2_secured',
    'gold_stock_reconciliation_summary_secured',
    'gold_inbound_po_backlog_secured',
    'gold_inbound_po_backlog_enhanced_secured',
    'gold_handling_unit_summary_secured',
    'gold_warehouse_exceptions_secured',
    'gold_warehouse_kpi_snapshot_secured',
    
    -- Conformed serving views (_live)
    'gold_lineside_stock_live',
    'gold_delivery_pick_status_live',
    'gold_process_order_staging_live',
    'gold_stock_expiry_risk_live',
    'gold_inbound_po_backlog_enhanced_live'
  )
ORDER BY table_catalog, table_name, grantee;

-- Query 3: Audit readiness table SELECT access (should show `users` group has SELECT on readiness tables)
SELECT 
  table_catalog, 
  table_schema, 
  table_name, 
  grantee, 
  privilege_type
FROM system.information_schema.table_privileges
WHERE table_catalog IN ('connected_plant_dev', 'connected_plant_uat', 'connected_plant_prod')
  AND table_schema = 'gold'
  AND grantee = 'users'
  AND table_name IN (
    -- Readiness validation tables/views
    'gold_storage_type_role_coverage_status',
    'gold_movement_type_classification_coverage',
    'gold_process_order_staging_validation',
    'gold_recipe_line_enrichment_coverage',
    'gold_delivery_pick_status_validation',
    'gold_stock_reconciliation_readiness',
    'gold_plant_freshness_readiness',
    'gold_validation_failure_detail',
    'gold_plant_readiness_status',
    'gold_data_product_safety_status',
    'gold_readiness_dashboard_source'
  )
ORDER BY table_catalog, table_name, grantee;
