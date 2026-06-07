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

## Update 2026-06-07 (c) — strip_zeros NOT_ITERABLE fixed + runtime-verified

- **Root cause:** `strip_zeros(col_name)` did `F.col(col_name)`, but four callers passed a Spark
  `Column` (`F.coalesce(...)`): `inbound.py:67`, `process_order.py:100`, `warehouse_fast.py:71`,
  `warehouse_flow.py:132`. `F.col(<Column>)` raises `[NOT_ITERABLE] Column is not iterable` (also
  affected silver_fast).
- **Fix:** `strip_zeros` now accepts `str | Column` — wraps a `str` with `F.col`, uses a `Column`
  directly. String-case semantics unchanged (NULL/blank → NULL, all-zero → NULL, numeric leading
  zeros stripped, non-numeric pass-through). The four call sites are unchanged (no business-logic
  rewrite — the helper fix is sufficient). Tests added in `tests/test_helpers.py` for `F.col`,
  `F.coalesce` (incl. fallback) and null Column input.
- **Runtime-verified (silver_slow, update `48e129`):** `stg_purchase_order` now resolves — the
  `NOT_ITERABLE` blocker is **past**.
- ⛔ **Next distinct blocker (silver_slow still does NOT complete) — code↔replicated-schema mismatch
  (same class as storagebin_lagp, out of this task's scope):** `stg_capacity_utilisation`
  (`reference.py`) references KAPA columns absent from the replicated
  `connected_plant_dev.sap.shiftparametersavailablecapacity_kapa`. Confirmed live: of the 10
  referenced KAPA columns only `KAPAZ` is present; **missing: `DAFBI, DAFEI, PAUSA, BEGDA, ENDDA,
  MEINH, OEFFZ, NORMA, RUEZT`**. The replicated KAPA instead has shift-parameter columns
  (`DATUB, TAGNR, SCHNR, BEGZT, EINZT, ENDZT, ANG_MIN, ANG_MAX, …`). Needs a source-mapping decision
  (like `storagebin_lagp`) — not fixed here.
- **No Silver objects materialised** — the failure is at flow analysis (graph construction), before
  any table is written. **Warehouse360 validation NOT rerun; no contract promoted; DEV shakedown only.**
- Still latent: `gold/freshness.py` uses the blocked `spark.catalog.tableExists` (gold-stage blocker).

## Update 2026-06-07 (d) — silver_slow COMPLETES; capacity source-guarded; freshness/Py4J pre-fixed

- **`stg_capacity_utilisation` source-guarded** (like `work_centre`): it references KAPA columns
  absent from the replicated `shiftparametersavailablecapacity_kapa` (only `KAPAZ` of 10 present).
  It has **no pipeline consumers** and is **not** in the WH360 critical path, so the whole model
  (view + `capacity_utilisation` streaming table + apply_changes) is defined only when the required
  KAPA columns exist, via new `bronze_columns_exist(...)`. Gap also affects UAT — flagged in the
  source-schema preflight (new KAPA section). Not fabricated, not remapped.
- **`stg_storage_bin` BRGEW** — `current_weight` (BRGEW) was the last unhandled missing LAGP column
  (no gold consumer) → typed NULL via `col_or_null`, completing the storagebin_lagp tolerance.
- **gold/freshness.py + gold/_shared.table_exists** — replaced `spark.catalog.tableExists` (a
  **blocked Py4J API** in DLT serverless) with the lazy `spark.read.table` probe; the 9 silver
  config-seed checks in `reference.py` were routed through the new `relation_exists(...)` too. New
  static guard `scripts/ci/check_no_blocked_spark_apis.py` bans `catalog.tableExists` in DLT pipeline
  code (excludes the standalone job scripts under `gold/recon` / `gold/snapshots`, which run in a
  normal Spark context).

**Runtime-verified (silver_slow, update `0eb81b` — COMPLETED).**
- ✅ **silver_slow now runs end-to-end.** Silver objects **materialised** in
  `connected_plant_dev.silver_io_reporting`: e.g. `storage_bin` 511,380 rows, `material` 2,111,130,
  `purchase_order` 6,622,412, `movement_type_classification` 314, plus `customer`, `vendor`, `plant`,
  `stock_at_location`, `physical_inventory_document`, `recipe_process_line`, `site_config_*`, etc.
- ✅ `work_centre` and `capacity_utilisation` are **correctly absent** (source-guarded out) — verified
  in the materialised schema.
- ✅ `ioreporting_dev_source_schema_preflight.sql` (with new KAPA section) runs clean; verdict
  SOURCE-SCHEMA READY.
- This is a **TECHNICAL shakedown** result (the DLT silver reference pipeline runs against real DEV
  SAP). It is **not** business validation. **Warehouse360 validation was NOT rerun** — the 7 WH360
  source objects live in Gold, which has not been built. No contract promoted; DEV shakedown only.

## Update 2026-06-07 (f) — silver_fast BLOCKED on a fast-tier field-contract gap (WH360-critical)

Baseline re-confirmed on merged main (PR #20 = `088c3b4`): `connected_plant_dev.silver_io_reporting`
exists with 24 tables; `silver_slow` outputs persist (storage_bin 511,380 / material 2,111,130 /
purchase_order 6,622,412 / movement_type_classification 314). `gold_io_reporting` not yet created.

Ran `silver_fast` (continuous; started + stopped). **Fails at analysis** — **7 staging flows**
reference SAP columns absent from the replicated source tables. Complete static audit (warehouse_fast.py
vs live `information_schema.columns`, identical in dev + uat):

| Flow (WH360-critical) | Source table (replicated cols) | MISSING columns |
|---|---|---|
| `stg_warehouse_transfer_order` | `transferorderobjects_ltap` (165) | `ANFME, ENMNG, ISPOS` |
| `stg_warehouse_transfer_requirement` | `transferrequirementobjects_ltbp` (52) | `ENQTY` |
| `stg_goods_movement` | `inventorymovement_mseg` (214) | `VBELN` |
| `stg_batch_stock` | `batchstock_mchb` (44) | `AERECNO, AERUNID, MEINS` |

(`ltak`, `ltbk`, `mkpf` fully present.) 3 further failing flows — `stg_process_order_operation`,
`stg_downtime_event`, `stg_pi_sheet_execution` (process_order.py) — are **NOT** WH360-source feeders.

**WH360-criticality trace:** `warehouse_transfer_order` is read by **all 5** WH360-source gold modules;
`warehouse_transfer_requirement`/`goods_movement`/`batch_stock` feed `gold_transfer_requirement_backlog`/
`gold_stock_expiry_risk`/`gold_warehouse_exceptions`. So the 4 critical flows block essentially all 7
WH360 gold sources.

**Disposition — NOT fixed (by design, per constraints):** missing fields are **core
transactional/structural** (TO/TR quantities, item position, delivery ref, CDC sequencing metadata) —
not optional → **cannot be typed-nulled** (would fabricate business data); and the flows are
WH360-critical → **cannot be source-guarded away** (would delete WH360 sources). Likely **incorrect
field names** in the silver code (e.g. LTAP source-target quantities are `VSOLA`/`VSOLM`/`NSOLA`, not
`ANFME`) OR fields excluded from the curated replication. Requires **functional/data-team
reconciliation** (do not invent fields, do not silently remap). Recorded in
`source-contracts/sap/sap_unresolved_sources.yml`.

**Pipeline outcomes this round:**
- `silver_slow`: ✅ COMPLETE (prior; outputs persist). `silver_fast`: ⛔ FAILS at analysis.
- `silver_quality`, `gold_pipeline`, `warehouse_snapshot`, `gold_security_dev.sql`,
  `gold_serving_views_dev.sql`: **NOT run** (would fail on absent silver_fast inputs).
- `warehouse360_dev_source_object_validation.sql`: ✅ ran → **0/7** source objects FOUND
  (`gold_io_reporting` absent). Per the gate, consumption views **NOT** deployed; WH360 validation
  pack **NOT** run.

**Status:** Warehouse360 contracts remain **candidate/pending** (source objects missing). DEV
technical shakedown only; this field-contract gap also blocks **UAT** full validation.

## Next required Databricks execution (in order)

1. ✅ DONE — silver_slow blockers; **silver_slow COMPLETES**. silver_fast field-contract gap fully
   inventoried (above) and recorded in `sap_unresolved_sources.yml`.
2. **BLOCKER — data-team / functional:** reconcile the silver_fast field contract with the replicated
   SAP schema (LTAP `ANFME`/`ENMNG`/`ISPOS`, LTBP `ENQTY`, MSEG `VBELN`, MCHB `AERECNO`/`AERUNID`/`MEINS`)
   — confirm correct field names (e.g. LTAP qty `VSOLA`/`VSOLM`) or add the fields to the replication.
   WH360-critical + business-valued → confirmation required, NOT nulling. Then re-run `silver_fast`.
3. Run `silver_quality`; then `gold_pipeline` (+ `warehouse_snapshot`).
4. Apply `gold_security_dev.sql` then `gold_serving_views_dev.sql`.
5. Re-run `warehouse360_dev_source_object_validation.sql` — expect 7/7 FOUND.
6. Only then deploy consumption views + run the Warehouse360 validation pack (technical shakedown
   classification) and update its evidence.

## Update 2026-06-07 (g) — silver_fast field reconciliation produced; still BLOCKED (no remap proven)

Reconciled the 4 WH360-critical missing-field gaps against all available evidence (Aecorsoft 1:1
replication, `information_schema.columns` DEV+UAT, and the DDIC-style `scratch.gold_sap_table_metadata`
/ `gold_sap_data_element_metadata`). **DDIC `DD03L` (field→data element) is unavailable**, and the
table-/data-element-level metadata does **not** bridge field→meaning. So the evidence proves field
**existence, not meaning** — mapping a missing field to a same-purpose replicated field would rely on
SAP training knowledge, which the task bars. **No transformation code changed.**

Per-field decisions (full detail: `source-contracts/sap/silver_fast_field_reconciliation.md`):
- LTAP `ANFME`/`ENMNG`/`ISPOS` → candidates `VSOLM`/`VISTM` — **functional/DD03L confirmation required**
  (and `confirmed`/`picked` collapse onto one real field — a functional owner must define the 3 columns).
- LTBP `ENQTY` → candidate `MENGE - MENGA` — **confirmation required** (proposing a derivation).
- MSEG `VBELN` → candidate `VBELN_IM` (present) — **confirmation required** (high plausibility).
- MCHB `MEINS` → join `materialmaster_mara.MEINS` — **PROVEN structural** but **held** (does not unblock
  `stg_batch_stock` alone — its CDC gap remains; applied together with the CDC fix).
- MCHB `AERUNID`/`AERECNO` (CDC sequencing) → **request CDC-enabled MCHB replication** (AEDATTM-only
  `sequence_by` would break SCD1 determinism — not applied).

`silver_fast` therefore **remains blocked**; Gold not built; Warehouse360 still **0/7**; consumption
views not deployed; validation pack not run; contracts remain **candidate/pending**. Gaps also block
UAT. Next: data-team supplies DD03L / functional sign-off + CDC-enabled MCHB replication, then apply
the confirmed mappings and re-run.

## Update 2026-06-07 (h) — approved WM/MM mappings IMPLEMENTED; 4 critical flows resolve; silver_fast still blocked on process_order

**Functional sign-off received** (supersedes (g)'s "confirmation required"). Implemented the approved
mappings in `silver/tables/warehouse_fast.py` and re-verified every source field exists live
(`information_schema.columns`, 2026-06-07):

| Flow | Approved mapping (implemented) |
|---|---|
| `stg_warehouse_transfer_order` (LTAP) | `requested_quantity`←`VSOLM`; `confirmed_quantity`←`VISTA`; `actual_quantity_picked`←`VISTA` (alias of confirmed — WM picking & confirmation collapse to one persisted qty). Note: functional chose `VISTA`, **not** the earlier `VISTM` guess. `PQUIT`/`PVQUI`/`KQUIT` preserved. |
| `stg_warehouse_transfer_requirement` (LTBP) | `open_quantity`←`greatest(coalesce(MENGE,0)-coalesce(TAMEN,0),0)` (null-safe, clamped ≥0). `TAMEN` confirmed present; functional chose `TAMEN`, **not** `MENGA`. |
| `stg_goods_movement` (MSEG) | `delivery_number`←`VBELN_IM`, `delivery_item`←`VBELP_IM`; NULL when blank (no fallback); new `reference_type='DELIVERY'` when populated. |
| `batch_stock` (MCHB) | `base_uom`←`MARA.MEINS` (join `MCHB.MATNR=MARA.MATNR` on `MANDT+MATNR`); modelled as a **snapshot/current-state materialized view** (no `apply_changes`/CDC; `AEDATTM` kept as extraction timestamp only). MARA verified 1:1 (973,314 rows = 973,314 keys → no join fan-out). |

Regression guard added: `scripts/ci/check_silver_fast_field_mappings.py` (bans the invalid fields +
the MCHB CDC pattern). Validation SQL added: `validation/silver_fast_mapping_validation.sql`
(pre-run existence/fan-out gate §A + post-run output checks §B–E). Bundle validates; pre-run gate §A
GREEN (0 missing fields, 0 MARA fan-out).

**Run result (update `5abc0952`):** the **4 WH360-critical flows now RESOLVE** — the update fails on
only *"`stg_process_order_operation` and 2 other flows"*, vs *"`stg_warehouse_transfer_order` and 6
other flows"* before. **But silver_fast still does NOT complete:** DLT analysis is all-or-nothing, so
the 3 remaining flows abort the whole update → nothing materialises. The 3 are the out-of-scope PP/PI
flows in `process_order.py` — `stg_process_order_operation` (`processorderobject_afvc`),
`stg_pi_sheet_execution`, `stg_downtime_event` (`downtime_zpexpm_dwnt`) — failing `UNRESOLVED_COLUMN`
on `AERUNID`/`AERECNO`/`RecordActivity` (CDC metadata absent; same gap class as MCHB, different domain).

**Consequences unchanged:** mappings resolved but **not yet DATA-validated** (§B–E couldn't run); Gold
**not built**; Warehouse360 **0/7**; consumption views not deployed; validation pack not run; contracts
remain **candidate/pending**; DEV = technical shakedown only. **Next step (separate change, out of this
PR's scope):** apply the MCHB-style snapshot/current-state pattern (or source-guard) to the 3
process_order flows so silver_fast completes, then run §B–E + Gold + the WH360 source-object pack.

## Update 2026-06-07 (i) — silver_fast COMPLETES (PP/PI gated; broadcast-OOM fixed); WM/MM mappings DATA-validated

Two distinct changes in this update, both reversible:

**(1) PP/PI source-gating [the asked change].** The 3 PP/PI flows that previously blocked the whole
silver_fast update — `stg_process_order_operation`, `stg_pi_sheet_execution`, `stg_downtime_event`
(silver/tables/process_order.py) — fail `UNRESOLVED_COLUMN` on `AERUNID`/`AERECNO`/`RecordActivity`,
which are **absent** from their replicated sources (`dbstructureoperationquantitydatevalues_afvv`,
`actualpistartenddatetime_zmanpex_e04_002`, `downtime_zpexpm_dwnt` — each carries only `AEDATTM`;
AFVC/AFKO carry full CDC). **Dependency trace (confirmed):** none of the 3 feed any of the 7
Warehouse360 governed source objects — they feed only `gold_process_order_operations` /
`gold_order_downtime_summary` / `gold_plant_production_quality_summary` (not governed; not in the
consumption views). So each flow is **source-guarded** (`if bronze_columns_exist(<source>, [CDC cols])`,
the work_centre/capacity precedent): absent CDC → flow not defined → no fabricated CDC, no AEDATTM-as-
sequence. The 3 non-governed Gold consumers degrade to empty via `gold._read_or_empty` so `gold_pipeline`
is not blocked. Environment-wide gap (DEV+UAT) — not a dev-only toggle; self-heals once the sources are
replicated with CDC metadata. Snapshot/current-state redesign is deferred pending per-source functional
sign-off (AFVV is transactional — sibling of AFVC; zmanpex/zpexpm possibly current-state). See
`source-contracts/sap/sap_unresolved_sources.yml` (`pp_pi_flows_missing_cdc_metadata`).

**(2) Broadcast-join OOM fix [discovered, pre-existing].** With the 3 flows gated, silver_fast cleared
analysis and reached runtime — exposing a latent Photon `SparkOutOfMemoryError` building a
`BroadcastHashedRelation` in `stg_warehouse_transfer_order` (the changed_keys ⋈ LTAP[`i.*`, 165 wide
var-len cols] ⋈ LTAK stream-static join). Only transfer_order OOM'd; goods_movement (the biggest join)
and transfer_requirement completed. Fix: `spark.sql.autoBroadcastJoinThreshold: -1` on the pipeline
(forces sort-merge; spills instead of OOM). Pre-existing in the join structure — unreachable while the
flow failed analysis on the legacy ANFME/ENQTY fields (PR #23). Reversible; a narrower per-join merge
hint is a possible prod-efficiency refinement.

**Result (update 281cffac):** silver_fast **COMPLETES**. Materialised in
`connected_plant_dev.silver_io_reporting`: warehouse_transfer_order **13,485,287**, warehouse_transfer_
requirement **15,934,046**, goods_movement **10,761,727**, batch_stock **11,499,051**, process_order +
the reference/flow tables; the 3 PP/PI tables correctly **absent** (gated). 0 OOM events.

**WM/MM mappings now DATA-validated** (`validation/silver_fast_mapping_validation.sql` §B–E, first run
they could execute): LTAP alias invariant holds (0 mismatches/13.5M); LTBP open_quantity 0 null/0 neg/0
over-required; MSEG reference_type 100% consistent; MCHB base_uom 100% covered (no fan-out). One **§E1
finding** (measured with `GROUP BY..HAVING`, not the confounded `COUNT(*)-COUNT(DISTINCT)`): **2,016
colliding key groups / 4,039 rows (0.035%)** in batch_stock — GENUINE duplicate keys, **not** a NULL
artifact (only 77 NULL-batch rows total, 2 in collisions). Cause: `strip_zeros` collapses distinct raw
MATNR/CHARG (leading-zero/format variants) to the same `(material_code, batch_number)`, and the silver
key omits MANDT; bronze is 1:1 on the raw key. Pre-existing PR #23 batch_stock key nuance (snapshot key
is ~1:1, not strictly 1:1) — NOT caused by this change; small but real (slight stock double-count in
`gold_stock_*`). Recorded as a follow-up (needs a key-design call); re-validate in UAT.

**Warehouse360 readiness: still NOT claimed.** Gold not yet built and the 7 governed source objects not
yet validated (next: silver_quality → gold_pipeline → `warehouse360_dev_source_object_validation.sql`
expecting 7/7 → WH360 pack). DEV remains a technical shakedown only; UAT is the first full business/HU
validation. No contract promoted.

## Update 2026-06-07 (j) — silver_quality: separate new blocker (QM domain); does NOT gate Warehouse360

After silver_fast completed, ran `silver_quality_pipeline` (update f9e2949a). **FAILED at analysis** —
a NEW, distinct, pre-existing blocker unrelated to this PR: `stg_quality_inspection_lot`
(`silver/tables/quality.py:23`) reads `inspection_qals` and references `MANDT`, which is **absent**
from the replicated `connected_plant_dev.sap.inspection_qals` (`UNRESOLVED_COLUMN`). This is a
QM-domain replicated-schema gap (same class as the WM/MM and PP/PI gaps, different domain), in code
this PR did not touch. **Not fixed here** (out of scope; needs the same source-guard/replication
treatment as the other domains — a separate change).

**Does NOT gate Warehouse360 or Gold:** silver_quality produces only `quality_inspection_lot`, and
**no Gold module reads it** (verified). The 7 governed source objects depend on the WM/MM flows +
process_order, not QM. So Gold was run regardless (see next).

## Update 2026-06-07 (k) — gold_pipeline: separate new blocker (duplicate table def); 0/7 stands

Ran `gold_pipeline` (update 45b908f4, first-ever gold run). **FAILED at graph construction:**
`Found duplicate table 'connected_plant_dev.gold_io_reporting.gold_storage_type_role_coverage_status'`.
The table is defined **twice**, in two different top-level gold modules with **different**
implementations:
- `gold/readiness_validation.py:13` — reads `storage_bin` + `site_config_storage_type_role`, emits a
  `match_rate`.
- `gold/warehouse_flow_gold.py:536` — reads `storage_bin` + `storage_type_role_mapping`, emits
  VALIDATED/PARTIAL/MISSING.

This is a **pre-existing gold defect** exposed on the first gold run — **unrelated** to this PR (PP/PI
gating / WM/MM mappings; neither file touched here) and **not** caused by the `_read_or_empty` guards.
It is **not** one of the 7 governed objects, but DLT graph construction is all-or-nothing, so it aborts
the whole pipeline → the 7 cannot materialise. **Not fixed here:** the two definitions have different
sources and output schemas, so choosing the canonical one (and retiring the other) is a gold-architecture
decision for the gold owner, outside this PR's scope. There may be further first-run gold issues behind it.

**`_read_or_empty` PP/PI guards:** not yet exercised at runtime — the duplicate-table error aborts
*before* flow execution, so the empty-path verification is still pending the gold unblock.

**Warehouse360 readiness: NOT claimed (Task 10).** Gold not built; `warehouse360_dev_source_object_validation.sql`
remains **0/7**; consumption views not deployed; WH360 pack not run; no contract promoted. The
silver_fast unblock (this PR's goal) is achieved and data-validated; the remaining gold/quality blockers
are separate, pre-existing, out-of-scope defects to resolve next.

## Outstanding blockers (ordered) to reach Warehouse360 7/7

1. **gold_pipeline** — resolve the duplicate `gold_storage_type_role_coverage_status` definition
   (`readiness_validation.py` vs `warehouse_flow_gold.py`); rerun gold; expect possible further first-run
   gold issues. [gold owner]
2. **silver_quality** (independent of WH360) — `stg_quality_inspection_lot` references `MANDT` absent
   from `inspection_qals`; source-guard or confirm replication. [QM domain]
3. After gold builds: `gold_security_dev.sql` + `gold_serving_views_dev.sql` →
   `warehouse360_dev_source_object_validation.sql` (expect 7/7) → WH360 consumption views + pack.
