---
type: Aggregate View
title: "Schedule Adherence Daily"
description: "Schedule adherence aggregated to plant x scheduled_finish_date (day) grain."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_schedule_adherence_daily
tags: [warehouse, draft]
contract_id: wm_operations.schedule_adherence_daily
contract_version: "0.1.0"
---

# Schedule Adherence Daily

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `scheduled_date` | date | yes |  |
| `planned_count` | long | yes |  |
| `completed_count` | long | yes |  |
| `on_time_count` | long | yes |  |
| `max_actual_date` | date | no |  |

# Grain

one row per plant_id and scheduled_date

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_schedule_adherence_daily`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_schedule_adherence_daily`
