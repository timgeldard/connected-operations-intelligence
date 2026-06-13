---
type: Aggregate View
title: "Operator Activity"
description: "RF operator pick activity per day from confirmed transfer-order items."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_operator_activity
tags: [warehouse, draft]
contract_id: wm_operations.operator_activity
contract_version: "0.1.0"
---

# Operator Activity

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `operator` | string | yes |  |
| `activity_date` | date | yes |  |
| `shift` | string | no |  |
| `items_confirmed` | long | no |  |
| `transfer_orders` | long | no |  |
| `materials` | long | no |  |
| `transfer_requirements` | long | no |  |
| `confirmed_qty` | double | no |  |

# Grain

one row per plant_id, warehouse_id, operator, activity_date and shift

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_operator_activity`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_operator_activity`
