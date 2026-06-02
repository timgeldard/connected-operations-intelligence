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
  dlt_gold_pipeline.py            # Production gold (daily output, OTIF, plant quality, freshness gate)
  warehouse_kpis.py               # TO performance, throughput, bin occupancy, stock availability, TR backlog, expiry risk
  warehouse_flow_gold.py          # Dispensary backlog, line-side stock, delivery pick, stock reconciliation, PO staging
  warehouse_inbound_gold.py       # Inbound PO backlog, handling-unit summary
  warehouse_exceptions.py         # Warehouse data-integrity / aging exceptions (severity + SLA)
  warehouse_kpi_snapshot.py       # Per-plant operations scorecard
  _shared.py                      # gold_table_args, get_silver_schema, row-filter wiring
  recon/reconciliation_job.py     # SAP->Silver->Gold reconciliation control (standalone job, not globbed)
  snapshots/warehouse_snapshot.py # Daily current-state snapshot job (not globbed)
  design_spec.md                  # Gold architecture, table catalogue, status labels, limitations
scripts/
  generate_row_filter_sql.py      # Silver plant row-filter SQL generator
  generate_gold_security_sql.py   # Gold secured-view SQL generator (ADR 012)
generate_data_dictionary.py       # Builds data_dictionary.md from schema_documentation.md (CI --check)
docs/                             # ADRs, runbook, data contracts, roadmap, hardening plan, position papers
tests/                            # Unit tests for silver helpers and gold tables
```

> Only top-level `gold/*.py` is picked up by the Gold pipeline glob; `gold/recon/` and
> `gold/snapshots/` are standalone jobs (separate `resources/*.job.yml`).

## Scope freeze (active — see docs/hardening-plan.md)

The repo is in a **hardening sprint**. Do **not** add a new Gold table unless ALL hold:
1. its Silver dependency already exists,
2. the table grain is documented (`gold/design_spec.md`),
3. unit tests are added,
4. a `docs/data_contracts.md` entry is added,
5. its freshness impact is assessed.

Also frozen: security/access-model redesign, new SAP domains, and net-new functional scope. See
`docs/hardening-plan.md` for the current sprint objective and deferred list.

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

## For AI Agents

Read the `databricks-core` skill for CLI basics, authentication, and deployment workflow.  
Read the `databricks-pipelines` skill for pipeline-specific guidance.

If skills are not available, install them: `databricks aitools install`
