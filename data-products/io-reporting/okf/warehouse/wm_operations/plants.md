---
type: Aggregate View
title: "Plants"
description: "Onboarded WM Operations plants — one row per plant_id and warehouse_id, derived from vw_consumption_wm_operations_worklist_summary (RLS inherited)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_plants
tags: [warehouse, draft]
contract_id: wm_operations.plants
contract_version: "0.1.0"
---

# Plants

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `warehouse_id` | string | yes | SAP warehouse number (LGNUM) |
| `worklist_tr_count` | long | no | Total transfer requirements in the worklist summary (activity indicator) |

# Grain

one row per plant_id and warehouse_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_plants`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_plants`
