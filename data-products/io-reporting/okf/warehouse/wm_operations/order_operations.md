---
type: Consumption View
title: "Order Operations"
description: "Process-order operations enriched with work-centre description — one row per plant_id, order_number, routing_number, and operation_counter."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_operations
tags: [warehouse, draft]
contract_id: wm_operations.order_operations
contract_version: "0.1.0"
---

# Order Operations

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `order_number` | string | yes |  |
| `routing_number` | string | yes |  |
| `operation_counter` | string | yes |  |
| `operation_number` | string | no |  |
| `operation_description` | string | no |  |
| `control_key` | string | no |  |
| `work_centre_code` | string | no |  |
| `work_centre_description` | string | no |  |
| `scheduled_start_datetime` | timestamp | no |  |
| `scheduled_finish_datetime` | timestamp | no |  |
| `actual_start_datetime` | timestamp | no |  |
| `actual_finish_date` | date | no |  |
| `operation_quantity` | double | no |  |
| `confirmed_yield_quantity` | double | no |  |
| `confirmed_scrap_quantity` | double | no |  |
| `is_confirmed` | boolean | no |  |

# Grain

one row per plant_id, order_number, routing_number and operation_counter

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_order_operations`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_operations`
