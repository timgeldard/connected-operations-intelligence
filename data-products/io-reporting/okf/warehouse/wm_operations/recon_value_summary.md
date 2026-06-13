---
type: Aggregate View
title: "Recon Value Summary"
description: "Value-control rollup of reconciliation exceptions by reason and severity."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recon_value_summary
tags: [warehouse, draft]
contract_id: wm_operations.recon_value_summary
contract_version: "0.1.0"
---

# Recon Value Summary

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `mismatch_reason` | string | yes |  |
| `mismatch_severity` | string | yes |  |
| `row_count` | long | no |  |
| `tolerance_exceeded_count` | long | no |  |
| `net_delta_value` | double | no |  |
| `abs_delta_value` | double | no |  |
| `abs_delta_quantity` | double | no |  |
| `value_reconciliation_status` | string | no |  |

# Grain

one row per plant_id, warehouse_id, mismatch_reason and mismatch_severity

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_recon_value_summary`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recon_value_summary`
