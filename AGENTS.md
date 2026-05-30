# Connected Plant — Silver Pipeline

SAP ECC 6.0 → silver layer (SCD Type 1) via Aecorsoft Delta replication.  
Source: `connected_plant_uat.sap` · Target: `connected_plant_uat.silver`

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
databricks.yml                    # Bundle config (dev / prod targets)
resources/
  silver_pipeline.pipeline.yml    # Continuous pipeline definition
silver/
  dlt_silver_pipeline.py          # All 14 silver table definitions
  design_spec.md                  # Architecture and table catalogue
tests/                            # Unit tests for helper functions
```

## Development workflow

```bash
# Validate bundle config
databricks bundle validate -t dev --profile DEFAULT

# Deploy to dev (writes to connected_plant_uat.silver_dev)
databricks bundle deploy -t dev --profile DEFAULT

# Deploy to prod (writes to connected_plant_uat.silver)
databricks bundle deploy -t prod --profile DEFAULT
```

## For AI Agents

Read the `databricks-core` skill for CLI basics, authentication, and deployment workflow.  
Read the `databricks-pipelines` skill for pipeline-specific guidance.

If skills are not available, install them: `databricks aitools install`
