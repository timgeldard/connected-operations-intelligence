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

```
databricks.yml                    # Bundle config (dev / uat / prod targets)
resources/
  silver_fast_pipeline.pipeline.yml    # Continuous Silver pipeline definition
  silver_slow_pipeline.pipeline.yml    # Triggered Silver reference pipeline definition
  silver_quality_pipeline.pipeline.yml # Triggered Silver quality pipeline definition
  gold_pipeline.pipeline.yml      # Triggered Gold pipeline definition
silver/
  tables/                         # Domain-specific table definitions (process_order, warehouse_fast, warehouse_reference, etc.)
  dlt_silver_fast.py              # Fast operational silver entrypoint (continuous)
  dlt_silver_slow.py              # Slow reference silver entrypoint (triggered)
  dlt_silver_quality.py           # Quality silver entrypoint (triggered)
  helpers.py                      # Shared DLT helpers and constants
  design_spec.md                  # Silver architecture and table catalogue
gold/
  dlt_gold_pipeline.py            # Gold aggregate definitions (daily output, schedule adherence, quality)
  design_spec.md                  # Gold architecture and KPI specs
tests/                            # Unit tests for silver helpers and gold tables
```

## Development workflow

```bash
# Validate bundle config
databricks bundle validate -t dev_uat_source --profile DEFAULT
databricks bundle validate -t dev_sample --profile DEFAULT
databricks bundle validate -t uat --profile DEFAULT
databricks bundle validate -t prod --profile DEFAULT

# Deploy to specific targets
databricks bundle deploy -t dev_uat_source --profile DEFAULT
databricks bundle deploy -t dev_sample --profile DEFAULT
databricks bundle deploy -t uat --profile DEFAULT
databricks bundle deploy -t prod --profile DEFAULT
```

The Silver pipelines are configured with different update modes (fast is continuous, slow and quality are triggered). The Gold pipeline is triggered (batch) mode.

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
- ADRs for key design decisions live in `docs/adr/`.
