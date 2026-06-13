---
type: Aggregate View
title: "Buffer Flow"
description: "Hourly flows in/out of the palletising (bulk-drop) buffer from confirmed TO items — input for client-side B(t) buffer reconstruction."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_buffer_flow
tags: [warehouse, draft]
contract_id: wm_operations.buffer_flow
contract_version: "0.1.0"
---

# Buffer Flow

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `activity_hour` | timestamp | yes |  |
| `items_in` | long | no |  |
| `qty_in` | double | no |  |
| `items_out` | long | no |  |
| `qty_out` | double | no |  |
| `net_qty` | double | no |  |

# Grain

one row per plant_id, warehouse_id and activity_hour

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_buffer_flow`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_buffer_flow`
