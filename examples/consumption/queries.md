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
