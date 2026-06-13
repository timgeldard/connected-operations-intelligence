---
type: Aggregate View
title: "Downtime Pareto"
description: "Weekly production downtime pareto aggregated by plant, week, reason code, sub-reason code, and work centre."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_downtime_pareto
tags: [warehouse, draft]
contract_id: wm_operations.downtime_pareto
contract_version: "0.1.0"
---

# Downtime Pareto

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `week_start` | date | yes |  |
| `downtime_reason_code` | string | no |  |
| `sub_reason_code` | string | no |  |
| `work_centre_code` | string | no |  |
| `downtime_reason_description` | string | no |  |
| `sub_reason_description` | string | no |  |
| `production_line_description` | string | no |  |
| `event_count` | long | no |  |
| `total_duration_minutes` | double | no |  |
| `avg_duration_minutes` | double | no |  |
| `distinct_order_count` | long | no |  |

# Grain

one row per plant_id, week_start, downtime_reason_code, sub_reason_code and work_centre_code

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_downtime_pareto`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_downtime_pareto`
