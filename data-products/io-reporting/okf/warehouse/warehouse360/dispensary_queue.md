---
type: Consumption View
title: "Dispensary Queue"
description: "Dispensary staging component weighing and preparation queue."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_dispensary_queue
tags: [warehouse, draft]
contract_id: warehouse360.dispensary_queue
contract_version: "0.1.0"
---

# Dispensary Queue

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order ID |
| `component_id` | string | yes | Weighing component material code |
| `task_id` | string | yes | Dispensary task identifier |
| `status` | string | no | Dispensary task status |

# Grain

one row per plant_id, process order, component, and weighing task

# Freshness

| SLA tier | Minutes |
| --- | --- |
| Expected | 15 |
| Warning | 30 |
| Critical | 60 |

# Access

Row-level security key: `plant_id`

Entitlement source: `published.central_services.user_plant_access`

# Source

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_dispensary_queue`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_dispensary_queue`
