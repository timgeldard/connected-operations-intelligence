# Connected Plant — Integrated Operations Reporting Pipelines

SAP ECC 6.0 → Silver layer (SCD Type 1) → Gold layer (reporting aggregates).  
Source: `connected_plant.sap` · Silver Target: `connected_plant.silver` · Gold Target: `connected_plant.gold`

## Prerequisites

Install Databricks CLI (>= v0.288.0):

```bash
# macOS
brew tap databricks/tap && brew install databricks

# Linux
curl -fsSL https://raw.githubusercontent.com/databricks/setup-cli/main/install.sh | sh
```

Verify: `databricks -v`

Configure auth before deploying: `databricks auth login --profile DEFAULT`

## Project layout

> The reporting-pipelines data product lives in `data-products/io-reporting/` within this
> monorepo — every path below is relative to that directory. (The repo root additionally holds
> the Warehouse360 app under `apps/`, domain UI integrations under `domain-integrations/`, and
> repo-wide CI guards under `scripts/ci/`.)

```
data-products/io-reporting/
  databricks.yml                  # Bundle config (dev / uat / prod targets)
  resources/
    silver_fast_pipeline.pipeline.yml    # Triggered Silver fast pipeline definition (refresh-cadence job)
    silver_slow_pipeline.pipeline.yml    # Triggered Silver reference pipeline definition
    silver_quality_pipeline.pipeline.yml # Triggered Silver quality pipeline definition
    gold_pipeline.pipeline.yml    # Triggered Gold pipeline definition
    sql/                          # Generated UC SQL (RLS secured views, _live serving views, consumption views)
  silver/
    tables/                       # Domain-specific table definitions (process_order, warehouse_fast, warehouse_reference, etc.)
    dlt_silver_fast.py            # Fast operational silver entrypoint (triggered)
    dlt_silver_slow.py            # Slow reference silver entrypoint (triggered)
    dlt_silver_quality.py         # Quality silver entrypoint (triggered)
    helpers.py                    # Shared DLT helpers and constants
    design_spec.md                # Silver architecture and table catalogue
  gold/
    dlt_gold_pipeline.py          # Gold aggregate definitions (daily output, schedule adherence, quality)
    design_spec.md                # Gold architecture and KPI specs
  scripts/                        # SQL generators (gold security / serving views)
  contracts/                      # Data contracts (Warehouse360 consumption, column snapshots)
  tests/                          # Unit tests for silver helpers and gold tables
```

## Development workflow

```bash
# Validate bundle config
databricks bundle validate -t dev --profile TG            # DEV-native: reads connected_plant_dev.sap (default target)
databricks bundle validate -t dev_uat_source --profile DEFAULT
databricks bundle validate -t dev_sample --profile DEFAULT
databricks bundle validate -t uat --profile DEFAULT
databricks bundle validate -t prod --profile DEFAULT

# Deploy to specific targets
databricks bundle deploy -t dev --profile TG --var notification_email=<dl>   # DEV-native (default)
databricks bundle deploy -t dev_uat_source --profile DEFAULT
databricks bundle deploy -t dev_sample --profile DEFAULT
databricks bundle deploy -t uat --profile DEFAULT
databricks bundle deploy -t prod --profile DEFAULT
```

> The `dev` target (profile `TG`) is the DEV-native deployment: it reads the real
> `connected_plant_dev.sap` source and writes the governed serving layer to
> `connected_plant_dev.gold_io_reporting`. `dev_uat_source` requires a workspace
> where `connected_plant_uat` is bound (not the DEV workspace). See
> `docs/adr/0006-ioreporting-dev-deployment-baseline.md`.

All Silver pipelines and the Gold pipeline are triggered (batch) mode. The fast pipeline runs via the scheduled refresh-cadence job (`resources/refresh_cadence.job.yml`); slow, quality, and gold run via that same job in sequence.

```bash
databricks pipelines start-update <pipeline-id> --profile DEFAULT
```

## For AI Agents

Read the `databricks-core` skill for CLI basics, authentication, and deployment workflow.  
Read the `databricks-pipelines` skill for pipeline-specific guidance.

If skills are not available, install them: `databricks aitools install`

## Key notes

- `process_order` is always restricted to AUFK `AUTYP = '40'` (PP/PI process orders; verified against live `connected_plant_uat.sap` — AUART values ZI01/ZI02/ZI05/…, with `AUTYP = '10'` returning zero rows in Kerry's config). `PP_PI_ORDER_TYPES` can further narrow AUART values once plant teams confirm the allowlist.
- Dev target writes to `connected_plant_dev` catalog, UAT to `connected_plant_uat`, and Prod to `connected_plant_prod`.
- Email recipients are parameterized via `notification_email` variable in `databricks.yml`.
- ADRs: product-level decisions live in `data-products/io-reporting/docs/adr/` (001–017); monorepo-level in `docs/adr/` (0001–0011).

## Knowledge & documentation

Any change to the data contracts (`app_contract_manifest.yml`) or the data product's
governed surface MUST be accompanied in the same PR by (a) updated documentation and
(b) a regenerated OKF bundle (`make generate-okf`); CI (`check_okf_bundle_fresh.py`)
blocks drift.

The OKF bundle lives at `data-products/io-reporting/okf/` and is generated from
`data-products/io-reporting/contracts/app_contract_manifest.yml` by
`data-products/io-reporting/scripts/generate_okf_bundle.py`.  Do not hand-edit the
bundle; it is a pure downstream artefact.
