---
type: Consumption View
title: "Qm Disposition Queue"
description: "QM disposition queue — open lots only (no usage decision), enriched with blocked stock quantity (MCHB.CINSM) and estimated blocked value (blocked_qty × standard_price / price_unit)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_disposition_queue
tags: [warehouse, draft]
contract_id: wm_operations.qm_disposition_queue
contract_version: "0.1.0"
---

# Qm Disposition Queue

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
| `blocked_qty` | double | no |  |
| `blocked_uom` | string | no |  |
| `est_blocked_value` | double | no |  |
| `lot_age_days` | integer | no |  |
| `is_overdue` | boolean | no |  |

# Grain

one row per plant_id and lot_id (open lots only)

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_qm_disposition_queue`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_disposition_queue`
