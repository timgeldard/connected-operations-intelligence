---
type: Aggregate View
title: "Staging Pace"
description: "Hourly staged-in throughput (confirmed TO items into palletising/production-supply zones) — derived from TO flows pending bulk-drop log replication."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_staging_pace
tags: [warehouse, draft]
contract_id: wm_operations.staging_pace
contract_version: "0.1.0"
---

# Staging Pace

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `destination_zone` | string | yes |  |
| `activity_hour` | timestamp | yes |  |
| `items_staged` | long | no |  |
| `qty_staged` | double | no |  |
| `operators` | long | no |  |

# Grain

one row per plant_id, warehouse_id, destination_zone and activity_hour

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_staging_pace`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_staging_pace`
