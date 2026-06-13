---
type: Consumption View
title: "Stock Zones"
description: "Warehouse stock zone capacities and bin counts."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_stock_zones
tags: [warehouse, draft]
contract_id: warehouse360.stock_zones
contract_version: "0.1.0"
---

# Stock Zones

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_number` | string | yes | Warehouse number |
| `storage_type` | string | yes | Storage type |
| `bin_type` | string | yes | Bin type |
| `bin_record_count` | long | yes | Total bin count |
| `occupied_bin_count` | long | yes | Occupied bin count |
| `empty_bin_count` | long | yes | Empty bin count |
| `blocked_bin_count` | long | yes | Blocked bin count |
| `occupancy_rate` | decimal | yes | Occupancy rate |

# Grain

one row per plant_id, warehouse_number, storage_type, and bin_type

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_stock_zones`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_stock_zones`
