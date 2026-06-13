---
type: Consumption View
title: "Inbound Deliveries"
description: "Inbound delivery expected-receipt board — EL (standard inbound) and ELST (inbound stock transport) SAP delivery types with expected receipt date, line counts, receipt progress, and query-time receipt_band."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_inbound_deliveries
tags: [warehouse, draft]
contract_id: wm_operations.inbound_deliveries
contract_version: "0.1.0"
---

# Inbound Deliveries

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_id` | string | no | SAP warehouse number (LGNUM) |
| `delivery_id` | string | yes | SAP inbound delivery number (VBELN) |
| `delivery_type` | string | no | SAP delivery type (EL = standard inbound; ELST = inbound stock transport) |
| `shipping_point` | string | no | SAP shipping point (VSTEL) |
| `line_count` | long | no | Number of delivery line items |
| `delivery_qty` | double | no | Total delivery quantity (sum of line quantities; mix of base UoMs when has_mixed_base_uom) |
| `received_qty` | double | no | Received quantity from confirmed GR transfer orders |
| `receipt_fraction` | double | no | received_qty / delivery_qty (0..1; null when delivery_qty is zero or mixed UoM) |
| `has_mixed_base_uom` | boolean | no | True when delivery lines carry more than one base unit of measure (quantity totals approximate) |
| `wm_status_code` | string | no | WM overall status code from LIKP (overall WM activity status) |
| `expected_receipt_date` | date | no | Expected goods receipt date (LIKP WADAT — SAP planned GI/GR date) |
| `actual_receipt_date` | date | no | Actual goods receipt date (first confirmed GR TO confirmation date) |
| `is_received` | boolean | no | True when the delivery has at least one confirmed GR transfer order |
| `days_until_expected_receipt` | long | no | Days from today until expected_receipt_date (query-time, _live view; negative = overdue) |
| `receipt_band` | string | no | Query-time receipt risk band (green = on track; amber = due soon; red = overdue; grey = received) |

# Grain

one row per plant_id and delivery_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_inbound_deliveries`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_inbound_deliveries`
