---
type: Consumption View
title: "Physical Inventory"
description: "Physical inventory count-vs-book detail (counts due, recounts, unposted differences)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_physical_inventory
tags: [warehouse, draft]
contract_id: wm_operations.physical_inventory
contract_version: "0.1.0"
---

# Physical Inventory

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `pi_document_id` | string | yes |  |
| `fiscal_year` | string | yes |  |
| `item_number` | string | yes |  |
| `storage_location_id` | string | no |  |
| `material_id` | string | no |  |
| `batch_id` | string | no |  |
| `planned_count_date` | date | no |  |
| `count_date` | date | no |  |
| `book_qty` | double | no |  |
| `counted_qty` | double | no |  |
| `delta_qty` | double | no |  |
| `delta_value` | double | no |  |
| `is_counted` | boolean | no |  |
| `is_recount_required` | boolean | no |  |
| `is_difference_posted` | boolean | no |  |
| `physical_inventory_status` | string | no |  |

# Grain

one row per plant_id, pi_document_id, fiscal_year and item_number

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_physical_inventory`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_physical_inventory`
