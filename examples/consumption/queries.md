# Consumption Query Examples

Run these examples against the target Gold schema after secured/live and semantic views are created.

## Plant operations KPI

```sql
SELECT
  plant_code,
  completed_order_count,
  on_time_order_count,
  in_full_order_count,
  quality_rate,
  total_downtime_minutes,
  open_component_count,
  fully_covered_component_count
FROM semantic_plant_operations_kpi
ORDER BY plant_code;
```

## Warehouse performance

```sql
SELECT
  plant_code,
  warehouse_number,
  confirmed_to_item_count,
  avg_pick_accuracy,
  tr_backlog_item_count,
  inbound_open_item_count,
  inbound_remaining_open_qty,
  oldest_po_age_days,
  inbound_backlog_risk_band
FROM semantic_warehouse_performance
WHERE inbound_backlog_risk_band IN ('amber', 'red')
ORDER BY oldest_po_age_days DESC;
```

## Stock health

```sql
SELECT
  plant_code,
  available_qty,
  unavailable_qty,
  expired_qty,
  expiry_risk_lt_7d_qty,
  reconciliation_exception_count,
  abs_delta_value_total,
  has_action_required_recon
FROM semantic_stock_health
WHERE expired_qty > 0
   OR has_action_required_recon
ORDER BY abs_delta_value_total DESC;
```

## Enhanced inbound backlog drill-down

```sql
SELECT
  plant_code,
  vendor_code,
  purchasing_org,
  open_item_count,
  total_ordered_qty,
  total_gr_qty,
  remaining_open_qty,
  putaway_to_count,
  confirmed_putaway_to_count,
  earliest_po_date
FROM gold_inbound_po_backlog_enhanced_live
WHERE remaining_open_qty > 0
ORDER BY earliest_po_date ASC, remaining_open_qty DESC;
```

## Stock reconciliation action list

```sql
SELECT
  plant_code,
  warehouse_number,
  mismatch_reason,
  mismatch_severity,
  exception_count,
  abs_delta_quantity_total,
  abs_delta_value_total,
  reconciliation_status
FROM gold_stock_reconciliation_summary_secured
WHERE reconciliation_status = 'ACTION_REQUIRED'
ORDER BY abs_delta_value_total DESC;
```

## Freshness and health triage

```sql
SELECT
  health_area,
  health_status,
  affected_row_count,
  critical_issue_count,
  warning_issue_count,
  latest_observed_at,
  details
FROM gold_data_health_summary
ORDER BY
  CASE health_status
    WHEN 'FAIL' THEN 1
    WHEN 'WARN' THEN 2
    WHEN 'EVENT_LOG' THEN 3
    ELSE 4
  END,
  health_area;
```
