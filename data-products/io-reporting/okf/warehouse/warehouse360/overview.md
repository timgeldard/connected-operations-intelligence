---
type: Aggregate View
title: "Overview"
description: "Overview metrics for the Warehouse 360 dashboard."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_overview
tags: [warehouse, draft]
contract_id: warehouse360.overview
contract_version: "0.1.0"
---

# Overview

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID or 'GLOBAL' |
| `snapshot_ts` | timestamp | yes | Timestamp of overview snapshot generation |
| `orders_total` | long | no | Total open process orders |
| `orders_red` | long | no | Process orders in critical status (high risk) |
| `orders_amber` | long | no | Process orders in warning status (medium risk) |
| `trs_open` | long | no | Total open transfer requirements |
| `tos_open` | long | no | Total open transfer orders |
| `deliveries_today` | long | no | Total outbound deliveries scheduled for today |
| `deliveries_at_risk` | long | no | Total outbound deliveries at risk of delay |
| `inbound_open` | long | no | Total open inbound purchase orders |
| `bins_blocked` | long | no | Total blocked storage bins |
| `bins_total` | long | no | Total warehouse storage bins |
| `bin_util_pct` | decimal | no | Bin occupancy utilization rate percentage |

# Grain

one row per plant_id and snapshot timestamp

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_overview`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_overview`
