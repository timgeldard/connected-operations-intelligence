# Connected Plant — Integrated Operations Reporting Pipelines

Bronze SAP replicas → Silver operational state → Gold reporting aggregates.

Aecorsoft replicates SAP data incrementally into bronze. This bundle transforms it into 14 clean silver tables and computes downstream Gold aggregates for OEE, OTIF, and production output.

## Architecture

```
                 [Bronze Layer]
             connected_plant.sap
                      │
                      ▼ (Continuous Lakeflow Pipeline)
                 [Silver Layer]
             connected_plant.silver
   process_order · process_order_operation · pi_sheet_execution
   goods_movement · batch_stock · warehouse_transfer_order
   warehouse_transfer_requirement · storage_bin · downtime_event
   quality_inspection_lot · material · storage_location
   work_centre · capacity_utilisation
                      │
                      ▼ (Triggered Batch Pipeline)
                  [Gold Layer]
              connected_plant.gold
   gold_shift_output_summary · gold_order_otif_metrics · gold_plant_production_quality_summary
```

Silver tables use SCD Type 1 (`apply_changes`) with liquid clustering and Unity Catalog Row Filters for plant-level access control. Gold tables aggregate Silver conformed data into Materialized Views with native row filters.

## Quick start

**Prerequisites:** Databricks CLI ≥ v0.288.0 and workspace auth configured.

```bash
# Install CLI (macOS)
brew tap databricks/tap && brew install databricks

# Authenticate
databricks auth login --profile DEFAULT

# Validate bundle configurations for targets
databricks bundle validate -t dev_uat_source --profile DEFAULT
databricks bundle validate -t dev_sample --profile DEFAULT
databricks bundle validate -t uat --profile DEFAULT
databricks bundle validate -t prod --profile DEFAULT

# Deploy to specific targets (writes to target catalogs)
databricks bundle deploy -t dev_uat_source --profile DEFAULT
databricks bundle deploy -t dev_sample --profile DEFAULT
databricks bundle deploy -t uat --profile DEFAULT
databricks bundle deploy -t prod --profile DEFAULT
```

Start the pipelines once after deploy:

```bash
databricks pipelines start-update <pipeline-id> --profile DEFAULT
```

## Development

```bash
# Install test dependencies
pip install -r tests/requirements-test.txt

# Run tests
PYTHONPATH=. pytest
```

## Docs

- [`silver/design_spec.md`](silver/design_spec.md) — Silver architecture, table catalogue, and expectations strategy
- [`gold/design_spec.md`](gold/design_spec.md) — Gold architecture and KPI calculations
- [`docs/adr/`](docs/adr/) — Architecture decision records
- [`docs/runbook.md`](docs/runbook.md) — Operational runbook for Silver & Gold pipelines
