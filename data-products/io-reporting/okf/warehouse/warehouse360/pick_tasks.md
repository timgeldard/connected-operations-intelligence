---
type: Consumption View
title: "Pick Tasks"
description: "Open transfer-order items (item_status != 'Fully Confirmed') as staging pick tasks, with source/destination locations, quantities, status, and process-order linkage (BETYP/BENUM)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_pick_tasks
tags: [warehouse, draft]
contract_id: warehouse360.pick_tasks
contract_version: "0.1.0"
---

# Pick Tasks

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_number` | string | yes | Warehouse number |
| `task_id` | string | yes | Transfer order number |
| `item_number` | string | yes | Transfer order item number |
| `material_id` | string | yes | Material code |
| `batch_id` | string | no | Batch number |
| `source_storage_type` | string | no | Source storage type |
| `source_storage_bin` | string | no | Source bin |
| `destination_storage_type` | string | no | Destination storage type |
| `destination_storage_bin` | string | no | Destination bin |
| `requested_quantity` | decimal | no | Requested quantity (VSOLM) |
| `confirmed_quantity` | decimal | no | Confirmed quantity (VISTA) |
| `item_status` | string | yes | Open or Partially Confirmed (Fully Confirmed excluded) |
| `created_datetime` | timestamp | no | Transfer order creation timestamp |
| `order_reference_type` | string | no | SAP reference type (BETYP; F = process order) |
| `order_reference_number` | string | no | SAP reference number (BENUM; process order when BETYP='F') |
| `transfer_priority` | string | no | Transfer priority |
| `delivery_number` | string | no | Linked delivery number |
| `created_by_user` | string | no | TO creator (BNAME) |
| `confirmed_by_user` | string | no | Confirming user (QNAME) — maps to assignee in the app |
| `age_hours` | decimal | no | Query-time age in hours since TO creation |

# Grain

one row per warehouse_number, task_id (transfer order), and item_number

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_pick_tasks`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_pick_tasks`
