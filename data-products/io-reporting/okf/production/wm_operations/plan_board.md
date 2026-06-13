---
type: Consumption View
title: "Plan Board"
description: "Order-grain Gantt data for the Production Planning Board (PEX-E-36)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_plan_board
tags: [production, draft]
contract_id: wm_operations.plan_board
contract_version: "0.1.0"
---

# Plan Board

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order number (AUFNR) |
| `line_id` | string | no | Production line code (CRVER via recipe_process_line); null when line unassigned |
| `material_id` | string | no | Header material code (AFKO PLNBEZ) |
| `material_name` | string | no | Material description from material master |
| `planned_qty` | double | no | Planned order quantity (AFKO GAMNG) |
| `uom` | string | no | Order quantity unit of measure (AFKO GMEIN) |
| `scheduled_start_date` | date | no | Scheduled start date (AFKO GSTRP) |
| `scheduled_finish_date` | date | no | Scheduled finish date (AFKO GLTRP) |
| `actual_start` | timestamp | no | First operation actual start timestamp (from AFVC confirmations via journey_summary) |
| `actual_finish` | date | no | Actual finish date (AUFK GLTRI); null when order still open |
| `delivered_qty` | double | no | Net goods receipts posted against order (movement 101 minus 102, floored at 0) |
| `pct_complete` | double | no | Percentage complete — lineside_now override when available, else yield_pct * 100 |
| `planned_minutes` | integer | no | Planned production duration in minutes (scheduled_finish − scheduled_start); null when undated |
| `elapsed_minutes` | integer | no | Minutes since actual_start (query-time from lineside_now _live); null when not running |
| `projected_finish` | timestamp | no | Extrapolated finish for running orders (elapsed/pct); null when complete or not running |
| `status` | string | yes | Query-time order status — running &#124; atrisk &#124; material-short &#124; completed &#124; firm &#124; open. Precedence: completed > material-short > atrisk > running > firm > open. changeover/cleaning/maintenance are omitted (no governed SAP source). |
| `staging_status` | string | no | TR coverage status from order_readiness — NONE &#124; PARTIAL &#124; FULL |
| `supply_status` | string | no | PSA supply status from order_readiness — NOT_SUPPLIED &#124; PARTIAL &#124; SUPPLIED |
| `is_backlog` | boolean | no | True when order has no scheduled_start or is overdue and not started |
| `is_overdue` | boolean | no | True when scheduled_finish_date < today and order is still open (query-time) |
| `has_shortage` | boolean | no | True when any component is projected short (from shortage_projection) |
| `is_released` | boolean | no | Order has been released for production (AUFK IPRKZ) |
| `is_completed` | boolean | no | Order completion flag (AUFK RÜCKMELDESTATUS) |
| `is_closed` | boolean | no | Order closure flag |

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_plan_board`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_plan_board`
