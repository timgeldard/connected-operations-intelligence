---
type: Aggregate View
title: "Staging Readiness"
description: "Production staging readiness summary counts."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_staging_readiness
tags: [warehouse, draft]
contract_id: warehouse360.staging_readiness
contract_version: "0.1.0"
---

# Staging Readiness

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `plan_date` | date | yes | Planned staging start date |
| `total_orders` | long | yes | Total number of scheduled process orders |
| `fully_staged` | long | yes | Count of fully staged orders |
| `partially_staged` | long | yes | Count of partially staged orders |
| `not_staged` | long | yes | Count of not staged orders |
| `blocked` | long | yes | Count of orders in the red staging-risk band (staging_fraction and scheduled-start derived) — a staging-risk classification, NOT a QM/blocking-hold count (hold provenance is a documented data gap). |

# Grain

one row per plant_id and plan_date

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_staging_readiness`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_staging_readiness`
