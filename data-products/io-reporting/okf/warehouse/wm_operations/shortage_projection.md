---
type: Consumption View
title: "Shortage Projection"
description: "Open order-component shortage projection."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_shortage_projection
tags: [warehouse, draft]
contract_id: wm_operations.shortage_projection
contract_version: "0.1.0"
---

# Shortage Projection

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `order_id` | string | yes |  |
| `material_id` | string | yes |  |
| `material_name` | string | no |  |
| `open_qty` | double | yes |  |
| `uom` | string | no |  |
| `requirement_date` | date | no | Component requirement date (RESB BDTER) |
| `reservation_ref` | string | yes |  |
| `projected_balance_at_demand` | double | no |  |
| `is_projected_short` | boolean | yes |  |
| `first_short_date` | date | no | Earliest date running balance went negative for this material |
| `scheduled_start_date` | date | no |  |
| `scheduled_finish_date` | date | no |  |
| `production_line` | string | no |  |

# Grain

one row per plant_id, order_id, material_id, and reservation_ref

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_shortage_projection`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_shortage_projection`
