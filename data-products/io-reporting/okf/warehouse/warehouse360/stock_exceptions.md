---
type: Consumption View
title: "Stock Exceptions"
description: "Warehouse stock exceptions including expiry, shelf life breach, and status blocks."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions
tags: [warehouse, draft]
contract_id: warehouse360.stock_exceptions
contract_version: "0.2.0"
---

# Stock Exceptions

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `material_id` | string | yes | Material code |
| `batch_id` | string | yes | Batch number |
| `exception_type` | string | yes | Computed exception bucket (EXPIRED/LT_7_DAYS/DAYS_7_30/DAYS_30_90) |
| `qty` | decimal | no | Exceptional stock quantity |
| `minimum_days_to_expiry` | long | no | Days remaining until the batch expires |
| `has_minimum_shelf_life_breach` | boolean | no | True if remaining shelf life is below minimum limits |

# Grain

one row per plant_id, material_id, batch_id, and exception type

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_stock_exceptions`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_stock_exceptions`
