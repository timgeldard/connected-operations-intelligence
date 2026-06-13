---
type: Aggregate View
title: "Queue Workload"
description: "Current open WM workload by queue and work area (non-complete worklist jobs)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_queue_workload
tags: [warehouse, draft]
contract_id: wm_operations.queue_workload
contract_version: "0.1.0"
---

# Queue Workload

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `queue` | string | yes |  |
| `work_area` | string | yes |  |
| `open_jobs` | long | no |  |
| `in_progress_jobs` | long | no |  |
| `parked_jobs` | long | no |  |
| `no_stock_jobs` | long | no |  |
| `operator_count` | long | no |  |
| `earliest_planned_ts` | timestamp | no |  |
| `earliest_created_ts` | timestamp | no |  |

# Grain

one row per plant_id, warehouse_id, queue and work_area

# Freshness

| SLA tier | Minutes |
| --- | --- |
| Expected | 30 |
| Warning | 60 |
| Critical | 120 |

# Access

Row-level security key: `plant_id`

Entitlement source: `published.central_services.user_plant_access`

# Source

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_queue_workload`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_queue_workload`
