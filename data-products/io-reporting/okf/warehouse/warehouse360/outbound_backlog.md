---
type: Consumption View
title: "Outbound Backlog"
description: "Outbound deliveries picking backlog and cutoff risk."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog
tags: [warehouse, draft]
contract_id: warehouse360.outbound_backlog
contract_version: "0.1.0"
---

# Outbound Backlog

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `delivery_id` | string | yes | Outbound delivery number |
| `delivery_type` | string | no | Delivery document type |
| `customer_id` | string | no | Ship-to customer number |
| `customer_name` | string | no | Customer name |
| `planned_gi_date` | date | no | Planned goods issue date |
| `actual_gi_date` | date | no | Actual goods issue date |
| `delivery_date` | string | no | SAP delivery date (string) |
| `gross_weight` | decimal | no | Gross weight of the delivery |
| `pick_pct` | double | yes | Picking progress percentage |
| `line_count` | long | yes | Total line items in delivery |
| `risk` | string | yes | Computed risk band (red/amber/green/grey) |
| `shipped` | boolean | yes | Delivery goods-issue shipped status |

# Grain

one row per plant_id and delivery ID

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_outbound_backlog`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_outbound_backlog`
