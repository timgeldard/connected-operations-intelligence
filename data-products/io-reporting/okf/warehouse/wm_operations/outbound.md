---
type: Consumption View
title: "Outbound"
description: "Outbound delivery picking board — pick progress and goods-issue risk per open delivery (reuses gold_delivery_pick_status with query-time risk bands)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_outbound
tags: [warehouse, draft]
contract_id: wm_operations.outbound
contract_version: "0.1.0"
---

# Outbound

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | no |  |
| `delivery_id` | string | yes |  |
| `delivery_type` | string | no |  |
| `ship_to_customer_id` | string | no |  |
| `ship_to_customer_name` | string | no |  |
| `line_count` | long | no |  |
| `delivery_qty` | double | no |  |
| `picked_qty` | double | no |  |
| `pick_fraction` | double | no |  |
| `has_mixed_base_uom` | boolean | no |  |
| `planned_goods_issue_date` | date | no |  |
| `actual_goods_issue_date` | date | no |  |
| `is_shipped` | boolean | no |  |
| `days_to_goods_issue` | long | no |  |
| `risk_band` | string | no |  |

# Grain

one row per plant_id and delivery_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_outbound`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_outbound`
