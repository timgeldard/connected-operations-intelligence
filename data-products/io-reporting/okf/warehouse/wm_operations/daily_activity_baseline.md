---
type: Consumption View
title: "Daily Activity Baseline"
description: "Day-of-week baseline bands (median, p10, p90) for daily warehouse activity metrics per plant."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_daily_activity_baseline
tags: [warehouse, draft]
contract_id: wm_operations.daily_activity_baseline
contract_version: "0.1.0"
---

# Daily Activity Baseline

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant code. |
| `metric_name` | string | yes | Metric identifier (to_items_confirmed, active_operators, trs_created, goods_receipt_lines, goods_issue_lines). |
| `day_of_week` | integer | yes | Day of week 1 (Sunday) through 7 (Saturday) per Spark dayofweek(). |
| `median_value` | double | no | Percentile 50 (median) of the metric for this plant, metric, and day-of-week combination. |
| `p10_value` | double | no | Percentile 10 of the metric for this plant, metric, and day-of-week combination. |
| `p90_value` | double | no | Percentile 90 of the metric for this plant, metric, and day-of-week combination. |
| `sample_days` | long | no | Count of distinct activity days contributing to this group (days where metric value was non-null). |

# Grain

one row per plant_id, metric_name and day_of_week

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_daily_activity_baseline`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_daily_activity_baseline`
