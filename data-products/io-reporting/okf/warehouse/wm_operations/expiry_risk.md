---
type: Consumption View
title: "Expiry Risk"
description: "Batch-level shelf-life value at risk with query-time expiry buckets and FEFO issue signals."
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
| `unrestricted_qty` | double | no |  |
| `quality_inspection_qty` | double | no |  |
| `blocked_qty` | double | no |  |
| `restricted_use_qty` | double | no |  |
| `in_transfer_qty` | double | no |  |
| `blocked_returns_qty` | double | no |  |
| `total_stock_qty` | double | no |  |
| `expiry_date` | date | no |  |
| `days_to_expiry` | integer | no |  |
| `expiry_band` | string | yes | Query-time expiry bucket: EXPIRED, LT_30_DAYS, DAYS_30_90, DAYS_90_180, GT_180_DAYS, or NO_DATE |
| `manufacture_date` | date | no |  |
| `vendor_batch_number` | string | no |  |
| `shelf_life_days` | long | no |  |
| `minimum_remaining_shelf_life_days` | long | no |  |
| `standard_price` | double | no |  |
| `price_unit` | double | no |  |
| `est_stock_value` | double | no |  |
| `fefo_risk_flag` | boolean | no |  |
| `earlier_expiring_batch` | string | no |  |
| `latest_issue_date` | date | no |  |

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
