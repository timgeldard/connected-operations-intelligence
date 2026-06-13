---
type: Aggregate View
title: "Campaigns"
description: "Campaign-grouped picking progress (LTBK ZZ_CAMPAIGN)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_campaigns
tags: [warehouse, draft]
contract_id: wm_operations.campaigns
contract_version: "0.1.0"
---

# Campaigns

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `warehouse_id` | string | yes |  |
| `campaign_id` | string | yes |  |
| `tr_count` | long | no |  |
| `complete_trs` | long | no |  |
| `in_progress_trs` | long | no |  |
| `parked_trs` | long | no |  |
| `no_stock_trs` | long | no |  |
| `order_count` | long | no |  |
| `operator_count` | long | no |  |
| `work_area` | string | no |  |
| `required_qty` | double | no |  |
| `open_qty` | double | no |  |
| `earliest_planned_ts` | timestamp | no |  |
| `earliest_created_ts` | timestamp | no |  |

# Grain

one row per plant_id, warehouse_id and campaign_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_campaigns`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_campaigns`
