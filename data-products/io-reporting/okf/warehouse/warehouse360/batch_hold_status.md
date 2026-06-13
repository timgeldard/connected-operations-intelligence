---
type: Consumption View
title: "Batch Hold Status"
description: "Warehouse stock and hold status for a batch, release-decision oriented."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_batch_hold_status
tags: [warehouse, draft]
contract_id: warehouse360.batch_hold_status
contract_version: "0.1.0"
---

# Batch Hold Status

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `storage_location_id` | string | yes | Storage location ID |
| `material_id` | string | yes | Material ID |
| `batch_id` | string | yes | Batch ID |
| `uom` | string | yes | Base unit of measure |
| `unrestricted_quantity` | double | yes | Unrestricted stock quantity |
| `blocked_quantity` | double | yes | Blocked stock quantity |
| `restricted_quantity` | double | yes | Restricted stock quantity |
| `total_quantity` | double | yes | Total stock quantity |
| `stock_type` | string | yes | Stock status category |
| `has_blocking_hold` | boolean | yes | Whether batch is under any blocking hold |
| `last_updated_at` | timestamp | yes | Timestamp when status was last updated |

# Grain

one row per plant_id, storage_location_id, material_id, and batch_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_batch_hold_status`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_batch_hold_status`
