---
type: Consumption View
title: "Order Journey"
description: "Order/Batch Journey Timeline summary -- one row per plant_id x order_id."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_journey
tags: [warehouse, draft]
contract_id: wm_operations.order_journey
contract_version: "0.1.0"
---

# Order Journey

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order number (AUFNR) |
| `material_code` | string | no | Finished-good material code |
| `material_name` | string | no | Finished-good material description |
| `order_qty` | double | no | Order quantity (AFKO GAMNG) |
| `uom` | string | no | Order quantity unit of measure |
| `production_line` | string | no | Production line (AUFK CRVER — work centre version / line assignment) |
| `order_created_ts` | timestamp | no | Order creation timestamp (AUFK ERDAT/ERZET) |
| `release_date` | date | no | Order release date (AUFK FTRMI — actual release date) |
| `scheduled_start_date` | date | no | Scheduled production start date (AFKO GSTRS) |
| `scheduled_finish_date` | date | no | Scheduled production finish date (AFKO GLTRS) |
| `first_tr_created_ts` | timestamp | no | Timestamp of the first staging transfer requirement created for this order |
| `staging_tr_count` | long | no | Number of staging transfer requirements linked to this order (LTBK BETYP='P') |
| `staging_first_confirmed_ts` | timestamp | no | Timestamp of the first confirmed staging transfer order item (LTAK QDATU/QZEIT) |
| `staging_last_confirmed_ts` | timestamp | no | Timestamp of the most recent confirmed staging transfer order item |
| `staged_item_count` | long | no | Count of fully confirmed staging TO items linked to this order |
| `staged_item_total` | long | no | Total staging TO items (confirmed + open) linked to this order |
| `production_first_actual_start` | timestamp | no | Actual start timestamp of the first confirmed production operation (AFVC ISDD/ISTD) |
| `production_last_actual_finish` | timestamp | no | Actual finish timestamp of the last confirmed production operation (AFVC IEDD/IETD) |
| `confirmed_yield_qty` | double | no | Total confirmed yield quantity from production operations (AFVC LMNGA) |
| `confirmed_scrap_qty` | double | no | Total confirmed scrap quantity from production operations (AFVC XMNGA) |
| `pi_first_start` | timestamp | no | Timestamp of the first PI sheet execution start (absent at plants without PI replication, e.g. P806) |
| `pi_last_end` | timestamp | no | Timestamp of the last PI sheet execution end (absent at plants without PI replication) |
| `first_gr_posting_date` | date | no | Earliest goods receipt posting date (movement 101 against this order) |
| `last_gr_posting_date` | date | no | Latest goods receipt posting date (movement 101 against this order) |
| `gr_qty` | double | no | Net goods receipt quantity (movement 101 minus 102 reversals) against this order |
| `issue_qty` | double | no | Net component issue quantity (movement 261 minus 262 reversals) against this order |
| `delivery_count` | long | no | Count of distinct outbound deliveries linked to goods movements for this order |
| `qm_lot_count` | long | no | Total QM inspection lots linked to this order |
| `qm_open_lot_count` | long | no | Open QM inspection lots (no usage decision yet) linked to this order |
| `release_to_first_tr_hours` | double | no | Hours from order release_date to first_tr_created_ts (null when either is absent) |
| `tr_to_staged_hours` | double | no | Hours from first_tr_created_ts to staging_last_confirmed_ts (null when either is absent) |
| `staged_to_production_hours` | double | no | Hours from staging_last_confirmed_ts to production_first_actual_start (null when either is absent) |
| `production_to_gr_hours` | double | no | Hours from production_last_actual_finish to first_gr_posting_date (null when either is absent) |

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_order_journey`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_order_journey`
