---
type: Consumption View
title: "Lineside Lines"
description: "Distinct production lines with active order count — line picker for the Lineside Monitor config panel (PEX-E-35)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_lineside_lines
tags: [production, draft]
contract_id: wm_operations.lineside_lines
contract_version: "0.1.0"
---

# Lineside Lines

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `line_id` | string | yes | Production line code (CRVER via recipe_process_line classification) |
| `line_label` | string | yes | Human-readable line description; falls back to line_id when no description available |
| `active_order_count` | long | yes | Count of running orders (released, not closed, not finished) on this line right now |

# Grain

one row per plant_id and line_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_lineside_lines`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_lineside_lines`
