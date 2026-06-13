---
type: Consumption View
title: "Slow Movers"
description: "Value-weighted stock aging by material and batch with query-time age buckets."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_slow_movers
tags: [warehouse, draft]
contract_id: wm_operations.slow_movers
contract_version: "0.1.0"
---

# Slow Movers

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `material_id` | string | yes |  |
| `material_name` | string | no |  |
| `batch_id` | string | no |  |
| `uom` | string | no |  |
| `quant_count` | long | no |  |
| `total_qty` | double | no |  |
| `stock_value` | double | no |  |
| `standard_price` | double | no |  |
| `last_movement_ts` | timestamp | no |  |
| `earliest_goods_receipt_date` | date | no |  |
| `earliest_expiry_date` | date | no |  |
| `days_since_last_movement` | long | no |  |
| `age_bucket` | string | no |  |

# Grain

one row per plant_id, warehouse_id, material_id and batch_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_slow_movers`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_slow_movers`
