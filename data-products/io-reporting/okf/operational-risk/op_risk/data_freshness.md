---
type: Consumption View
title: "Data Freshness"
description: "Per-canonical-domain data freshness watermarks with query-time age and status classification (fresh/warning/critical/no_data)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_data_freshness
tags: [operational-risk, draft]
contract_id: op_risk.data_freshness
contract_version: "0.1.0"
---

# Data Freshness

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `domain` | string | yes | Canonical domain key (warehouse_tr_to / process_orders / quality / etc.) |
| `last_refresh_at` | timestamp | no | Minimum latest_replicated_at across all Silver contracts in the domain |
| `source_table_count` | long | no | Number of Silver tables contributing to this domain |
| `warning_minutes` | integer | yes | Warning freshness threshold in minutes |
| `critical_minutes` | integer | yes | Critical freshness threshold in minutes |
| `age_minutes` | long | no | Minutes since last_refresh_at (query-time) |
| `status` | string | yes | fresh &#124; warning &#124; critical &#124; no_data (query-time) |

# Grain

one row per domain

# Freshness

| SLA tier | Minutes |
| --- | --- |
| Expected | 60 |
| Warning | 120 |
| Critical | 480 |

# Access

Row-level security key: `None`

Entitlement source: `None`

# Source

Served via the governed `gold_io_reporting` layer as `vw_consumption_data_freshness`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_data_freshness`
