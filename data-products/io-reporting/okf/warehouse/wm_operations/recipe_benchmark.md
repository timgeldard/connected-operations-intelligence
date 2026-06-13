---
type: Aggregate View
title: "Recipe Benchmark"
description: "Recipe-line benchmark distribution for the Campaigns view."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recipe_benchmark
tags: [warehouse, draft]
contract_id: wm_operations.recipe_benchmark
contract_version: "0.1.0"
---

# Recipe Benchmark

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `material_id` | string | yes | Finished-good material code |
| `production_line` | string | yes | Production line used for benchmarking, with null source values grouped as UNASSIGNED |
| `run_count` | long | yes | Count of complete orders with goods receipt evidence in this recipe-line distribution |
| `median_yield_pct` | double | no | Median delivered/planned yield percentage across qualifying runs |
| `p10_yield_pct` | double | no | 10th percentile delivered/planned yield percentage across qualifying runs |
| `p90_yield_pct` | double | no | 90th percentile delivered/planned yield percentage across qualifying runs |
| `median_duration_hours` | double | no | Median goods-receipt duration in hours, excluding zero/negative or missing spans |
| `p10_duration_hours` | double | no | 10th percentile goods-receipt duration in hours |
| `p90_duration_hours` | double | no | 90th percentile goods-receipt duration in hours |
| `last_run_finish_date` | date | no | Latest goods receipt finish date contributing to this benchmark bucket |

# Grain

one row per plant_id, material_id, and production_line

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_wm_operations_recipe_benchmark`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_wm_operations_recipe_benchmark`
