---
type: Consumption View
title: "Recon Alerts"
description: "Severe reconciliation alerts (IM-WM stock, HU, physical inventory) for the shift-handover digest."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recon_alerts
tags: [warehouse, draft]
contract_id: wm_operations.recon_alerts
contract_version: "0.1.0"
---

# Recon Alerts

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | no |  |
| `alert_key` | string | yes |  |
| `alert_type` | string | yes |  |
| `alert_priority` | string | no |  |
| `material_id` | string | no |  |
| `batch_id` | string | no |  |
| `reason_code` | string | no |  |
| `delta_qty` | double | no |  |
| `delta_value` | double | no |  |

# Grain

one row per alert_key

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_recon_alerts`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recon_alerts`
