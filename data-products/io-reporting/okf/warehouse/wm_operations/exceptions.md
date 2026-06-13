---
type: Consumption View
title: "Exceptions"
description: "Aged warehouse exceptions (expired-with-stock, aged QI/blocked, aged open TOs)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_exceptions
tags: [warehouse, draft]
contract_id: wm_operations.exceptions
contract_version: "0.1.0"
---

# Exceptions

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | no |  |
| `exception_type` | string | yes |  |
| `severity` | string | no |  |
| `sla_hours` | long | no |  |
| `material_id` | string | no |  |
| `batch_id` | string | no |  |
| `reference_id` | string | yes |  |
| `qty` | double | no |  |
| `aging_reference_date` | date | no |  |
| `age_days` | long | no |  |
| `detail` | string | no |  |

# Grain

one row per confirmed exception

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_exceptions`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_exceptions`
