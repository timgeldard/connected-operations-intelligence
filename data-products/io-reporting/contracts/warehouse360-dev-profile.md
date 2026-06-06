# Warehouse360 DEV Profile Evidence Log

This document records the results of the Serving views validation executed in the Databricks DEV environment (`connected_plant_dev`).

---

## 1. Execution Metadata
* **Executed By**: [Name/User]
* **Execution Date**: [YYYY-MM-DD]
* **Target Schema**: `connected_plant_dev.gold_io_reporting`

---

## 2. View Existence Verification
*Target Query: validation/warehouse360_dev_schema_validation.sql (Part 1)*

| Table Name | Type | Verified (Yes/No) |
|---|---|---|
| `vw_consumption_warehouse360_overview` | VIEW | |
| `vw_consumption_warehouse360_inbound_backlog` | VIEW | |
| `vw_consumption_warehouse360_outbound_backlog` | VIEW | |
| `vw_consumption_warehouse360_staging_workload` | VIEW | |
| `vw_consumption_warehouse360_stock_exceptions` | VIEW | |
| `vw_consumption_warehouse360_shortfalls` | VIEW | |
| `vw_consumption_warehouse360_im_wm_reconciliation` | VIEW | |

---

## 3. View Columns & Data Types Verification
*Target Query: validation/warehouse360_dev_schema_validation.sql (Part 2)*

*Paste or summarize view columns and types output here, verifying that no date/time fields remain as raw strings.*

```sql
-- Paste output of column check here
```

---

## 4. Key Uniqueness Verification
*Target Query: validation/warehouse360_dev_key_validation.sql*

| View Name | Total Rows | Distinct Key Count | Duplicate Key Count (Must be 0) |
|---|---|---|---|
| `vw_consumption_warehouse360_overview` | | | |
| `vw_consumption_warehouse360_inbound_backlog` | | | |
| `vw_consumption_warehouse360_outbound_backlog` | | | |
| `vw_consumption_warehouse360_staging_workload` | | | |
| `vw_consumption_warehouse360_stock_exceptions` | | | |
| `vw_consumption_warehouse360_shortfalls` | | | |
| `vw_consumption_warehouse360_im_wm_reconciliation` | | | |

---

## 5. Plant ID Nullability Verification
*Target Query: validation/warehouse360_dev_data_quality_validation.sql (Part 1)*

| View Name | Total Rows | Null plant_id Count (Must be 0) |
|---|---|---|
| `vw_consumption_warehouse360_overview` | | |
| `vw_consumption_warehouse360_inbound_backlog` | | |
| `vw_consumption_warehouse360_outbound_backlog` | | |
| `vw_consumption_warehouse360_staging_workload` | | |
| `vw_consumption_warehouse360_stock_exceptions` | | |
| `vw_consumption_warehouse360_shortfalls` | | |
| `vw_consumption_warehouse360_im_wm_reconciliation` | | |

---

## 6. Freshness Metadata Verification
*Target Query: validation/warehouse360_dev_data_quality_validation.sql (Part 3)*

| View Name | Latest Snapshot TS | Current Timestamp | Age (Minutes) | Warning Threshold (Mins) | Critical Threshold (Mins) |
|---|---|---|---|---|---|
| `vw_consumption_warehouse360_overview` | | | | 30 | 60 |

---

## 7. Sample Rows Capture
*Target Query: validation/warehouse360_dev_data_quality_validation.sql (Part 4)*

*Capture sample rows below (masking any sensitive business values if necessary).*

```text
-- Paste sample rows output here
```

---

## 8. Failures and Corrections Log
*Record any validation failures encountered (e.g. duplicate keys, missing columns, type mismatches) and the changes made to correct them.*

* **Failure Description**:
* **Resolution Action**:
* **Re-test Results**:
