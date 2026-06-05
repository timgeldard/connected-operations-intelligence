# ADR-004: Parameterize bronze source via spark.conf with hardcoded fallback

**Status:** Accepted  
**Date:** 2026-05-30

## Context

The pipeline reads from a bronze schema (`connected_plant_uat.sap`). Initially this was hardcoded as a constant. The DAB bundle was later introduced with `dev` and `prod` targets that write to different silver schemas (`silver_dev` vs `silver`) for isolation. However, the bronze read remained hardcoded, meaning dev and prod both read from the same live UAT bronze — so a dev pipeline run processes real operational data with no source isolation.

Two approaches for parameterizing the source:

1. **`spark.conf.get()`** — pipeline reads its source catalog/schema from Spark configuration keys injected via the DAB `configuration` block. Fallback defaults mean the pipeline still runs if deployed manually without the bundle.
2. **Environment variable / Python constant override** — requires external tooling to inject values; no DAB-native support.

## Decision

Use `spark.conf.get("source_catalog", "connected_plant_uat")` and `spark.conf.get("source_schema", "sap")` to build the `BRONZE` constant. Wire `source_catalog` and `source_schema` through the DAB `configuration` block, driven by bundle variables.

```python
BRONZE = (
    f"{spark.conf.get('source_catalog', 'connected_plant_uat')}"
    f".{spark.conf.get('source_schema', 'sap')}"
)
```

```yaml
# resources/silver_*_pipeline.pipeline.yml
configuration:
  source_catalog: ${var.source_catalog}
  source_schema: ${var.source_schema}
```

## Consequences

- Dev target can override `source_catalog` / `source_schema` in `databricks.yml` once a dev bronze exists, achieving full read/write isolation.
- Until a dev bronze is provisioned, dev still reads from the UAT bronze — but the mechanism is now in place and documented.
- The hardcoded fallback defaults mean the pipeline functions correctly if run outside a bundle context (e.g., via the DLT UI directly).
- Any future environment (staging, test) can specify its own bronze source without code changes.
