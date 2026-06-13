---
type: Consumption View
title: "Order Journey Events"
description: "Order/Batch Journey Timeline events -- long-format per-order event feed."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_journey_events
tags: [warehouse, draft]
contract_id: wm_operations.order_journey_events
contract_version: "0.1.0"
---

# Order Journey Events

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `order_id` | string | yes |  |
| `event_seq` | integer | yes |  |
| `event_ts` | timestamp | no |  |
| `event_type` | string | yes |  |
| `qty` | double | no |  |
| `uom` | string | no |  |
| `reference_id` | string | no |  |
| `detail` | string | no |  |

# Grain

one row per plant_id, order_id, and event_seq

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_order_journey_events`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_journey_events`
