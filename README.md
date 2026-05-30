# Connected Plant — Silver Pipeline

SAP ECC 6.0 → silver layer for Integrated Operations (Warehouse & Manufacturing).

Aecorsoft replicates SAP data incrementally into `connected_plant_uat.sap` (bronze). This pipeline transforms it into 14 clean silver tables in `connected_plant_uat.silver`, covering process orders, warehouse operations, quality, and reference data.

## Architecture

```
connected_plant_uat.sap  (Bronze — Aecorsoft Delta replication)
         │
         ▼  Continuous Lakeflow Pipeline
connected_plant_uat.silver
  process_order · process_order_operation · pi_sheet_execution
  goods_movement · batch_stock · warehouse_transfer_order
  warehouse_transfer_requirement · storage_bin · downtime_event
  quality_inspection_lot · material · storage_location
  work_centre · capacity_utilisation
```

All tables use SCD Type 1 (`apply_changes`) with liquid clustering. Plant-level row security is enforced via Unity Catalog Row Filter.

## Quick start

**Prerequisites:** Databricks CLI ≥ v0.288.0 and workspace auth configured.

```bash
# Install CLI (macOS)
brew tap databricks/tap && brew install databricks

# Authenticate
databricks auth login --profile DEFAULT

# Validate bundle
databricks bundle validate -t dev --profile DEFAULT

# Deploy to dev (writes to connected_plant_uat.silver_dev)
databricks bundle deploy -t dev --profile DEFAULT

# Deploy to prod
databricks bundle deploy -t prod --profile DEFAULT
```

Start the pipeline once after deploy (it runs continuously):

```bash
databricks pipelines start-update <pipeline-id> --profile DEFAULT
```

## Development

```bash
# Install test dependencies
pip install pytest pyspark

# Run tests
pytest
```

## Docs

- [`silver/design_spec.md`](silver/design_spec.md) — architecture, table catalogue, data quality strategy
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/runbook.md`](docs/runbook.md) — operational runbook
