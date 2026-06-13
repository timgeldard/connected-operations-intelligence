---
type: Consumption View
title: "Order Components"
description: "Component-level staging detail for active process orders — the drill-through behind Order Readiness."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_components
tags: [warehouse, draft]
contract_id: wm_operations.order_components
contract_version: "0.1.0"
---

# Order Components

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `order_id` | string | yes |  |
| `reservation_id` | string | yes |  |
| `reservation_item` | string | yes |  |
| `operation_number` | string | no |  |
| `warehouse_id` | string | no |  |
| `material_id` | string | no |  |
| `material_name` | string | no |  |
| `batch_id` | string | no |  |
| `required_qty` | double | no |  |
| `open_qty` | double | no |  |
| `uom` | string | no |  |
| `production_supply_area` | string | no |  |
| `requirement_date` | date | no |  |
| `material_component_count` | long | no |  |
| `tr_count` | long | no |  |
| `tr_required_qty` | double | no |  |
| `tr_open_qty` | double | no |  |
| `tr_coverage_status` | string | yes |  |
| `to_item_count` | long | no |  |
| `to_items_confirmed` | long | no |  |
| `to_confirmed_qty` | double | no |  |
| `pick_progress_fraction` | double | no |  |
| `psa_supplied_qty` | double | no |  |
| `is_supplied` | boolean | no |  |

# Grain

one row per plant_id, order_id, reservation_id and reservation_item

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_order_components`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_components`
