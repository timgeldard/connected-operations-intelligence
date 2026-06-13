---
type: Consumption View
title: "Qm Lots"
description: "Quality inspection-lot context per material and batch (open lots, latest usage decision) for held-stock and inbound enrichment."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_lots
tags: [warehouse, draft]
contract_id: wm_operations.qm_lots
contract_version: "0.1.0"
---

# Qm Lots

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `material_id` | string | yes |  |
| `batch_id` | string | no |  |
| `lot_count` | long | no |  |
| `open_lot_count` | long | no |  |
| `latest_lot_number` | string | no |  |
| `lot_origin_code` | string | no |  |
| `oldest_open_start_date` | date | no |  |
| `last_usage_decision` | string | no |  |
| `last_usage_decision_date` | string | no |  |

# Grain

one row per plant_id, material_id and batch_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_qm_lots`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_lots`
