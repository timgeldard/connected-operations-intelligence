---
type: Aggregate View
title: "Staging Demand"
description: "Planned staging demand wave: open TR quantity by planned execution hour and work area."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_staging_demand
tags: [warehouse, draft]
contract_id: wm_operations.staging_demand
contract_version: "0.1.0"
---

# Staging Demand

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `work_area` | string | yes |  |
| `production_supply_area` | string | no |  |
| `demand_hour` | timestamp | yes |  |
| `open_trs` | long | no |  |
| `open_qty` | double | no |  |

# Grain

one row per plant_id, warehouse_id, work_area, production_supply_area and demand_hour

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_staging_demand`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_staging_demand`
