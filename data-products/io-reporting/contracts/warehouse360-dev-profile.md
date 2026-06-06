# Warehouse360 DEV Profile Evidence Log

This is an evidence capture template for the Warehouse360 DEV validation pack. No Databricks validation has been run as part of this offline preparation work.

Target environment:

| Field | Value |
|---|---|
| Catalog | `connected_plant_dev` |
| Schema | `gold_io_reporting` |
| Source mode | Governed IO reporting sources only |
| Legacy `wh360` dependency | Not allowed |
| Dispensary queue | Not deployed in Wave 1 |

## 1. Execution Metadata

| Field | Value |
|---|---|
| Executed by |  |
| Execution date/time |  |
| Databricks workspace |  |
| Git branch |  |
| Git commit SHA |  |

## 2. Source Object Validation

Target query: `validation/warehouse360_dev_source_object_validation.sql`

Expected result: every expected source object returns `FOUND`.

| Source Object | Validation Status | Notes |
|---|---|---|
| `gold_warehouse_kpi_snapshot_secured` | Not run |  |
| `gold_inbound_po_backlog_enhanced_live` | Not run |  |
| `gold_delivery_pick_status_live` | Not run |  |
| `gold_process_order_staging_live` | Not run |  |
| `gold_stock_expiry_risk_live` | Not run |  |
| `gold_transfer_requirement_backlog` | Not run |  |
| `gold_warehouse_exceptions` | Not run |  |

```text
Paste source object validation output here.
```

## 3. Source Column Validation

Target query: `validation/warehouse360_dev_source_column_validation.sql`

Expected result: every expected source column returns `FOUND`.

```text
Paste source column validation output here.
```

## 4. Consumption View Deployment

Target SQL: `resources/sql/warehouse360_consumption_views_dev.sql`

Expected result: all Wave 1 active views compile. `vw_consumption_warehouse360_dispensary_queue` remains not deployed.

```text
Paste execution status, statement errors, or notebook/job output here.
```

## 5. View Existence Verification

Target query: `validation/warehouse360_dev_schema_validation.sql`

| Table Name | Type | Verified |
|---|---|---|
| `vw_consumption_warehouse360_overview` | VIEW | Not run |
| `vw_consumption_warehouse360_inbound_backlog` | VIEW | Not run |
| `vw_consumption_warehouse360_outbound_backlog` | VIEW | Not run |
| `vw_consumption_warehouse360_staging_workload` | VIEW | Not run |
| `vw_consumption_warehouse360_stock_exceptions` | VIEW | Not run |
| `vw_consumption_warehouse360_shortfalls` | VIEW | Not run |
| `vw_consumption_warehouse360_im_wm_reconciliation` | VIEW | Not run |

## 6. View Columns and Data Types

Target query: `validation/warehouse360_dev_schema_validation.sql`

```text
Paste view column and type output here.
```

## 7. Key Uniqueness Verification

Target query: `validation/warehouse360_dev_key_validation.sql`

| View Name | Total Rows | Distinct Key Count | Duplicate Key Count |
|---|---|---|---|
| `vw_consumption_warehouse360_overview` |  |  | Not run |
| `vw_consumption_warehouse360_inbound_backlog` |  |  | Not run |
| `vw_consumption_warehouse360_outbound_backlog` |  |  | Not run |
| `vw_consumption_warehouse360_staging_workload` |  |  | Not run |
| `vw_consumption_warehouse360_stock_exceptions` |  |  | Not run |
| `vw_consumption_warehouse360_shortfalls` |  |  | Not run |
| `vw_consumption_warehouse360_im_wm_reconciliation` |  |  | Not run |

```text
Paste duplicate sample query output here for any view with duplicate_key_count > 0.
```

## 8. Required-Key Nullability Verification

Target query: `validation/warehouse360_dev_data_quality_validation.sql`

Expected result: `plant_id` and all candidate primary-key columns have zero nulls for plant-scoped records.

```text
Paste required-key null check output here.
```

## 9. Date, Time, and Freshness Findings

Target query: `validation/warehouse360_dev_data_quality_validation.sql`

| View Name | Finding | Decision |
|---|---|---|
| `vw_consumption_warehouse360_overview` | Not run |  |

```text
Paste date/time type and freshness output here.
```

## 10. Contract Compatibility

Target query: `validation/warehouse360_dev_contract_validation.sql`

```text
Paste contract compatibility output here.
```

## 11. Sample Rows Capture

Target query: `validation/warehouse360_dev_data_quality_validation.sql`

Capture non-sensitive samples only. Mask sensitive business values if necessary.

```text
Paste sample rows output here.
```

## 12. Failures and Corrections Log

| Failure Description | Severity | Resolution Action | Re-test Result |
|---|---|---|---|
|  |  |  |  |

## 13. Contract Status Recommendation

| Contract | Recommended Status | Rationale |
|---|---|---|
| `warehouse360.overview` |  |  |
| `warehouse360.inbound_backlog` |  |  |
| `warehouse360.outbound_backlog` |  |  |
| `warehouse360.staging_workload` |  |  |
| `warehouse360.stock_exceptions` |  |  |
| `warehouse360.shortfalls` |  |  |
| `warehouse360.im_wm_reconciliation` |  |  |
