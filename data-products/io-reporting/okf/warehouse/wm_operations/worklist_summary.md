---
type: Aggregate View
title: "Worklist Summary"
description: "WM worklist rolled up by plant, warehouse, work area and status — the WM Operations manager KPI strip."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_worklist_summary
tags: [warehouse, draft]
contract_id: wm_operations.worklist_summary
contract_version: "0.1.0"
---

# Worklist Summary

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_id` | string | yes | SAP warehouse number (LGNUM) |
| `work_area` | string | yes | PRODUCTION_STAGING &#124; DISPENSARY_REPLENISHMENT &#124; DISPENSARY_PICKING &#124; WAREHOUSE_OTHER |
| `worklist_status` | string | yes | OPEN &#124; IN_PROGRESS &#124; PARKED &#124; NO_STOCK &#124; COMPLETE |
| `tr_count` | long | no | Transfer requirements in this bucket |
| `total_open_qty` | double | no | Sum of open quantity |
| `total_required_qty` | double | no | Sum of required quantity |
| `operator_count` | long | no | Distinct assigned operators |
| `earliest_planned_ts` | timestamp | no | Earliest planned execution timestamp in the bucket |
| `earliest_created_ts` | timestamp | no | Earliest TR creation timestamp in the bucket |

# Grain

one row per plant_id, warehouse_id, work_area and worklist_status

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_worklist_summary`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_worklist_summary`
