---
type: Consumption View
title: "Push Despatch Delivery"
description: "Push Despatch outbound delivery grain (WMA-E-23, Spec 14)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_push_despatch_delivery
tags: [warehouse, draft]
contract_id: wm_operations.push_despatch_delivery
contract_version: "0.1.0"
---

# Push Despatch Delivery

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant code — shipping (source) plant; canonical axis for Push Despatch |
| `delivery_id` | string | yes | SAP outbound delivery number (LIKP VBELN, zero-stripped) |
| `destination_customer` | string | no | Ship-to customer code (LIKP KUNNR, zero-stripped). Receiving party for ZPUS deliveries (sales-order-referenced) |
| `destination_plant_code` | string | no | Destination plant — NULL in v1; no customer→plant mapping available without additional reference data |
| `container_vehicle_id` | string | no | Vehicle/container identification (LIKP TRAID); 28,634 / 28,760 ZPUS deliveries populated in UAT |
| `transport_type` | string | no | Means of transport code (LIKP TRATY) |
| `planned_goods_issue_date` | date | no | Planned goods issue date (LIKP WADAT) |
| `actual_goods_issue_date` | date | no | Actual goods issue date (LIKP WADAT_IST); null when PGI not yet posted |
| `is_pgi_complete` | boolean | yes | True when actual_goods_issue_date is not null (PGI posted) |
| `pgi_on_time` | boolean | yes | True when PGI complete AND actual_goods_issue_date <= planned_goods_issue_date; deterministic (historical dates, no wall-clock) |
| `line_count` | long | yes | Count of delivery item lines; always populated |
| `pallet_count` | long | no | Distinct handling unit count per delivery; nullable — populated when silver.handling_unit table exists, else NULL (ZPUSH_DISPATCH not replicated — see docs/ingestion_requests.md) |
| `weight_unit` | string | no | Weight unit of measure (item-grain GEWEI); grain key — do not sum across mixed units |
| `total_net_weight` | double | no | Sum of item net weights (NTGEW) in weight_unit; double (not long — weight truncation) |
| `total_gross_weight` | double | no | Sum of item gross weights (BRGEW) in weight_unit; double |
| `is_overdue` | boolean | no | Query-time overdue flag — is_pgi_complete=false AND planned_goods_issue_date < CURRENT_DATE(); computed in consumption view |
| `days_overdue` | integer | no | Days since planned_goods_issue_date (query-time DATEDIFF); null when PGI complete or no planned date |

# Grain

one row per delivery_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_push_despatch_delivery`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_push_despatch_delivery`
