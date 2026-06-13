---
type: Consumption View
title: "Worklist"
description: "Supervisor staging/picking worklist at transfer-requirement (job) grain for the WM Operations workspace — read-only mirror of the SAP WM Cockpit (WMA-E-19) Job Assignment grid: work area, RF pick status, assigned operator, queue, campaign and pick progress from linked transfer orders."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_worklist
tags: [warehouse, draft]
contract_id: wm_operations.worklist
contract_version: "0.1.0"
---

# Worklist

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_id` | string | yes | SAP warehouse number (LGNUM) |
| `tr_id` | string | yes | Transfer requirement number (LTBK TBNUM) |
| `work_area` | string | yes | PRODUCTION_STAGING &#124; DISPENSARY_REPLENISHMENT &#124; DISPENSARY_PICKING &#124; WAREHOUSE_OTHER |
| `worklist_status` | string | yes | OPEN &#124; IN_PROGRESS &#124; PARKED &#124; NO_STOCK &#124; COMPLETE (from site RF pick-status fields) |
| `reference_type` | string | no | Source reference type (LTBK BETYP; 'P' = process order) |
| `reference_id` | string | no | Source reference number (process order for BETYP='P') |
| `order_material_id` | string | no | Finished-good material of the referenced process order |
| `order_scheduled_start_date` | date | no | Scheduled start of the referenced process order |
| `source_storage_type` | string | no | Source storage type (LTBK VLTYP) |
| `source_zone` | string | no | Storage zone of the source storage type |
| `destination_storage_type` | string | no | Destination storage type (LTBK NLTYP) |
| `destination_zone` | string | no | Storage zone of the destination storage type |
| `destination_bin` | string | no | Destination bin (LTBK NLPLA) |
| `queue` | string | no | RF queue (ZZQUEUE) |
| `campaign_id` | string | no | Campaign reference (ZZ_CAMPAIGN) |
| `assigned_operator` | string | no | Assigned RF operator ('~' park prefix stripped) |
| `job_sequence` | string | no | Supervisor-assigned job sequence |
| `transfer_priority` | string | no | Transfer priority (TBPRI) |
| `created_by_user` | string | no | TR creator (BNAME) |
| `created_ts` | timestamp | no | TR creation timestamp |
| `planned_execution_ts` | timestamp | no | Planned execution timestamp (PDATU/PZEIT) |
| `item_count` | long | no | TR item count |
| `open_item_count` | long | no | Items still open (not ELIKZ, open qty > 0) |
| `material_count` | long | no | Distinct materials on the TR |
| `material_id` | string | no | Material (single-material TRs only) |
| `material_name` | string | no | Material description (single-material TRs only) |
| `required_qty` | double | no | Total required quantity (MENGE) |
| `open_qty` | double | no | Total open quantity (MENGE - TAMEN, clamped >= 0) |
| `uom` | string | no | Base unit of measure (first item) |
| `has_mixed_base_uom` | boolean | no | True when items mix base UoMs (quantity totals approximate) |
| `to_item_count` | long | no | Linked transfer-order items (LTAK TBNUM) |
| `to_items_confirmed` | long | no | Linked TO items fully confirmed |
| `to_confirmed_qty` | double | no | Confirmed (picked) quantity across linked TOs |
| `latest_to_confirmed_date` | date | no | Latest TO confirmation date |
| `pick_progress_fraction` | double | no | Confirmed TO qty / required qty (0..1; null for mixed-UoM TRs) |
| `latest_to_confirmed_ts` | timestamp | no | Timestamp of the most recent TO item confirmation (query-time, _live view) |
| `cycle_hours` | double | no | Hours from TR creation to latest TO confirmation (cycle time proxy — null until at least one TO item is confirmed for the TR) |
| `age_hours` | double | no | Hours since TR creation (query-time, _live view) |
| `is_overdue` | boolean | no | Planned execution time passed and job not complete (query-time) |
| `short_pick_qty` | double | no | Sum of absolute difference quantities across TO items with a non-zero discrepancy |
| `short_pick_item_count` | long | no | Count of TO line items with a non-zero difference quantity (short-pick signal) |
| `order_production_line` | string | no | Production line (AUFK CRVER) of the linked process order — 99.99% populated at C061/P817 (35 lines / 18-19 lines respectively, verified UAT 2026-06-11). NULL when the TR source is not a process order or the order is not found. |

# Grain

one row per plant_id, warehouse_id and transfer requirement

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_worklist`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_worklist`
