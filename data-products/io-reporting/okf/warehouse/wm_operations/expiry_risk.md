---
type: Consumption View
title: "Expiry Risk"
description: "Batch-level shelf-life risk with query-time expiry buckets."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_expiry_risk
tags: [warehouse, draft]
contract_id: wm_operations.expiry_risk
contract_version: "0.1.0"
---

# Expiry Risk

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `material_id` | string | yes |  |
| `material_name` | string | no |  |
| `batch_id` | string | yes |  |
| `uom` | string | no |  |
| `minimum_expiry_date` | date | no |  |
| `shelf_life_days` | long | no |  |
| `minimum_remaining_shelf_life_days` | long | no |  |
| `total_stock_qty` | double | no |  |
| `minimum_days_to_expiry` | long | no |  |
| `expired_qty` | double | no |  |
| `highest_expiry_risk_bucket` | string | no |  |
| `has_minimum_shelf_life_breach` | boolean | no |  |

# Grain

one row per plant_id, material_id and batch_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_expiry_risk`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_expiry_risk`
