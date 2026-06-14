---
type: Consumption View
title: "Risk Item"
description: "Operational risk items — live UNION of domain arms (production, warehouse, quality, logistics, data_trust) with query-time effective_severity and time_horizon."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_op_risk_operational_risk_live
tags: [operational-risk, draft]
contract_id: op_risk.risk_item
contract_version: "0.1.0"
---

# Risk Item

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `risk_id` | string | yes | SHA-256 deterministic risk item identifier |
| `risk_domain` | string | yes | production &#124; warehouse &#124; quality &#124; logistics &#124; data_trust |
| `plant_code` | string | no | SAP plant code (null for data_trust items) |
| `process_line` | string | no | Production line identifier |
| `order_number` | string | no | Process order number (AUFNR) |
| `material_code` | string | no | Material code |
| `batch_number` | string | no | Batch number |
| `delivery_number` | string | no | Delivery number |
| `customer_id` | string | no | Ship-to customer |
| `planned_event_at` | timestamp | no | Planned deadline timestamp (scheduled start, GI date, lot creation) |
| `current_status` | string | no | OPEN &#124; CLOSED |
| `primary_reason_code` | string | yes | Primary risk reason code from risk_reason_taxonomy |
| `secondary_reason_codes` | array<string> | no | Additional contributing reason codes |
| `responsible_function` | string | no | Function accountable for resolution |
| `evidence_confidence` | string | yes | High &#124; Medium &#124; Low &#124; Unknown (Unknown = missing evidence linkage) |
| `base_severity` | string | yes | Critical &#124; High &#124; Medium &#124; Low &#124; Unknown (evidence-only, deterministic) |
| `minutes_to_event` | long | no | Minutes until planned_event_at (negative = overdue; query-time) |
| `time_horizon` | string | no | overdue &#124; imminent &#124; today &#124; upcoming &#124; future &#124; unknown (query-time) |
| `effective_severity` | string | no | Escalated severity when overdue (query-time) |
| `stock_qty_affected` | double | no | Quantity of stock affected |
| `orders_affected` | long | no | Number of orders affected |
| `deliveries_affected` | long | no | Number of deliveries affected |
| `customer_impact_flag` | boolean | yes | True when the risk item has direct customer delivery impact |
| `food_safety_flag` | boolean | yes | True when the risk item has food safety relevance |

# Grain

one row per risk_id (SHA-256 of domain + plant + key fields + primary_reason_code)

# Freshness

| SLA tier | Minutes |
| --- | --- |
| Expected | 60 |
| Warning | 120 |
| Critical | 480 |

# Access

Row-level security key: `plant_code`

Entitlement source: `published.central_services.user_plant_access`

# Source

Served via the governed `gold_io_reporting` layer as `vw_consumption_op_risk_operational_risk_live`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_op_risk_operational_risk_live`
