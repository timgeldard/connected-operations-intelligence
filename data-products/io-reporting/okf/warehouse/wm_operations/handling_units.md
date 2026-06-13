---
type: Aggregate View
title: "Handling Units"
description: "Handling-unit (SSCC) counts by status for the inbound/putaway board."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_handling_units
tags: [warehouse, draft]
contract_id: wm_operations.handling_units
contract_version: "0.1.0"
---

# Handling Units

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `handling_unit_status` | string | yes |  |
| `reference_document_category` | string | yes |  |
| `hu_item_count` | long | no |  |
| `distinct_sscc_count` | long | no |  |
| `distinct_hu_count` | long | no |  |
| `linked_delivery_count` | long | no |  |
| `distinct_material_count` | long | no |  |
| `total_gross_weight` | double | no |  |

# Grain

one row per plant_id, warehouse_id, handling_unit_status and reference_document_category

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_handling_units`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_handling_units`
