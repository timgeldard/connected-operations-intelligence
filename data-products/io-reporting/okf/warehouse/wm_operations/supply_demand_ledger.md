---
type: Consumption View
title: "Supply Demand Ledger"
description: "Dated supply/demand ledger per plant×material for shortage projection arithmetic."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_supply_demand_ledger
tags: [warehouse, draft]
contract_id: wm_operations.supply_demand_ledger
contract_version: "0.1.0"
---

# Supply Demand Ledger

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `material_id` | string | yes |  |
| `material_name` | string | no |  |
| `event_type` | string | yes | SUPPLY or DEMAND |
| `event_subtype` | string | yes | ON_HAND &#124; INBOUND_DELIVERY &#124; RESERVATION |
| `event_date` | date | no | Null for current on-hand snapshot row |
| `quantity` | double | yes | Absolute event quantity in base UOM |
| `signed_qty` | double | yes | Positive for supply, negative for demand |
| `balance_before` | double | yes | Running balance immediately before this event |
| `running_balance` | double | yes | Cumulative balance after this event |
| `source_document_id` | string | yes |  |
| `order_id` | string | no | Process order for DEMAND events |
| `sort_seq` | integer | yes | Tiebreaker ordering within event_date |
| `uom` | string | no |  |

# Grain

one row per plant_id, material_id, and ledger event

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_supply_demand_ledger`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_supply_demand_ledger`
