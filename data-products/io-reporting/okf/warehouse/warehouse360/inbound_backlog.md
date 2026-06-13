---
type: Consumption View
title: "Inbound Backlog"
description: "Inbound purchase-order backlog at PO-LINE grain (first wave — ADR-0004 D1; sourced from gold_inbound_po_line_backlog / silver.purchase_order EKKO/EKPO)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog
tags: [warehouse, draft]
contract_id: warehouse360.inbound_backlog
contract_version: "0.2.0"
---

# Inbound Backlog

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `po_id` | string | yes | Purchase order ID |
| `po_item` | string | yes | Purchase order item line number |
| `doc_type` | string | no | PO document type |
| `vendor_id` | string | no | Vendor identifier |
| `storage_loc` | string | no | Target storage location ID |
| `material_id` | string | no | Material code |
| `material_name` | string | no | Material description |
| `ordered_qty` | decimal | no | Total ordered quantity |
| `uom` | string | no | Base unit of measure |
| `po_date` | date | no | Purchase order creation date (EKKO BEDAT, cast to DATE in silver) |
| `oldest_po_age_days` | long | no | Age of the oldest open PO line in days |
| `inbound_backlog_risk_band` | string | no | Backlog risk band (green/amber/red) |

# Grain

one row per plant_id, purchase order ID, and PO item

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_inbound_backlog`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_inbound_backlog`
