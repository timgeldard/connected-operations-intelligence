---
type: Consumption View
title: "Plan Board Kpis"
description: "KPI strip for the Production Planning Board (PEX-E-36)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_plan_board
tags: [production, draft]
contract_id: wm_operations.plan_board_kpis
contract_version: "0.1.0"
---

# Plan Board Kpis

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `lines_running` | long | no | Distinct production lines with a running or at-risk order in the window |
| `today_qty_delivered` | double | no | Total delivered qty for orders with scheduled_finish on or before today |
| `at_risk_count` | long | no | Count of at-risk orders in the window |
| `shortage_count` | long | no | Count of orders with has_shortage = true |
| `backlog_count` | long | no | Count of backlog orders (is_backlog = true) |
| `on_time_pct` | double | no | On-time completion % — completed orders in last 48h where actual_finish <= scheduled_finish_date |

# Grain

one row per plant_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_plan_board`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_plan_board`
