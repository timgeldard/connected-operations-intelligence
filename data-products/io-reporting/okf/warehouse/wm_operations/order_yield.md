---
type: Consumption View
title: "Order Yield"
description: "Order-grain yield summary for the Yield & Loss analytics view."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_yield
tags: [warehouse, draft]
contract_id: wm_operations.order_yield
contract_version: "0.1.0"
---

# Order Yield

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order number (AUFNR) |
| `material_id` | string | no | Finished-good material code |
| `material_name` | string | no | Finished-good material description |
| `production_line` | string | no | Production line (AUFK CRVER) |
| `planned_qty` | double | no | Planned order quantity (AFKO GAMNG) |
| `delivered_qty` | double | no | Net goods receipt quantity (movement 101 minus 102 reversals; clamped at 0) |
| `uom` | string | no | Order quantity unit of measure |
| `yield_pct` | double | no | delivered_qty / planned_qty (null when planned_qty is zero or null) |
| `has_goods_receipt` | boolean | no | True when delivered_qty > 0 (at least one GR movement 101 exists) |
| `is_complete` | boolean | no | True when actual_finish_date is not null (order has an actual finish) |
| `is_released` | boolean | no | True when the order has been released (AUFK is_released or actual_release_date present) |
| `is_completed` | boolean | no | True when the order carries the TECO (technically complete) status flag |
| `is_closed` | boolean | no | True when the order is closed (AUFK is_closed) |
| `scheduled_start_date` | date | no | Scheduled production start date (AFKO GSTRS) |
| `scheduled_finish_date` | date | no | Scheduled production finish date (AFKO GLTRS) |
| `actual_finish_date` | date | no | Actual finish date (AFKO IEDD — the primary completion signal) |
| `first_gr_date` | date | no | Earliest goods receipt posting date (movement 101 against this order) |
| `last_gr_date` | date | no | Latest goods receipt posting date (movement 101 against this order) |

# Grain

one row per plant_id and order_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_order_yield`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_yield`
