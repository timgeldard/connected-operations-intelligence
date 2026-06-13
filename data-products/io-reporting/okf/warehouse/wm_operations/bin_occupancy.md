---
type: Aggregate View
title: "Bin Occupancy"
description: "Bin occupancy and capacity by storage type and bin type (putaway planning)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_bin_occupancy
tags: [warehouse, draft]
contract_id: wm_operations.bin_occupancy
contract_version: "0.1.0"
---

# Bin Occupancy

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `storage_type` | string | yes |  |
| `bin_type` | string | yes |  |
| `bin_record_count` | long | no |  |
| `occupied_bin_count` | long | no |  |
| `empty_bin_count` | long | no |  |
| `blocked_bin_count` | long | no |  |
| `stock_removal_blocked_bin_count` | long | no |  |
| `putaway_blocked_bin_count` | long | no |  |
| `occupancy_rate` | double | no |  |
| `total_stock_qty` | double | no |  |
| `available_stock_qty` | double | no |  |
| `open_transfer_stock_qty` | double | no |  |
| `total_max_quant_count` | long | no | Sum of max_quant_count across bins (LAGP.MAXQU); NULL until full refresh/churn |
| `total_maximum_weight` | double | no | Sum of maximum_weight across bins (LAGP.MGEWI); NULL until full refresh/churn |
| `quant_utilisation_fraction` | double | no | occupied_bin_count / total_max_quant_count; NULL when denominator absent |

# Grain

one row per plant_id, warehouse_id, storage_type and bin_type

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_bin_occupancy`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_bin_occupancy`
