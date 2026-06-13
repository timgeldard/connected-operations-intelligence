---
type: Consumption View
title: "Adherence Root Cause"
description: "Order-grain adherence miss root-cause classification for Production Progress."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_adherence_root_cause
tags: [warehouse, draft]
contract_id: wm_operations.adherence_root_cause
contract_version: "0.1.0"
---

# Adherence Root Cause

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order number (AUFNR) |
| `material_id` | string | no | Header material code (AFPO MATNR) |
| `material_name` | string | no | Material description |
| `order_qty` | double | no | Planned order quantity (AFKO GAMNG) |
| `uom` | string | no | Order quantity unit of measure |
| `production_line` | string | no | Production line / work centre |
| `scheduled_start_date` | date | no | Scheduled start date (AFKO GSTRS) |
| `scheduled_finish_date` | date | no | Scheduled finish date (AFKO GLTRS) |
| `actual_release_date` | date | no | Actual release date (AUFK FTRMI) |
| `actual_finish_date` | date | no | Actual finish date (AUFK GLTRI); null when order still open |
| `root_cause_class` | string | yes | LATE_RELEASE &#124; MATERIAL_SHORT &#124; CAPACITY &#124; UNCLASSIFIED |
| `is_late_release` | boolean | no | True when actual_release_date > scheduled_start_date |
| `has_material_short` | boolean | no | True when any component variance_qty is below tolerance (under-issue) |
| `shortfall_component_count` | long | no | Count of components with under-issue beyond tolerance |
| `min_variance_qty` | double | no | Most negative component variance_qty on the order (under-issue depth) |
| `release_to_production_hours` | double | no | Hours from release to first operation actual start (capacity signal) |
| `production_first_actual_start` | timestamp | no | First operation actual start timestamp (AFVC/operation confirmations) |
| `is_finish_late` | boolean | no | True when actual_finish_date > scheduled_finish_date |
| `is_open_late` | boolean | no | True when unfinished and scheduled_finish_date is before today (query-time) |

# Grain

one row per plant_id and order_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_adherence_root_cause`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_adherence_root_cause`
