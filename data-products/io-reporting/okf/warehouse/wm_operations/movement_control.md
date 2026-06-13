---
type: Aggregate View
title: "Movement Control"
description: "IM goods-movement postings reconciled to WM confirmed-TO activity per posting date."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_movement_control
tags: [warehouse, draft]
contract_id: wm_operations.movement_control
contract_version: "0.1.0"
---

# Movement Control

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `posting_date` | date | no |  |
| `material_id` | string | yes |  |
| `batch_id` | string | no |  |
| `uom` | string | no |  |
| `movement_type_code` | string | yes |  |
| `im_document_line_count` | long | no |  |
| `im_qty` | double | no |  |
| `im_value` | double | no |  |
| `wm_to_line_count` | long | no |  |
| `wm_qty` | double | no |  |
| `delta_qty` | double | no |  |
| `abs_delta_qty` | double | no |  |
| `movement_reconciliation_status` | string | no |  |

# Grain

one row per plant_id, warehouse_id, posting_date, material_id, batch_id and movement_type_code

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_movement_control`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_movement_control`
