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

## Next required Databricks execution (in order)

1. **Fix the pipeline package-import root** so `import silver.*` / `from gold._shared import`
   resolve at runtime (e.g. ensure the bundle files root is on `sys.path`, or adjust the
   pipeline source layout). Blocks ALL silver/gold runs; not specific to shakedown.
2. Re-run `silver_slow_pipeline` and confirm `handling_unit` is **absent** from the graph in
   dev_shakedown (verifies the HU gate at runtime) → then `silver_fast` → `silver_quality`.
3. Run `gold_pipeline` + `warehouse_snapshot` job.
4. Apply `gold_security_dev.sql` then `gold_serving_views_dev.sql`.
5. Re-run `warehouse360_dev_source_layer_preflight.sql` — expect 7/7 FOUND.
6. Only then rerun the Warehouse360 validation pack (technical shakedown classification) and
   update its evidence.
