---
type: Consumption View
title: "Pi Accuracy"
description: "Physical-inventory count accuracy KPIs aggregated to plant × storage_location × ABC cycle-count class × currency × month grain."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_pi_accuracy
tags: [warehouse, draft]
contract_id: wm_operations.pi_accuracy
contract_version: "0.1.0"
---

# Pi Accuracy

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant code (ISEG WERKS) |
| `storage_location_id` | string | yes | Storage location (ISEG LGORT); zone mapping not available at this grain |
| `abc_indicator` | string | yes | ABC cycle-counting indicator (ISEG ABCIN); empty string when not set |
| `currency` | string | no | Local currency code (ISEG WAERS); group key — do not sum across currencies |
| `count_month` | date | no | First day of the count month; derived from date_trunc('month', count_date) |
| `due_lines` | long | yes | Total PI document lines in the period (all ISEG lines with count_date in count_month, regardless of status). Honest coverage denominator — recounts are counted as distinct lines. |
| `counted_lines` | long | yes | Lines where is_counted = true (ISEG XZAEL) |
| `matched_lines` | long | yes | Lines where physical_inventory_status = MATCHED (delta_quantity within 0.001) |
| `recount_required_lines` | long | yes | Lines where is_recount_required = true (ISEG XNZAE) |
| `lines_with_difference` | long | yes | Lines with status DIFFERENCE_POSTED or DIFFERENCE_NOT_POSTED |
| `count_accuracy_pct` | double | no | matched_lines / counted_lines; null when counted_lines = 0 |
| `coverage_pct` | double | no | counted_lines / due_lines; null when due_lines = 0 |
| `recount_rate_pct` | double | no | recount_required_lines / counted_lines; null when counted_lines = 0 |
| `total_adjustment_value` | double | no | Sum of delta_value (ISEG DMBTR) in local currency; net signed adjustment |
| `abs_adjustment_value` | double | no | Sum of abs(delta_value); absolute magnitude of inventory adjustments |
| `net_adjustment_qty` | double | no | Sum of abs_delta_quantity across all lines in the group |

# Grain

one row per plant_id, storage_location_id, abc_indicator, currency and count_month

# Freshness

| SLA tier | Minutes |
| --- | --- |
| Expected | 60 |
| Warning | 120 |
| Critical | 240 |

# Access

Row-level security key: `plant_id`

Entitlement source: `published.central_services.user_plant_access`

# Source

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_pi_accuracy`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_pi_accuracy`
