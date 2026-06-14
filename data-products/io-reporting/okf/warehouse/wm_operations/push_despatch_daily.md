---
type: Consumption View
title: "Push Despatch Daily"
description: "Push Despatch daily KPI aggregate (WMA-E-23, Spec 14)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_push_despatch_daily
tags: [warehouse, draft]
contract_id: wm_operations.push_despatch_daily
contract_version: "0.1.0"
---

# Push Despatch Daily

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant code — shipping (source) plant; canonical axis |
| `destination_customer` | string | no | Ship-to customer code; receiving party for ZPUS deliveries |
| `goods_issue_day` | date | no | Day of goods issue (date_trunc('day', actual_goods_issue_date)); grain key |
| `weight_unit` | string | no | Weight unit of measure; grain key — do not aggregate across mixed units |
| `push_delivery_count` | long | yes | Count of push despatch deliveries goods-issued on this day |
| `pallets_pushed` | long | no | Sum of pallet_count; nullable — NULL-propagated from delivery grain where HU table absent |
| `line_count` | long | yes | Sum of delivery item line counts |
| `total_net_weight` | double | no | Sum of net weights in weight_unit; double |
| `pgi_complete_count` | long | yes | Count of deliveries with PGI complete on this day |
| `on_time_pgi_count` | long | yes | Count of deliveries with PGI on-time (actual <= planned) on this day |
| `on_time_pgi_pct` | double | no | On-time PGI fraction (on_time_pgi_count / pgi_complete_count); NULL when pgi_complete_count = 0 (zero-denominator guard) |

# Grain

one row per plant_id × destination_customer × goods_issue_day × weight_unit

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_push_despatch_daily`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_push_despatch_daily`
