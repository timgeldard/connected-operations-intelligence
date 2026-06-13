---
type: Consumption View
title: "Recon Exceptions"
description: "IM-WM stock reconciliation exceptions at batch/category grain (workbench detail)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recon_exceptions
tags: [warehouse, draft]
contract_id: wm_operations.recon_exceptions
contract_version: "0.1.0"
---

# Recon Exceptions

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `material_id` | string | yes |  |
| `material_name` | string | no |  |
| `batch_id` | string | no |  |
| `stock_category` | string | yes |  |
| `uom` | string | no |  |
| `im_qty` | double | no |  |
| `wm_qty` | double | no |  |
| `delta_qty` | double | no |  |
| `delta_percent` | double | no |  |
| `delta_value` | double | no |  |
| `mismatch_reason` | string | yes |  |
| `mismatch_severity` | string | no |  |
| `is_trusted` | boolean | no |  |

# Grain

one row per plant_id, warehouse_id, material_id, batch_id and stock_category

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_recon_exceptions`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recon_exceptions`
