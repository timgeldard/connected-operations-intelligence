---
type: Consumption View
title: "Stock Holds"
description: "Quant-level QI/blocked/restricted holds with query-time age."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_stock_holds
tags: [warehouse, draft]
contract_id: wm_operations.stock_holds
contract_version: "0.1.0"
---

# Stock Holds

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `storage_type` | string | no |  |
| `bin_id` | string | no |  |
| `quant_id` | string | yes |  |
| `material_id` | string | no |  |
| `batch_id` | string | no |  |
| `hold_type` | string | yes |  |
| `qty` | double | no |  |
| `uom` | string | no |  |
| `goods_receipt_date` | date | no |  |
| `age_hours` | double | no |  |

# Grain

one row per plant_id, warehouse_id and quant_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_stock_holds`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_stock_holds`
