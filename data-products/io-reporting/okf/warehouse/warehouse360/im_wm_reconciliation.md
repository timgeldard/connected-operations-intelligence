---
type: Consumption View
title: "Im Wm Reconciliation"
description: "IM/WM stock discrepancies summarised per material and exception type (first-wave AGGREGATE contract — ADR-0004 D6)."
resource: connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation
tags: [warehouse, draft]
contract_id: warehouse360.im_wm_reconciliation
contract_version: "0.2.0"
---

# Im Wm Reconciliation

# Schema

| Column | Type | Required | Description |
| --- | --- | --- | --- |
| `plant_id` | string | yes | SAP plant ID |
| `material_id` | string | yes | Material code |
| `batch_id` | string | no | Batch number (null for non-batch-managed exceptions) |
| `exception_type` | string | yes | Type of discrepancy (e.g. IM_WM_TRUE_VARIANCE, NEGATIVE_WM_QUANT) |
| `exception_count` | long | yes | Number of source exception rows aggregated into this summary row |
| `qty` | decimal | no | Total discrepant stock quantity across the aggregated exceptions |
| `severity` | integer | no | Maximum exception severity rating across the aggregated exceptions |
| `max_age_days` | integer | no | Maximum exception age in days across the aggregated exceptions |
| `oldest_detected_date` | date | no | Earliest detection date across the aggregated exceptions. Currently the query-time evaluation date (no persisted first-seen date upstream) — equals latest_detected_date. |
| `latest_detected_date` | date | no | Most recent detection date across the aggregated exceptions. Currently the query-time evaluation date (no persisted first-seen date upstream). |
| `detail_text` | string | no | Representative context detail from the aggregated exceptions |

# Grain

one row per plant_id, material_id, batch_id, and exception type (aggregate exception summary)

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

Served via the governed `gold_io_reporting` layer as `vw_consumption_warehouse360_im_wm_reconciliation`.

Unity Catalog resource: `connected_plant_uat.gold_io_reporting.vw_consumption_warehouse360_im_wm_reconciliation`
