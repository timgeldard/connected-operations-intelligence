---
type: Consumption View
title: "Open Holds"
description: "Occupied WM quants under hold (quality-inspection, blocked, or batch-restricted stock) with quantity and goods-receipt age."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_open_holds
tags: [warehouse, draft]
contract_id: warehouse360.open_holds
contract_version: "0.1.0"
---

# Open Holds

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_number` | string | yes | Warehouse number |
| `storage_type` | string | no | Storage type holding the quant |
| `storage_bin` | string | no | Bin code holding the quant |
| `quant_number` | string | yes | WM quant number (LQUA) |
| `material_id` | string | yes | Material code |
| `batch_id` | string | no | Batch number (null for non-batch-managed stock) |
| `hold_type` | string | yes | Hold classification — quality, blocked, or restricted |
| `quantity` | decimal | no | Quant total quantity |
| `uom` | string | no | Base unit of measure |
| `goods_receipt_date` | date | no | Goods receipt date (hold age basis) |
| `age_hours` | decimal | no | Query-time age in hours since goods receipt |

# Grain

one row per plant_id, warehouse_number, and quant under hold

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_open_holds`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_open_holds`
