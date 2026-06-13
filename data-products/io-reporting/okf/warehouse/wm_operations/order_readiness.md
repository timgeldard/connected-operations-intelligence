---
type: Consumption View
title: "Order Readiness"
description: "Released process orders with derived TR coverage (component demand converted to TRs — the WM Cockpit 'TR' status) and PSA supply status (stock in order-keyed Production Supply bins — the cockpit 'ST' status), plus a query-time readiness band."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_readiness
tags: [warehouse, draft]
contract_id: wm_operations.order_readiness
contract_version: "0.1.0"
---

# Order Readiness

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order number (AUFNR) |
| `warehouse_id` | string | no | Warehouse serving the order's WM components |
| `material_id` | string | no | Finished-good material |
| `material_name` | string | no | Finished-good material description |
| `order_qty` | double | no | Order quantity (GAMNG) |
| `uom` | string | no | Order quantity UoM |
| `scheduled_start_date` | date | no | Scheduled start (GSTRS) |
| `scheduled_finish_date` | date | no | Scheduled finish |
| `production_supply_area` | string | no | Production supply area (RESB PRVBE, first non-null) |
| `component_count` | long | no | Production-consumption component reservations |
| `wm_component_count` | long | no | Components carrying a WM warehouse number |
| `wm_component_required_qty` | double | no | Required quantity across WM-managed components |
| `component_open_qty` | double | no | Open (unissued) component quantity |
| `tr_count` | long | no | Transfer requirements created for the order |
| `tr_required_qty` | double | no | Quantity covered by TRs |
| `tr_open_qty` | double | no | TR quantity not yet converted to TOs |
| `tr_coverage_status` | string | yes | NONE &#124; PARTIAL &#124; FULL (cockpit 'TR' status) |
| `psa_supplied_qty` | double | no | Stock in order-keyed Production Supply bins |
| `supply_status` | string | yes | NOT_SUPPLIED &#124; PARTIAL &#124; SUPPLIED (cockpit 'ST' status) |
| `readiness_status` | string | yes | SUPPLIED &#124; STAGING_PLANNED &#124; PARTIALLY_PLANNED &#124; NOT_STARTED &#124; NO_WM_DEMAND |
| `days_to_start` | long | no | Days until scheduled start (query-time, _live view) |
| `readiness_band` | string | no | red &#124; amber &#124; green &#124; grey (query-time traffic light) |
| `production_line` | string | no | Production line (AUFK CRVER) of the process order — 99.99% populated at C061/P817 (35 lines / 18-19 lines respectively, verified UAT 2026-06-11). |

# Grain

one row per plant_id and process order

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_order_readiness`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_readiness`
