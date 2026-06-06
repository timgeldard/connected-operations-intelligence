# Runbook: Warehouse360 DEV Offline-to-Live Validation

This runbook guides a Databricks-connected developer through deploying the Warehouse360 consumption views in DEV (`connected_plant_dev.gold_io_reporting`) and running live validation checks to verify schema compatibility, grain uniqueness, plant scoping, and basic data quality.

---

## 1. Purpose
Since the Warehouse360 migration has been prepared offline without direct Databricks connectivity, this runbook provides a step-by-step checklist to deploy Serving views, execute validation scripts, and record execution evidence to promote candidate contracts to validated draft status.

---

## 2. Preconditions
Before executing:
* [ ] You have access to the Databricks Workspace with credentials (e.g., standard DEFAULT profile configured).
* [ ] You have SELECT access to `connected_plant_dev.gold_io_reporting` base tables and serving/secured views.
* [ ] You have permissions to CREATE or REPLACE views in `connected_plant_dev.gold_io_reporting`.
* [ ] The base Gold pipeline has completed at least one successful run in DEV (so the underlying delta tables exist).

---

## 3. Files to Deploy and Validate
Locate the following SQL scripts in the repository under `data-products/io-reporting/`:
1. `resources/sql/warehouse360_consumption_views_dev.sql`
2. `validation/warehouse360_dev_schema_validation.sql`
3. `validation/warehouse360_dev_key_validation.sql`
4. `validation/warehouse360_dev_data_quality_validation.sql`
5. `validation/warehouse360_dev_contract_validation.sql`

---

## 4. SQL Execution Order

### Step 4.1: Deploy Consumption Views
Run the deployment SQL script to create the app-facing consumption views:
```bash
# Run view DDL
databricks labs sandbox run-sql --file resources/sql/warehouse360_consumption_views_dev.sql --profile DEFAULT
```

### Step 4.2: Execute Schema Validation
Run the schema validation queries to verify that all views exist and columns/types match.
```bash
databricks labs sandbox run-sql --file validation/warehouse360_dev_schema_validation.sql --profile DEFAULT
```

### Step 4.3: Execute Key Validation
Verify primary key uniqueness for each view (ensuring 0 duplicate keys are returned).
```bash
databricks labs sandbox run-sql --file validation/warehouse360_dev_key_validation.sql --profile DEFAULT
```

### Step 4.4: Execute Data Quality Checks
Check for null plant IDs, date/time string types, freshness, and sample non-sensitive rows.
```bash
databricks labs sandbox run-sql --file validation/warehouse360_dev_data_quality_validation.sql --profile DEFAULT
```

### Step 4.5: Execute Contract Compatibility Checks
Print the schema structure to compare against contract fields.
```bash
databricks labs sandbox run-sql --file validation/warehouse360_dev_contract_validation.sql --profile DEFAULT
```

---

## 5. Expected Objects
The following Serving views are expected in `connected_plant_dev.gold_io_reporting`:
* `vw_consumption_warehouse360_overview` (Wraps `gold_warehouse_kpi_snapshot_secured`)
* `vw_consumption_warehouse360_inbound_backlog` (Wraps `gold_inbound_po_backlog_enhanced_live`)
* `vw_consumption_warehouse360_outbound_backlog` (Wraps `gold_delivery_pick_status_live`)
* `vw_consumption_warehouse360_staging_workload` (Wraps `gold_process_order_staging_live`)
* `vw_consumption_warehouse360_stock_exceptions` (Wraps `gold_stock_expiry_risk_live`)
* `vw_consumption_warehouse360_shortfalls` (Wraps `gold_transfer_requirement_backlog`)
* `vw_consumption_warehouse360_im_wm_reconciliation` (Wraps `gold_warehouse_exceptions`)

*Note: `vw_consumption_warehouse360_dispensary_queue` is currently not deployed (commented out in Wave 1).*

---

## 6. Evidence to Capture
For each of the validation steps, capture the query results in tabular format or stdout text. You must populate the template at:
`data-products/io-reporting/contracts/warehouse360-dev-profile.md`

Items to capture:
1. View existence confirmation.
2. Duplicate row count for each view's PK (must be 0).
3. Null `plant_id` counts (must be 0 for plant-scoped views).
4. Timestamp type compatibility.
5. Max freshness age in minutes.
6. Sample rows (first 5).

---

## 7. Recording Results Back into the Repo
Once the validation has completed:
1. Paste the captured outputs directly into the `warehouse360-dev-profile.md` file.
2. Commit the updated profile markdown file to the repository.
3. If errors or schema deviations were found, fix the view definitions or update the manifest contract, and re-run this runbook until validation succeeds.

---

## 8. Failure Handling
* **Missing Tables**: If the source table does not exist, verify that the DLT pipelines have successfully completed their update.
* **Duplicate Keys**: If duplicate keys are found on a view, verify if the grain assumption has shifted (e.g. additional key fields required) and report to the data contract owner.
* **Null plant_id**: Views must not return null plant IDs as they are used for row-level security. Verify the join logic in the underlying gold Serving view.

---

## 9. Sign-off Checklist
* [ ] Views deployed to `connected_plant_dev.gold_io_reporting`.
* [ ] No `gold_dev` references remain in Serving views DDL.
* [ ] Schema validated.
* [ ] Primary key uniqueness verified.
* [ ] `plant_id` nullability check passed (0 nulls).
* [ ] Freshness metadata captured.
* [ ] Evidence committed to `warehouse360-dev-profile.md`.
