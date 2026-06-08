# Runbook: Warehouse360 DEV Consumption View Validation

This runbook guides engineers through deploying and performing live validation checks on the Warehouse360 consumption views in the DEV environment using generated validation SQL queries.

---

## 1. Preconditions
Before executing the validation, ensure the following milestones are met:
* [ ] **PR #31** is merged (duplicate Gold DLT dataset definitions fixed).
* [ ] **PR #32** is merged (DEV Gold successfully compiles/runs, and the catalog contains Gold objects).
* [ ] **PR #33** is merged (secured/live generation boundaries fixed, `_secured` views are RLS pass-throughs).
* [ ] **PR #34** is merged (static consumption-view alignment and static checks in place).
* [ ] **PR #36** is merged or pending (static CI guardrails for duplicate DLT datasets and secured/live SQL ownership). Recommended before repeated validation cycles.
* [ ] You have target-level access to the DEV catalog (`connected_plant_dev.gold_io_reporting`).

> [!WARNING]
> This runbook is specific to the DEV environment and does **not** prove UAT or PROD readiness.

---

## 2. SQL Execution Sequence
To validate the consumption views in DEV, execute the following SQL scripts in the exact order below.

Use the workspace-approved SQL execution method:
* Databricks SQL editor
* Databricks CLI or approved run-sql wrapper (e.g. `databricks labs sandbox run-sql --file <path> --profile DEFAULT`)
* Databricks notebook attached to the appropriate SQL warehouse

Do not manually modify the SQL scripts before execution.

### Execution steps:

1. **Deploy Security Views**:
   Deploy: `data-products/io-reporting/resources/sql/gold_security_dev.sql`
2. **Deploy Serving Views**:
   Deploy: `data-products/io-reporting/resources/sql/gold_serving_views_dev.sql`
3. **Deploy Consumption Views**:
   Deploy: `data-products/io-reporting/resources/sql/warehouse360_consumption_views_dev.sql`
4. **Run Validation SQL**:
   Execute the read-only contract validation script:
   * **Generated (Recommended)**: `data-products/io-reporting/validation/generated/warehouse360_contract_validation_dev.sql`
   * **Legacy / Static Reference**: `data-products/io-reporting/validation/warehouse360_dev_contract_validation.sql` (Use if the validation generator PR is not yet merged/active)

---

## 3. Evidence to Capture
During and after the execution of step 4, record the following evidence:
* [ ] DDL and query execution output/script completion logs.
* [ ] Confirmation of created consumption views in catalog.
* [ ] Output of the `DESCRIBE TABLE` queries.
* [ ] Table row counts.
* [ ] `plant_id` null counts (must be 0).
* [ ] Duplicate primary key counts (must be 0).
* [ ] Freshness timestamp outputs (where available).
* [ ] Exact error traces if any view fails deployment or query.

---

## 4. Operational Guardrails (What NOT to Do)
* **Do NOT** switch the application runtime source mode (`WAREHOUSE360_SOURCE_MODE`).
* **Do NOT** remove legacy `wh360` paths or schemas.
* **Do NOT** promote contracts or claim lifecycle upgrades based on DEV outcomes.
* **Do NOT** claim UAT or PROD readiness from DEV validation.
* **Do NOT** manually edit Databricks objects or views outside the approved SQL sequence list.

---

## 5. Expected Result Format

Capture validation outcomes in the following table format:

| View | Created? | Row count | Null plant_id | Duplicate PK rows | Freshness max | Issues |
|---|---:|---:|---:|---:|---|---|
| vw_consumption_warehouse360_overview | TBD | TBD | TBD | TBD | TBD | TBD |
| vw_consumption_warehouse360_inbound_backlog | TBD | TBD | TBD | TBD | n/a | TBD |
| vw_consumption_warehouse360_outbound_backlog | TBD | TBD | TBD | TBD | n/a | TBD |
| vw_consumption_warehouse360_staging_workload | TBD | TBD | TBD | TBD | n/a | TBD |
| vw_consumption_warehouse360_stock_exceptions | TBD | TBD | TBD | TBD | n/a | TBD |
| vw_consumption_warehouse360_shortfalls | TBD | TBD | TBD | TBD | n/a | TBD |
| vw_consumption_warehouse360_im_wm_reconciliation | TBD | TBD | TBD | TBD | n/a | TBD |

---

## 6. Scope of Validation

This runbook proves only DEV technical validity.

It does not prove:
* UAT readiness
* Production readiness
* Application cutover readiness
* Business correctness
* Entitlement/RLS correctness unless tested with representative identities
