---
type: Consumption View
title: "Goods Movements"
description: "Goods-movement activity feed at material-document-line (MSEG) grain with movement-type classification flags."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_goods_movements
tags: [warehouse, draft]
contract_id: warehouse360.goods_movements
contract_version: "0.1.0"
---

# Goods Movements

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `storage_location_id` | string | no | Storage location |
| `document_number` | string | yes | Material document number (MBLNR) |
| `fiscal_year` | string | yes | Material document fiscal year (MJAHR) |
| `line_item` | string | yes | Material document line (ZEILE) |
| `material_id` | string | yes | Material code |
| `batch_id` | string | no | Batch number |
| `movement_type_code` | string | yes | SAP movement type (BWART) |
| `movement_label` | string | no | Conformed movement label |
| `event_category` | string | no | Conformed event category (RECEIPT/ISSUE/TRANSFER/...) |
| `is_goods_receipt` | boolean | yes | Movement classified as goods receipt |
| `is_goods_issue` | boolean | yes | Movement classified as goods issue |
| `is_transfer` | boolean | yes | Movement classified as transfer |
| `is_reversal` | boolean | yes | Movement classified as reversal |
| `debit_credit_indicator` | string | no | Debit/credit indicator (SHKZG) |
| `quantity` | decimal | no | Movement quantity in base UoM |
| `uom` | string | no | Base unit of measure |
| `amount_local_currency` | decimal | no | Movement value in local currency |
| `currency` | string | no | Local currency |
| `posting_date` | date | no | Posting date (clustering / window key) |
| `document_date` | date | no | Document date |
| `order_number` | string | no | Linked order (AUFNR) |
| `purchase_order_number` | string | no | Linked purchase order (EBELN) |
| `delivery_number` | string | no | Linked IM delivery (VBELN_IM) |
| `delivery_item_number` | string | no | Linked IM delivery item (VBELP_IM); NULL on pre-existing rows until next full refresh/churn |
| `sales_order_number` | string | no | Linked sales order (KDAUF) |
| `posted_by` | string | no | Posting user (USNAM) |
| `transaction_code` | string | no | SAP transaction code |

# Grain

one row per document_number, fiscal_year, and line_item

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_goods_movements`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_goods_movements`
