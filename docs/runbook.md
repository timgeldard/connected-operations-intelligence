# Operational Runbook — Connected Plant Pipelines (Silver & Gold)

## Pipeline Identity

| Item | Silver Pipeline | Gold Pipeline |
|---|---|---|
| Bundle name | `connected-plant` | `connected-plant` |
| Target Catalog (Prod) | `connected_plant_prod` | `connected_plant_prod` |
| Target Schema (Prod) | `silver` | `gold` |
| Mode | Continuous | Triggered (Batch) |
| Notifications | Configure in `resources/silver_*_pipeline.pipeline.yml` | Configure in `resources/gold_pipeline.pipeline.yml` |

### Environment Target Matrix

| Environment Target | Catalog (`${var.catalog}`) | Silver Schema (`${var.schema}`) | Gold Schema (`${var.gold_schema}`) | Source Catalog (`${var.source_catalog}`) |
| :--- | :--- | :--- | :--- | :--- |
| **dev_uat_source** | `connected_plant_dev` | `silver_dev` | `gold_dev` | `connected_plant_uat` |
| **dev_sample** | `connected_plant_dev` | `silver_dev` | `gold_dev` | `connected_plant_dev` |
| **uat** | `connected_plant_uat` | `silver` | `gold` | `connected_plant_uat` |
| **prod** | `connected_plant_prod` | `silver` | `gold` | `connected_plant_prod` |

---

## 1. Check pipeline health

```bash
# Get pipeline IDs (after first deploy)
databricks pipelines list --profile DEFAULT | grep "Connected Plant"

# Get current state
databricks pipelines get --pipeline-id <id> --profile DEFAULT
```

- **Silver Pipeline**: Healthy state is `RUNNING` (runs continuously). Alert states are `FAILED`, `IDLE` (unexpected stop).
- **Gold Pipeline**: Healthy state is `COMPLETED` after a successful run. Alert state is `FAILED`.

---

## 2. Flow failure (on-update-failure alert)

A single flow (table) failed while the pipeline kept running.

1. Open the pipeline UI → **Event log** → filter by `flow_name` to identify the failing table.
2. Check the error message. Common causes:
   - **Schema evolution** — a new column appeared in bronze/silver. Run a full refresh of that table after acknowledging the change.
   - **Bad SAP data** — an `expect_or_fail` or `expect` warning fired. Check expectation metrics.
   - **Transient Spark error** — retry by clicking **Start** in the UI or using `databricks pipelines start-update`.

---

## 3. Pipeline stopped (on-update-fatal-failure alert)

The entire pipeline has stopped.

```bash
# Restart
databricks pipelines start-update <pipeline-id> --profile DEFAULT
```

If restart fails repeatedly, check:
- Source tables exist and are accessible (Bronze for Silver, Silver for Gold).
- No breaking schema change that requires a full refresh (see §4).
- Cluster/serverless availability in the workspace.

---

## 4. Schema migration (incompatible change)

Streaming Tables cannot evolve incompatibly without a full refresh. Signs: pipeline fails with `AnalysisException: incompatible schema`.

**Procedure:**
1. Deploy the updated pipeline code.
2. For the affected table only, trigger a selective full refresh:
   ```bash
   databricks pipelines start-update <pipeline-id> \
     --full-refresh-selection <table_name> --profile DEFAULT
   ```
3. Monitor the refresh. Data for the affected table will be rebuilt from scratch — downstream queries will see gaps during this window.

**Do not** run a full pipeline refresh unless all tables need rebuilding.

---

## 5. Dev schema isolation

The dev targets write to `connected_plant_dev` to prevent production database impacts.
*Note:* `dev_uat_source` reads from the `connected_plant_uat` bronze source as a temporary compromise; `dev_sample` reads from `connected_plant_dev.sap_sample`.

To isolate dev bronze once available:
1. Update `source_catalog` / `source_schema` variables for the relevant dev target in `databricks.yml`.
2. Re-deploy dev: `databricks bundle deploy -t dev_uat_source` or `databricks bundle deploy -t dev_sample`.

---

## 6. Plant access row filter

### Silver Layer
The Unity Catalog row filter (`plant_access_filter`) must be applied after the first deployment to each environment target. Run the target-specific SQL script once as a Unity Catalog admin:

- **Development**:
  ```bash
  databricks sql execute --warehouse-id <warehouse-id> \
    --statement "$(cat resources/sql/row_filter_dev.sql)" --profile DEFAULT
  ```
- **UAT**:
  ```bash
  databricks sql execute --warehouse-id <warehouse-id> \
    --statement "$(cat resources/sql/row_filter_uat.sql)" --profile DEFAULT
  ```
- **Production**:
  ```bash
  databricks sql execute --warehouse-id <warehouse-id> \
    --statement "$(cat resources/sql/row_filter_prod.sql)" --profile DEFAULT
  ```

### Gold Layer
No manual SQL script is required for the Gold tables. The row filter is **automatically applied at deploy/refresh time** via the `@dlt.table` configuration properties pointing to `{silver_schema}.plant_access_filter` dynamically.

---

## 7. PP_PI_ORDER_TYPES TODO

`PP_PI_ORDER_TYPES = None` in `silver/dlt_silver_pipeline.py` — all order types are currently included. Once process order types are confirmed with plant operations teams, update this constant and redeploy. A selective full refresh of `process_order` and `process_order_operation` will be required.

---

## 8. Running the Gold Pipeline

Since the Gold pipeline runs in **Triggered (batch)** mode, it should be orchestrated to run periodically (e.g. daily, or immediately following the conclusion of large batch events).

Gold reads from Silver tables that have Unity Catalog row filters applied. Databricks may choose full refresh for materialized views sourced from row-filtered tables, even on serverless. After first deployment, compare Gold update duration and input rows across several runs before increasing schedule frequency.

To run the Gold pipeline manually:
```bash
databricks pipelines start-update <gold-pipeline-id> --profile DEFAULT
```
Alternatively, schedule it using a Databricks Job task referencing `${resources.pipelines.gold_pipeline.id}`.
