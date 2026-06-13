---
type: Consumption View
title: "Qm Lot Status"
description: "QM inspection lot status — one row per plant_id and lot_id (all lots in the silver lookback window)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_lot_status
tags: [warehouse, draft]
contract_id: wm_operations.qm_lot_status
contract_version: "0.1.0"
---

# Qm Lot Status

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `lot_id` | string | yes |  |
| `inspection_lot_origin_code` | string | no |  |
| `inspection_type` | string | no |  |
| `material_id` | string | no |  |
| `material_name` | string | no |  |
| `batch_id` | string | no |  |
| `order_id` | string | no |  |
| `lot_created_date` | date | no |  |
| `inspection_start_date` | date | no |  |
| `inspection_end_date` | date | no |  |
| `lot_qty` | double | no |  |
| `lot_uom` | string | no |  |
| `has_usage_decision` | boolean | no |  |
| `last_usage_decision` | string | no |  |
| `last_usage_decision_date` | date | no |  |
| `last_usage_decision_by` | string | no |  |
| `quality_score` | string | no |  |
| `lot_age_days` | integer | no |  |
| `ud_lead_time_days` | integer | no |  |
| `is_overdue` | boolean | no |  |

# Grain

one row per plant_id and lot_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_qm_lot_status`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_lot_status`
