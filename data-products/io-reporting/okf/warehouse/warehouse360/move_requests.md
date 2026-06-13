---
type: Consumption View
title: "Move Requests"
description: "Open transfer-requirement items (not processing-complete, open_quantity > 0) as warehouse move requests, with source/destination locations, queue, priority, and reference linkage."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_move_requests
tags: [warehouse, draft]
contract_id: warehouse360.move_requests
contract_version: "0.1.0"
---

# Move Requests

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_number` | string | yes | Warehouse number |
| `request_id` | string | yes | Transfer requirement number |
| `item_number` | string | yes | Transfer requirement item number |
| `material_id` | string | yes | Material code |
| `batch_id` | string | no | Batch number |
| `source_storage_type` | string | no | Source storage type |
| `source_storage_bin` | string | no | Source bin |
| `destination_storage_type` | string | no | Destination storage type |
| `destination_storage_bin` | string | no | Destination bin |
| `required_quantity` | decimal | no | Required quantity (MENGE) |
| `open_quantity` | decimal | no | Open quantity (MENGE - TAMEN) |
| `created_datetime` | timestamp | no | Transfer requirement creation timestamp |
| `planned_execution_datetime` | timestamp | no | Planned execution timestamp |
| `queue` | string | no | WM queue (custom ZZQUEUE) |
| `transfer_priority` | string | no | Transfer priority |
| `order_reference_type` | string | no | SAP reference type (BETYP) |
| `order_reference_number` | string | no | SAP reference number (BENUM) |
| `age_hours` | decimal | no | Query-time age in hours since TR creation |

# Grain

one row per warehouse_number, request_id (transfer requirement), and item_number

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_move_requests`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_move_requests`
