---
type: Aggregate View
title: "Wip Stages"
description: "Active process order WIP funnel — one row per plant_id x order_id for released, not-finished orders."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_wip_stages
tags: [warehouse, draft]
contract_id: wm_operations.wip_stages
contract_version: "0.1.0"
---

# Wip Stages

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `order_id` | string | yes |  |
| `material_code` | string | no |  |
| `material_name` | string | no |  |
| `order_qty` | double | no |  |
| `uom` | string | no |  |
| `scheduled_start_date` | date | no |  |
| `scheduled_finish_date` | date | no |  |
| `stage` | string | yes | RELEASED &#124; STAGING &#124; STAGED &#124; IN_PRODUCTION &#124; GR_PARTIAL &#124; GR_COMPLETE |
| `first_tr_created_ts` | timestamp | no |  |
| `staging_last_confirmed_ts` | timestamp | no |  |
| `production_first_actual_start` | timestamp | no |  |
| `first_gr_posting_date` | date | no |  |
| `gr_qty` | double | no |  |

# Grain

one row per plant_id and order_id (active orders only)

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_wip_stages`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_wip_stages`
