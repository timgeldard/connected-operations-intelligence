---
type: Consumption View
title: "Shortfalls"
description: "Material shortfalls — open transfer-requirement backlog aggregated to plant x material (ADR-0004 D2; upstream lineage: the transfer-requirement material-backlog gold MV over the silver warehouse transfer requirements)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_shortfalls
tags: [warehouse, draft]
contract_id: warehouse360.shortfalls
contract_version: "0.2.0"
---

# Shortfalls

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `material_id` | string | yes | Shortage material code |
| `shortfall_qty` | decimal | no | Total open transfer requirement quantity pending staging |
| `open_items_count` | long | no | Count of open transfer requirement lines for this material |
| `oldest_tr_date` | date | no | Creation date of the oldest open transfer requirement |

# Grain

one row per plant_id and material_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_shortfalls`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_shortfalls`
