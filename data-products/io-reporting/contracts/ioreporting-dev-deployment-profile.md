# IOReporting DEV Deployment Profile (first-deployment baseline)

Evidence from the first deployment of the IOReporting data product to the DEV
workspace. Decision context: `docs/architecture/adr-ioreporting-dev-deployment-baseline.md`.
Runbook: `docs/runbooks/ioreporting-first-dev-deployment.md`.

## Execution metadata

| Field | Value |
|---|---|
| Executed by | tim.geldard@kerry.com |
| Execution date | 2026-06-06 |
| Profile | `TG` |
| DEV workspace | `https://adb-3548637138127338.18.azuredatabricks.net` |
| Catalog | `connected_plant_dev` |
| Bundle / target | `data-products/io-reporting/databricks.yml` · `dev` |
| Validation warehouse | `connected_plant_dev` id `8fae28f1808dbf75` |

## Result summary

| Step | Status |
|---|---|
| Preflight (read-only) | ✅ ran — baseline `gold_io_reporting` MISSING, `gold_dev` ABSENT, 0/7 objects |
| Bundle validate (`-t dev`) | ✅ OK |
| Bundle deploy (`-t dev`) | ✅ Deployment complete (after fixing Gold glob `*.py`→`**`) |
| Seed reference/config tables | ⛔ blocked (central_services — see below) |
| Run Silver pipelines | ⛔ not run (depends on reference seed) |
| Run Gold pipeline + snapshot | ⛔ not run (depends on Silver) |
| Serving / security SQL | ⛔ not run (depends on Gold) |
| Confirm 7 governed source objects | ⛔ still 0/7 (pipelines never ran) |
| Warehouse360 validation pack | ⛔ not rerun (sources do not exist) |

## Schemas / objects created

- **Schemas created:** none yet. `connected_plant_dev.gold_io_reporting` and
  `silver_dev` are **not** created by `bundle deploy` — they are created when the
  pipelines first run. Current `connected_plant_dev` schemas: `sap` (source, 131
  tables) plus pre-existing legacy (`gold`, `silver`, …). No `gold_io_reporting`,
  no `gold_dev`.
- **Silver objects:** none (pipelines not run).
- **Gold objects:** none (pipeline not run).
- **Serving / security views:** none (SQL not run).

## Pipelines & jobs deployed (definitions only — not started)

DLT pipelines deploy in a **stopped** state; nothing is running or incurring
compute. Continuous `silver_fast_pipeline` was **not** started.

| Resource | Type | ID / URL |
|---|---|---|
| `gold_pipeline` | pipeline | `a84268e5-9cdd-48a2-8512-e1c3c73e5ba8` |
| `silver_fast_pipeline` | pipeline | `22997a3a-66a6-432a-a466-c30b48c6beaf` |
| `silver_quality_pipeline` | pipeline | `f9973952-df66-4813-97b6-4b0e4ebe3392` |
| `silver_slow_pipeline` | pipeline | `60e11e74-bada-4eeb-8063-ee6c974b2d0b` |
| `gold_refresh_job` | job | `/jobs/918059917464274` |
| `reconciliation` | job | `/jobs/157014833580395` |
| `warehouse_snapshot` | job | `/jobs/903940309514736` |

## Fixes applied during this deployment (evidence-driven)

1. **Gold serving schema alignment** — `gold_dev` → `gold_io_reporting` across the
   bundle (`gold_schema` var, all dev targets) and the two SQL generators;
   regenerated `gold_serving_views_dev.sql`, `gold_security_dev.sql`,
   `gold_security_harden_dev.sql`. (ADR decision 1.)
2. **DEV-native source target** — added bundle target `dev` (now default) reading
   the real `connected_plant_dev.sap` (131 tables); existing `dev_uat_source` /
   `dev_sample` kept semantically intact. (ADR decision 3.)
3. **First-deploy library bug** — `resources/gold_pipeline.pipeline.yml` used a
   library glob `../gold/*.py`, which Databricks rejects at `terraform apply`
   ("Single asterisk glob pattern is not supported"). Note `bundle validate`
   passed on the broken glob — only `deploy` surfaced it. Replaced with explicit
   per-file `file:` entries for the 10 top-level `gold/*.py` modules (mirrors the
   silver pipelines' convention), which preserves the original "top-level `.py`
   only" semantics exactly — avoiding both `design_spec.md` and the two standalone
   job entrypoints under `gold/recon` / `gold/snapshots` that a recursive `**`
   would pull in. **Deploy-verified** (bundle redeploys cleanly); the runtime
   library *load* is not yet verified because the pipeline cannot run until the
   central_services block is resolved.

## Unresolved errors / blockers

- **central_services reference data (blocks pipeline runs).**
  `sample_central_services_dev.sql` copies reference tables from
  `published_uat.central_services.*`, but `published_uat` is **not bound in the
  DEV workspace**. DEV-native `published_dev.central_services` exists (120 tables)
  but is **missing `handlingunit_vekp` and `handlingunit_vepo`** (9/11 needed
  present). Data-team decision required (source the HU tables, or scope HU recon
  out of the DEV baseline + repoint the seed to `published_dev`). Not guessed
  here.

## Update 2026-06-06 — dev_shakedown mode + first pipeline-run attempt

The central_services blocker above is now addressed by **dev_shakedown mode** (see ADR
`adr-ioreporting-dev-shakedown-vs-uat-validation`): the `dev` target reads
`published_dev.central_services` directly and runs with `enable_hu_reconciliation=false`,
so HU-dependent models are not built and the missing HU tables no longer block the non-HU
shakedown. DEV schema is now `silver_io_reporting` + `gold_io_reporting`.

- ✅ `ioreporting_dev_shakedown_preflight.sql` run live: SAP + `published_dev.central_services`
  + all 9 non-HU reference tables **PRESENT**; both HU tables **ABSENT** (allowed in shakedown).
- ✅ `bundle validate -t dev` and `-t uat` OK; `bundle deploy -t dev` OK (shakedown config applied).
- ⛔ **First pipeline run attempt FAILED — new, separate blocker.** Triggered
  `silver_slow_pipeline` (update `3b5f3f5f-...`) failed at INITIALIZING with
  `ModuleNotFoundError: No module named 'silver'` on line 6 of `dlt_silver_slow.py`
  (`import silver.tables.inbound`). This is a **package-path / pipeline-root** issue in the
  never-run pipelines — the bundle files root is not on `sys.path`, so the `silver` (and by
  extension `gold`) package is not importable. It is **independent of the HU-gating feature**
  and occurs **before** any `@dlt` definition is evaluated.
- ⚠️ Consequence: the **runtime effect of `enable_hu_reconciliation` is UNVERIFIED** — execution
  never reaches the gate in `inbound.py`. The gating is deploy/validate-verified only.

## Update 2026-06-07 — package-import root FIXED + runtime-verified

**Root cause.** The entrypoints use absolute imports (`import silver.tables.*`,
`from gold._shared import`) that need the bundle root on `sys.path`. At DLT runtime a `file:`
library deep at `files/silver/dlt_silver_slow.py` only puts `files/silver/` on the path, so
`silver`/`gold` are not importable. Masked locally because the bundle-root `pyproject.toml`
sets pytest `pythonpath = ["."]`.

**Fix.** Editable-install the synced bundle root into each pipeline's serverless environment:
`environment.dependencies: [--editable ${workspace.file_path}]` on all four pipelines, plus a
`[build-system]` + `[tool.setuptools.packages.find] include=["silver*","gold*"]` in the
bundle-root `pyproject.toml`, and `__init__.py` markers for `silver`, `silver/tables`, `gold`,
`gold/recon`, `gold/snapshots`. (The editable install is the load-bearing change; the
`__init__.py` files exist so setuptools packages the dirs.) Guarded by
`scripts/ci/check_pipeline_package_imports.py`.

**Runtime-verified (silver_slow, update `eeedf7...`).**
- ✅ Import resolved: the run got **past** `import silver.tables.inbound` into flow analysis /
  graph construction — **no `ModuleNotFoundError`**.
- ✅ **HU gate confirmed**: `handling_unit` is **absent** from the dev_shakedown graph — no
  `handlingunit_vekp`/`vepo` resolution error, and 0 HU-related pipeline events. This
  retroactively runtime-verifies PR #20's previously-unverified gating claim.
- 📋 The run then failed on **separate DEV-data issues** (old/limited DEV data — expected for a
  shakedown, NOT in scope for the import fix): `connected_plant_dev.sap.workcenterheader_crhd`
  not found (`work_centre`); column `LGBKT` absent in `sap.storagebin_lagp` (`stg_storage_bin`);
  `CANNOT_DETERMINE_TYPE` in `site_config_movement_type_classification`. Captured as shakedown
  findings; per the task, execution stopped once imports were proven to load.

**Known follow-up — jobs are NOT covered.** The editable install is on the four *pipelines*
only. The three *jobs* (`gold_refresh_job`, `reconciliation`, `warehouse_snapshot`) run Python
task files that also do package imports (`reconciliation_job.py`, `warehouse_snapshot.py` →
`from gold._shared import`). They will hit the same `ModuleNotFoundError` until given an
equivalent task-environment editable install. This matters: `warehouse_snapshot` produces
`gold_warehouse_kpi_snapshot`, the base for `gold_warehouse_kpi_snapshot_secured` (one of the 7
WH360 source objects). **Imports are fixed for pipelines and runtime-verified for silver_slow;
jobs remain to be addressed in a separate task.**

## Update 2026-06-07 (b) — DEV source/schema blockers resolved + jobs import extended

Addressed the three DEV-data flow failures from the prior run, plus the jobs import gap.
**Key finding: the CRHD tables and the missing LAGP columns are absent in BOTH
`connected_plant_dev.sap` AND `connected_plant_uat.sap` (confirmed live) — they are
source-replication gaps, NOT DEV-only, so they also gate UAT full_validation.**

Fixes:
- **CRHD / `work_centre`** — `workcenterheader_crhd`/`crtx` are absent in both envs and `work_centre`
  has **no downstream pipeline consumers**. It is now source-guarded via `bronze_table_exists(...)`
  (a lazy `spark.read.table` probe — `spark.catalog.tableExists` is a **blocked Py4J API** at DLT
  graph-construction, `PY4J_BLOCKED_API`), so it is simply not defined when CRHD is absent, and
  self-heals when replicated. No fabricated data.
- **`storagebin_lagp` columns** — `LGBKT, LGPBE, MAXGW, MAXEI, ANZRE` are absent in both envs.
  They are optional descriptive bin attributes → emitted as typed NULL via `col_or_null(...)`.
  **Not** remapped (e.g. `LGBKT`→`LPTYP`) — a data-team mapping decision. Impact: `gold_bin_occupancy`
  loses `bin_type` as a grouping dimension; bin COUNTS and the WH360 overview KPIs are unaffected.
- **movement-type seed** — `site_config_movement_type_classification` now passes an explicit
  StructType (positional tuples) to `createDataFrame`, fixing `CANNOT_DETERMINE_TYPE` from the
  all-NULL `plant_code`. Guarded by `scripts/ci/check_seed_explicit_schemas.py`.
- **jobs import** — `reconciliation_control` (runs `reconciliation_job.py` →
  `from gold.servicenow import ...`) now editable-installs the bundle root in its task environment.
  `warehouse_snapshot.py` is self-contained (no package import) and `gold_refresh_job` runs
  pipeline tasks only, so neither needs it (verified). The package-import check now covers jobs.
- New `validation/ioreporting_dev_source_schema_preflight.sql` classifies required vs tolerated-gap
  vs degraded-column source schema.

**Runtime-verified (silver_slow, update `e5818d...`).**
- ✅ The 3 fixed blockers are **past**: analysis now resolves `work_centre` (gated out),
  `stg_storage_bin` (`storagebin_lagp` resolves via `LPTYP`, no `LGBKT`), and the movement-type seed.
- ✅ `ioreporting_dev_source_schema_preflight.sql` run live: all 33 required SAP tables present;
  CRHD/CRTX reported as tolerated gaps; LAGP columns reported as degraded (typed NULL); verdict
  **SOURCE-SCHEMA READY**.
- ⛔ **Next distinct blocker (silver_slow still does NOT complete) — a separate code-bug class, not
  schema/source:** `strip_zeros(F.coalesce(...))` raises `[NOT_ITERABLE] Column is not iterable`
  in `silver/tables/inbound.py:67` (`stg_purchase_order`) and 2 other flows. `strip_zeros(col_name: str)`
  does `F.col(col_name)` but four callers pass a `Column` (`F.coalesce(...)`): `inbound.py`,
  `process_order.py`, `warehouse_fast.py`, `warehouse_flow.py` — so it also affects silver_fast.
  Recommended follow-up: make `strip_zeros` accept a `Column` or column name. Per task scope
  (named schema/source blockers + jobs; stop at next distinct blocker), NOT fixed in this PR.

**Latent gold-stage concern (documented, not fixed):** `gold/freshness.py` calls
`spark.catalog.tableExists(...)` directly at execution time — the same blocked Py4J API — which will
surface when the gold pipeline runs.

No pipeline completed; **Warehouse360 validation was NOT rerun**; no contract promoted; DEV remains a
technical shakedown only.

## Next required Databricks execution (in order)

1. ✅ DONE — pipeline imports fixed; the 3 DEV source/schema blockers fixed and runtime-verified.
2. Fix the `strip_zeros(Column)` `NOT_ITERABLE` bug (4 callers) so `stg_purchase_order` and the
   other affected silver flows analyse — then re-run `silver_slow` to completion.
3. Run `silver_fast` → `silver_quality` → `gold_pipeline` (+ `warehouse_snapshot`); expect the
   `gold/freshness.py` `catalog.tableExists` Py4J block as the next gold-stage blocker.
4. Apply `gold_security_dev.sql` then `gold_serving_views_dev.sql`.
5. Re-run `warehouse360_dev_source_layer_preflight.sql` — expect 7/7 FOUND.
6. Only then rerun the Warehouse360 validation pack (technical shakedown classification) and
   update its evidence.
