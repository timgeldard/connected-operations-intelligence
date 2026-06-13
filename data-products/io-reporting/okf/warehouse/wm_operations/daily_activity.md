---
type: Aggregate View
title: "Daily Activity"
description: "Daily warehouse activity series (TO confirmations, TRs created, IM receipts/issues) for trend charts."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_daily_activity
tags: [warehouse, draft]
contract_id: wm_operations.daily_activity
contract_version: "0.1.0"
---

# Daily Activity

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `activity_date` | date | yes |  |
| `to_items_confirmed` | long | no |  |
| `active_operators` | long | no |  |
| `trs_created` | long | no |  |
| `goods_receipt_lines` | long | no |  |
| `goods_issue_lines` | long | no |  |

# Grain

one row per plant_id and activity_date

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_daily_activity`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_daily_activity`
