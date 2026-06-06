# Warehouse360 DEV Execution Pack

This runbook is the handoff package for a Databricks-connected executor to validate the Warehouse360 DEV consumption views. It was prepared offline and does not claim that Databricks validation has passed.

## Purpose

Validate that Warehouse360 Wave 1 app and dashboard consumption views can be deployed and evidenced in:

```text
connected_plant_dev.gold_io_reporting
```

## What This Validates

- Governed source objects exist before consumption views are deployed.
- Critical source columns used by the DEV view SQL exist.
- Active `vw_consumption_warehouse360_*` views compile.
- Active view schemas are visible in Unity Catalog information schema.
- Candidate primary keys are unique or duplicate examples are captured.
- `plant_id` and other required candidate-key columns are not null.
- Date/time typing and available freshness metadata are documented.
- Contract compatibility output is captured for review.

## What This Does Not Validate

- Production readiness.
- UAT deployment readiness.
- Business acceptance of candidate grains.
- Legacy `wh360` compatibility.
- Dispensary queue runtime readiness.
- Any non-Warehouse360 data product.

## Preconditions

- You have Databricks access to the DEV workspace.
- You can run SQL against `connected_plant_dev.gold_io_reporting`.
- You are validating the exact branch and commit that contains this execution pack.
- `connected_plant_dev.sap` is expected to match `connected_plant_uat.sap` in table/schema structure, but this pack validates governed gold IO reporting objects, not raw SAP objects.

## Files To Run

| Order | File | Purpose |
|---|---|---|
| 1 | `data-products/io-reporting/validation/warehouse360_dev_source_object_validation.sql` | Check expected internal source objects. |
| 2 | `data-products/io-reporting/validation/warehouse360_dev_source_column_validation.sql` | Check critical source columns. |
| 3 | `data-products/io-reporting/resources/sql/warehouse360_consumption_views_dev.sql` | Deploy Wave 1 consumption views. |
| 4 | `data-products/io-reporting/validation/warehouse360_dev_schema_validation.sql` | Confirm deployed view existence and columns. |
| 5 | `data-products/io-reporting/validation/warehouse360_dev_key_validation.sql` | Validate candidate key uniqueness and capture duplicate examples. |
| 6 | `data-products/io-reporting/validation/warehouse360_dev_data_quality_validation.sql` | Validate required-key nullability, date/time typing, freshness, and samples. |
| 7 | `data-products/io-reporting/validation/warehouse360_dev_contract_validation.sql` | Capture contract compatibility evidence. |

## Execution Order

1. Confirm branch, commit SHA, executor, date/time, workspace, catalog, and schema.
2. Run `warehouse360_dev_source_object_validation.sql`.
3. Stop if any required source object is `MISSING`.
4. Run `warehouse360_dev_source_column_validation.sql`.
5. Stop if any required source column is `MISSING`, unless the exception is explicitly documented and accepted.
6. Run `warehouse360_consumption_views_dev.sql`.
7. Confirm these active views compile:
   - `vw_consumption_warehouse360_overview`
   - `vw_consumption_warehouse360_inbound_backlog`
   - `vw_consumption_warehouse360_outbound_backlog`
   - `vw_consumption_warehouse360_staging_workload`
   - `vw_consumption_warehouse360_stock_exceptions`
   - `vw_consumption_warehouse360_shortfalls`
   - `vw_consumption_warehouse360_im_wm_reconciliation`
8. Confirm `vw_consumption_warehouse360_dispensary_queue` remains not deployed in Wave 1.
9. Run `warehouse360_dev_schema_validation.sql`.
10. Run `warehouse360_dev_key_validation.sql`.
11. Run `warehouse360_dev_data_quality_validation.sql`.
12. Run `warehouse360_dev_contract_validation.sql`.
13. Paste outputs into `data-products/io-reporting/contracts/warehouse360-dev-profile.md`.
14. Complete `data-products/io-reporting/contracts/warehouse360-dev-validation-summary-template.md`.
15. Raise an evidence PR or correction PR.

## Evidence Capture Instructions

Update:

```text
data-products/io-reporting/contracts/warehouse360-dev-profile.md
data-products/io-reporting/contracts/warehouse360-dev-validation-summary-template.md
```

Capture:

- Source object `FOUND` / `MISSING` statuses.
- Source column `FOUND` / `MISSING` statuses.
- View deployment success or errors.
- Schema validation outputs.
- Duplicate key counts.
- Duplicate sample rows for any failing key check.
- `plant_id` and required-key null counts.
- Date/time type findings.
- Overview freshness output.
- Non-sensitive sample rows.
- Contract compatibility output.
- Required contract status decisions.

## Expected Failure Modes

| Failure | Handling |
|---|---|
| Source object missing | Stop. Do not create a fake replacement or point back to legacy `wh360`. Record whether the object name or upstream deployment is wrong. |
| Source column missing | Stop or continue only with a documented non-critical exception. Do not silently remove contract fields. |
| Consumption view compile failure | Record the failing statement and error. Update source expectations or view SQL in a correction PR. |
| Duplicate candidate keys | Do not promote the affected contract. Capture duplicate samples and request a grain decision. |
| Null `plant_id` | Treat as a plant-scope security blocker. Do not expose the affected view to app/dashboard users. |
| Null required key column | Treat as a contract blocker unless the key definition is changed and accepted. |
| String date fields | Document as technical debt. Prefer typed `DATE` or `TIMESTAMP` before UAT promotion. |
| Freshness unavailable | Document the missing freshness signal or accepted exception. |

## Evidence PR Instructions

Recommended PR title:

```text
evidence(wh360): capture DEV validation results for governed Warehouse360 views
```

Include only evidence updates unless validation revealed required corrections. If corrections are needed, update the affected SQL/contracts and include the before/after evidence.

Expected files:

```text
data-products/io-reporting/contracts/warehouse360-dev-profile.md
data-products/io-reporting/contracts/warehouse360-dev-validation-summary-template.md
data-products/io-reporting/contracts/warehouse360_view_expectations.yml
data-products/io-reporting/resources/sql/warehouse360_consumption_views_dev.sql
data-products/io-reporting/contracts/app_contract_manifest.yml
```

Only touch SQL or manifest files when validation evidence requires a correction.

## Sign-Off Checklist

- [ ] Branch and commit SHA recorded.
- [ ] Source object validation complete.
- [ ] Source column validation complete.
- [ ] Active consumption views deployed or failures recorded.
- [ ] Dispensary queue confirmed not deployed in Wave 1.
- [ ] Schema validation output captured.
- [ ] Candidate key duplicate counts captured.
- [ ] Duplicate samples captured for any failing key check.
- [ ] Required-key null counts captured.
- [ ] Date/time type findings captured.
- [ ] Freshness findings captured.
- [ ] Contract compatibility findings captured.
- [ ] Blocking issues and owners recorded.
- [ ] Contract promotion recommendations documented without over-claiming readiness.
