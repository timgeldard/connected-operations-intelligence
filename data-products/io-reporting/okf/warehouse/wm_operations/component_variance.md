---
type: Consumption View
title: "Component Variance"
description: "Order + material grain material variance for the Yield & Loss waterfall."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_component_variance
tags: [warehouse, draft]
contract_id: wm_operations.component_variance
contract_version: "0.2.0"
---

# Component Variance

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `order_id` | string | yes | Process order number (AUFNR) |
| `material_id` | string | yes | Component material code |
| `material_name` | string | no | Component material description |
| `uom` | string | no | Base unit of measure for quantities in this row |
| `movement_type_code` | string | no | SAP movement type code (261 = goods issue for production; 261X = batch-where variant) |
| `required_qty` | double | yes | Required component quantity aggregated from reservation_requirement (RESB) at order+material grain |
| `withdrawn_qty` | double | no | Withdrawn quantity from reservations (RESB ENMNG — already-issued signal from planning) |
| `issued_qty` | double | no | Net issued quantity from goods movements (261 minus 262 reversals) against this order+material |
| `variance_qty` | double | no | issued_qty minus required_qty (positive = over-issue / loss; negative = under-issue) |
| `variance_pct` | double | no | variance_qty / required_qty (null when required_qty is zero; positive = over-issued fraction) |
| `est_loss_value` | double | no | Estimated over-issue value = MAX(variance_qty, 0) × standard_price / price_unit (null when no standard_price available from material_valuation) |
| `standard_price` | double | no | Standard price per price_unit from material_valuation (MBEW STPRS) |
| `is_final_issue` | boolean | no | True when the reservation carries the final-issue flag (RESB KZEAR) |

# Grain

one row per plant_id, order_id, and material_id

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_component_variance`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_component_variance`
