---
type: Consumption View
title: "Bin Stock"
description: "Quant-grain stock & bin explorer with storage-zone classification (dispensary / production supply / palletising / interim / warehouse), stock category, block flags and expiry."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_bin_stock
tags: [warehouse, draft]
contract_id: wm_operations.bin_stock
contract_version: "0.1.0"
---

# Bin Stock

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_id` | string | yes | SAP warehouse number (LGNUM) |
| `storage_type` | string | no | WM storage type (LGTYP) |
| `storage_zone` | string | no | DISPENSARY &#124; PRODUCTION_SUPPLY &#124; PALLETISING &#124; INTERIM &#124; WAREHOUSE |
| `bin_id` | string | no | Storage bin (LGPLA) |
| `picking_area` | string | no | Picking area (KOBER) |
| `quant_id` | string | yes | Quant number (LQNUM) |
| `material_id` | string | no | Material |
| `material_name` | string | no | Material description |
| `batch_id` | string | no | Batch (CHARG, exact SAP identifier) |
| `stock_category` | string | no | UNRESTRICTED &#124; QUALITY &#124; BLOCKED &#124; OTHER (from BESTQ) |
| `total_qty` | double | no | Total quant quantity (GESME) |
| `available_qty` | double | no | Available quantity (VERME) |
| `putaway_qty` | double | no | Open putaway quantity (EINME) |
| `pick_qty` | double | no | Open pick quantity (AUSME) |
| `open_transfer_qty` | double | no | Open transfer quantity (TRAME) |
| `uom` | string | no | Base unit of measure |
| `goods_receipt_date` | date | no | Goods receipt date (WDATU) |
| `expiry_date` | date | no | Shelf-life expiry date (VFDAT) |
| `last_movement_ts` | timestamp | no | Last movement timestamp |
| `is_blocked_for_stock_removal` | boolean | no | Quant blocked for stock removal (SKZUA) |
| `is_blocked_for_putaway` | boolean | no | Quant blocked for putaway (SKZUE) |
| `is_bin_blocked` | boolean | no | Bin carries a blocking reason (SPGRU) |
| `blocking_reason_code` | string | no | Bin blocking reason code |
| `days_to_expiry` | long | no | Days until expiry (query-time, _live view) |
| `is_expired` | boolean | no | Expiry date in the past (query-time) |

# Grain

one row per plant_id, warehouse_id and quant

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_bin_stock`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_bin_stock`
