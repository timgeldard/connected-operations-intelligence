---
type: Consumption View
title: "Staging Workload"
description: "Process-order staging workload and readiness at ORDER grain (first wave — ADR-0004 D3)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_staging_workload
tags: [warehouse, draft]
contract_id: warehouse360.staging_workload
contract_version: "0.2.0"
---

# Staging Workload

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order identifier |
| `material_id` | string | no | Material code being staged |
| `order_qty` | decimal | no | Process order total quantity |
| `uom` | string | no | Unit of measure |
| `material_name` | string | no | Material description |
| `sched_start` | date | no | Scheduled production start date |
| `sched_finish` | date | no | Scheduled production finish date |
| `staging_pct` | double | yes | Staging transfer order items completion percentage |
| `to_items_total` | long | yes | Total transfer order line items generated for staging |
| `to_items_done` | long | yes | Staged (completed) transfer order line items |
| `mins_to_start` | double | no | Time remaining until scheduled production start in minutes |
| `risk` | string | yes | Computed staging risk band (red/amber/green/grey/unvalidated) |

# Grain

one row per plant_id and process order

# Freshness

| SLA tier | Minutes |
| --- | --- |
| Expected | 15 |
| Warning | 30 |
| Critical | 60 |

# Access

Row-level security key: `plant_id`

Entitlement source: `published.central_services.user_plant_access`

# Source

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_staging_workload`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_staging_workload`
