---
type: Aggregate View
title: "Qm Ud Code Pareto"
description: "QM usage-decision code distribution Pareto."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_ud_code_pareto
tags: [warehouse, draft]
contract_id: wm_operations.qm_ud_code_pareto
contract_version: "0.1.0"
---

# Qm Ud Code Pareto

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes |  |
| `usage_decision_code` | string | yes |  |
| `usage_decision` | string | no | Accepted &#124; Rejected &#124; Other Decision |
| `usage_decision_valuation` | string | no | Raw QAVE VBEWERTUNG (A/R/blank) |
| `lot_count` | long | yes |  |
| `last_decision_date` | date | no |  |

# Grain

one row per plant_id and usage_decision_code

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_qm_ud_code_pareto`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_qm_ud_code_pareto`
