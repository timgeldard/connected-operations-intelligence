---
type: Consumption View
title: "Downtime Events"
description: "Production downtime events at event grain — passthrough from silver.downtime_event."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_downtime_events
tags: [warehouse, draft]
contract_id: wm_operations.downtime_events
contract_version: "0.1.0"
---

# Downtime Events

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `work_centre_code` | string | no |  |
| `machine_code` | string | no |  |
| `machine_description` | string | no |  |
| `production_line_description` | string | no |  |
| `order_number` | string | no |  |
| `material_code` | string | no |  |
| `operation_number` | string | no |  |
| `item_number` | string | no |  |
| `downtime_reason_code` | string | no |  |
| `downtime_reason_description` | string | no |  |
| `sub_reason_code` | string | no |  |
| `sub_reason_description` | string | no |  |
| `start_datetime` | timestamp | no |  |
| `end_datetime` | timestamp | no |  |
| `duration_minutes` | double | no |  |
| `reported_by_user` | string | no |  |
| `comment` | string | no |  |

# Grain

one row per downtime entry (plant_id + order_number + operation_number + item_number is the closest natural key; multiple downtime entries can share these fields)

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_downtime_events`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_downtime_events`
