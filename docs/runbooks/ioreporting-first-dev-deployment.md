# Runbook: IOReporting first DEV deployment (bootstrap baseline)

First-ever deployment of the IOReporting data product to DEV, to materialise the
governed Gold source layer that Warehouse360 depends on. Decision context:
`docs/architecture/adr-ioreporting-dev-deployment-baseline.md`.

> This is a bootstrap. The IOReporting product has never been deployed to
> DEV/UAT. Do not promote Warehouse360 contracts and do not claim DEV app
> readiness until the full Warehouse360 pack passes on materialised objects.

## Environment

| Field | Value |
|---|---|
| Databricks profile | `TG` |
| DEV workspace | `https://adb-3548637138127338.18.azuredatabricks.net` |
| SQL warehouse (validation) | `connected_plant_dev`, id `8fae28f1808dbf75` (serverless PRO) |
| Target catalog | `connected_plant_dev` |
| Source schema | `connected_plant_dev.sap` (131 SAP tables) |
| Silver schema | `connected_plant_dev.silver_dev` |
| Governed serving schema | `connected_plant_dev.gold_io_reporting` |
| Bundle | `data-products/io-reporting/databricks.yml`, target `dev` |
| Notification email | passed via `--var notification_email=<dl>` (no default) |

Run all `databricks bundle` commands from `data-products/io-reporting/`.

## Deployment map

**Created by `bundle deploy` (definitions only — no data):**
- Pipelines: `silver_fast_pipeline`, `silver_slow_pipeline`,
  `silver_quality_pipeline`, `gold_pipeline`
- Jobs: `gold_refresh_job`, `reconciliation`, `warehouse_snapshot`

**Created by running pipelines/jobs + SQL (the actual objects):**

| Layer | Objects | Produced by |
|---|---|---|
| Silver | `connected_plant_dev.silver_dev.*` | silver_fast / silver_slow / silver_quality pipelines (source: `connected_plant_dev.sap`) |
| Gold (base) | `connected_plant_dev.gold_io_reporting.gold_*` incl. `gold_transfer_requirement_backlog`, `gold_warehouse_exceptions`, base kpi/flow tables | `gold_pipeline` + `warehouse_snapshot` job |
| Gold (secured) | `gold_*_secured` incl. `gold_warehouse_kpi_snapshot_secured` | `resources/sql/gold_security_dev.sql` |
| Gold (live) | `gold_*_live` (inbound_po_backlog_enhanced, delivery_pick_status, process_order_staging, stock_expiry_risk) | `resources/sql/gold_serving_views_dev.sql` |
| Consumption | `vw_consumption_warehouse360_*` | `resources/sql/warehouse360_consumption_views_dev.sql` (only after sources validate) |

## Prerequisite reference/config seeds (run before/with Silver as required)

Reference & config tables the pipelines depend on:
- `resources/sql/sample_central_services_dev.sql` (seeds `connected_plant_dev.central_services`)
- `resources/sql/site_config_dev.sql`
- `resources/sql/storage_type_role_mapping_dev.sql`
- `resources/sql/process_order_staging_reference_mapping_dev.sql`
- `resources/sql/row_filter_dev.sql` (DEV applies no row filter — see generator)

> ⛔ **KNOWN BLOCKER (central_services).** `sample_central_services_dev.sql`
> currently copies from `published_uat.central_services.*`, but `published_uat`
> is **not bound in the DEV workspace**. The DEV-native source is
> `published_dev.central_services` (present, 120 tables) — but it is **missing
> `handlingunit_vekp` and `handlingunit_vepo`** (9 of 11 needed tables present).
> Before the Silver reference pipeline can run in DEV, the data team must decide:
> source the 2 HU tables into `published_dev`, or scope HU reconciliation out of
> the DEV baseline (then repoint the seed to `published_dev`). Until then,
> steps 4–8 below cannot complete and Warehouse360 stays blocked.

## Execution order

### 0. Preflight (read-only)
```bash
databricks catalogs list -p TG          # confirm connected_plant_dev is bound
databricks schemas  list connected_plant_dev -p TG   # confirm 'sap' exists
```
Run `validation/warehouse360_dev_source_layer_preflight.sql` on warehouse
`8fae28f1808dbf75` — expect `gold_io_reporting` MISSING and 0/7 objects on first pass.

### 1. Validate the bundle
```bash
cd data-products/io-reporting
databricks bundle validate -t dev --profile TG --var notification_email=<dl@kerry.com>
```

### 2. Deploy the bundle (creates pipeline/job definitions; reversible)
```bash
databricks bundle deploy -t dev --profile TG --var notification_email=<dl@kerry.com>
```

### 3. Seed reference/config tables
Run the prerequisite SQL seeds (above) on the DEV SQL warehouse.

### 4. Run Silver pipelines
```bash
databricks bundle run silver_fast_pipeline    -t dev --profile TG --var notification_email=<dl@kerry.com>
databricks bundle run silver_slow_pipeline    -t dev --profile TG --var notification_email=<dl@kerry.com>
databricks bundle run silver_quality_pipeline -t dev --profile TG --var notification_email=<dl@kerry.com>
```

### 5. Run Gold pipeline + snapshot job
```bash
databricks bundle run gold_pipeline      -t dev --profile TG --var notification_email=<dl@kerry.com>
databricks bundle run warehouse_snapshot -t dev --profile TG --var notification_email=<dl@kerry.com>
```

### 6. Apply security then serving SQL (order matters: `_live` is built on `_secured`)
```text
resources/sql/gold_security_dev.sql       -- *_secured views
resources/sql/gold_serving_views_dev.sql  -- *_live views
-- (resources/sql/gold_security_harden_dev.sql — base-table REVOKEs, apply last)
```

### 7. Confirm the 7 governed source objects exist
Re-run `validation/warehouse360_dev_source_layer_preflight.sql` — expect 7/7 FOUND
in `gold_io_reporting`, 0 in `gold_dev`.

### 8. Only if sources pass — Warehouse360 validation pack (in order)
```text
validation/warehouse360_dev_source_object_validation.sql
validation/warehouse360_dev_source_column_validation.sql
resources/sql/warehouse360_consumption_views_dev.sql      -- deploy consumption views
validation/warehouse360_dev_schema_validation.sql
validation/warehouse360_dev_key_validation.sql
validation/warehouse360_dev_data_quality_validation.sql
validation/warehouse360_dev_contract_validation.sql
```

## Evidence to capture

Record in `data-products/io-reporting/contracts/ioreporting-dev-deployment-profile.md`:
workspace/profile/catalog; schemas created; pipelines/jobs deployed & run (with
run IDs/states); success/failure per step; row counts per Gold object; the
preflight 7/7 result; and any unresolved errors. For Warehouse360, update
`warehouse360-dev-profile.md` / `-validation-summary-template.md` **only if** the
pack was actually rerun on materialised objects.

## Rollback / cleanup

```bash
databricks bundle destroy -t dev --profile TG --var notification_email=<dl@kerry.com>
```
`destroy` removes pipeline/job definitions but not materialised tables. For a
clean teardown, drop `connected_plant_dev.gold_io_reporting` and
`connected_plant_dev.silver_dev` manually. The config/SQL change itself reverts
via `git revert` + regenerate (`scripts/generate_gold_*_sql.py`).
