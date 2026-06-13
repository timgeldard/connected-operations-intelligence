---
type: Consumption View
title: "Lineside Now"
description: "Running orders + current-phase surface for the Lineside Monitor wall display (PEX-E-35)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_lineside_now
tags: [production, draft]
contract_id: wm_operations.lineside_now
contract_version: "0.1.0"
---

# Lineside Now

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `line_id` | string | yes | Production line code (CRVER via recipe_process_line classification) |
| `order_id` | string | yes | Process order number (AUFNR) |
| `material_id` | string | no | Header material code (AFKO PLNBEZ) |
| `material_name` | string | no | Material description from material master |
| `planned_qty` | double | no | Planned order quantity (AFKO GAMNG) |
| `uom` | string | no | Order quantity unit of measure (AFKO GMEIN) |
| `pct_complete` | double | no | Percentage complete (yield_pct × 100, clamped 0–100); null when no GR evidence |
| `planned_minutes` | integer | no | Planned production duration in minutes (scheduled_finish − scheduled_start); null when undated |
| `production_first_actual_start` | timestamp | no | First actual start timestamp (actual_start_date cast to timestamp) |
| `current_operation_number` | string | no | Operation number (AFVC VORNR) of the latest confirmed operation; null when no confirmation yet |
| `current_operation_description` | string | no | Operation description text (AFVC LTXA1); falls back to "Op <number>" |
| `current_activity_type` | string | no | Activity type label derived from control_key (AFVC STEUS) — Setup / Processing / Teardown / Cleaning / Inspection |
| `elapsed_minutes` | integer | no | Minutes elapsed since production_first_actual_start (query-time, _live layer) |
| `projected_finish` | timestamp | no | Projected finish = production_first_actual_start + planned_minutes (query-time, _live layer); null when undated |

# Grain

one row per plant_id, line_id, and order_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_lineside_now`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_lineside_now`
