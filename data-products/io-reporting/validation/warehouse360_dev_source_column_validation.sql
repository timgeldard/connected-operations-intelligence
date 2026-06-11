-- Warehouse360 DEV source column validation
-- Target: connected_plant_dev.gold_io_reporting
-- Purpose: identify missing source columns required by warehouse360_consumption_views_dev.sql.

WITH expected_columns AS (
  SELECT 'gold_warehouse_kpi_snapshot_live' AS table_name, 'plant_code' AS column_name UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'snapshot_date' UNION ALL  -- query-time column (base MV is deterministic)
  SELECT 'gold_warehouse_kpi_snapshot_live', 'active_order_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'open_tr_item_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'open_to_item_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'open_delivery_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'open_inbound_item_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'blocked_bin_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'total_bin_count' UNION ALL
  SELECT 'gold_warehouse_kpi_snapshot_live', 'bin_utilisation_pct' UNION ALL

  SELECT 'gold_inbound_po_backlog_enhanced_live', 'plant_id' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'po_id' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'po_item' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'doc_type' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'vendor_id' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'vendor_name' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'storage_loc' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'material_id' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'material_name' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'ordered_qty' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'gr_qty' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'uom' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'delivery_date' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'po_date' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'open_qty' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'qa_status' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'oldest_po_age_days' UNION ALL
  SELECT 'gold_inbound_po_backlog_enhanced_live', 'inbound_backlog_risk_band' UNION ALL

  SELECT 'gold_delivery_pick_status_live', 'plant_id' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'delivery_id' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'delivery_type' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'customer_id' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'customer_name' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'carrier' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'planned_goods_issue_date' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'actual_goods_issue_date' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'delivery_date' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'gross_weight' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'pick_fraction' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'line_count' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'risk_band' UNION ALL
  SELECT 'gold_delivery_pick_status_live', 'is_shipped' UNION ALL

  SELECT 'gold_process_order_staging_live', 'plant_id' UNION ALL
  SELECT 'gold_process_order_staging_live', 'order_id' UNION ALL
  SELECT 'gold_process_order_staging_live', 'material_id' UNION ALL
  SELECT 'gold_process_order_staging_live', 'order_qty' UNION ALL
  SELECT 'gold_process_order_staging_live', 'uom' UNION ALL
  SELECT 'gold_process_order_staging_live', 'material_name' UNION ALL
  SELECT 'gold_process_order_staging_live', 'scheduled_start_date' UNION ALL
  SELECT 'gold_process_order_staging_live', 'scheduled_finish_date' UNION ALL
  SELECT 'gold_process_order_staging_live', 'staging_fraction' UNION ALL
  SELECT 'gold_process_order_staging_live', 'to_items_total' UNION ALL
  SELECT 'gold_process_order_staging_live', 'to_items_done' UNION ALL
  SELECT 'gold_process_order_staging_live', 'days_to_start' UNION ALL
  SELECT 'gold_process_order_staging_live', 'risk_band' UNION ALL
  SELECT 'gold_process_order_staging_live', 'reservation_no' UNION ALL
  SELECT 'gold_process_order_staging_live', 'batch_id' UNION ALL
  SELECT 'gold_process_order_staging_live', 'sap_order' UNION ALL

  SELECT 'gold_stock_expiry_risk_live', 'plant_id' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'material_id' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'batch_id' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'storage_location_id' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'highest_expiry_risk_bucket' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'total_stock_qty' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'minimum_days_to_expiry' UNION ALL
  SELECT 'gold_stock_expiry_risk_live', 'has_minimum_shelf_life_breach' UNION ALL

  SELECT 'gold_transfer_requirement_backlog', 'plant_id' UNION ALL
  SELECT 'gold_transfer_requirement_backlog', 'material_id' UNION ALL
  SELECT 'gold_transfer_requirement_backlog', 'open_tr_qty' UNION ALL
  SELECT 'gold_transfer_requirement_backlog', 'open_tr_items' UNION ALL
  SELECT 'gold_transfer_requirement_backlog', 'oldest_tr_creation_date' UNION ALL

  SELECT 'gold_warehouse_exceptions_live', 'plant_code' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'material_code' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'batch_number' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'warehouse_number' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'exception_type' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'severity' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'sla_hours' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'quantity' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'detail' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'age_days' UNION ALL
  SELECT 'gold_warehouse_exceptions_live', 'detected_date'  -- query-time column (base MV holds deterministic candidates)
),
actual_columns AS (
  SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
  FROM connected_plant_dev.information_schema.columns
  WHERE table_schema = 'gold_io_reporting'
)
SELECT
  e.table_name,
  e.column_name,
  a.data_type,
  a.is_nullable,
  CASE WHEN a.column_name IS NULL THEN 'MISSING' ELSE 'FOUND' END AS validation_status
FROM expected_columns e
LEFT JOIN actual_columns a
  ON e.table_name = a.table_name
 AND e.column_name = a.column_name
ORDER BY e.table_name, e.column_name;
