---
type: Aggregate View
title: "Qm Characteristic Pareto"
description: "QM characteristic (MIC) Pareto for the Command Centre drill view."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_characteristic_pareto
tags: [warehouse, draft]
contract_id: wm_operations.qm_characteristic_pareto
contract_version: "0.1.0"
---

# Qm Characteristic Pareto

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `material_id` | string | yes |  |
| `characteristic_id` | string | yes |  |
| `characteristic_text` | string | no |  |
| `unit` | string | no |  |
| `result_count` | long | yes |  |
| `fail_count` | long | yes |  |
| `warn_count` | long | yes |  |
| `fail_rate` | double | no |  |
| `last_result_date` | date | no | Latest result recording date for this plant×material (freshness signal) |

# Grain

one row per plant_id, material_id, and characteristic_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_qm_characteristic_pareto`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_characteristic_pareto`
