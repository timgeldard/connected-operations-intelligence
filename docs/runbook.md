# Operational Runbook — Connected Plant Silver Pipeline

## Pipeline identity

| Item | Value |
|---|---|
| Bundle name | `connected-plant-silver` |
| Target (prod) | `connected_plant_uat.silver` |
| Mode | Continuous |
| Notifications | Configure in `resources/silver_pipeline.pipeline.yml` |

---

## 1. Check pipeline health

```bash
# Get pipeline ID (after first deploy)
databricks pipelines list --profile DEFAULT | grep "Connected Plant"

# Get current state
databricks pipelines get --pipeline-id <id> --profile DEFAULT
```

Healthy states: `RUNNING` (continuous mode). Alert states: `FAILED`, `IDLE` (unexpected stop).

---

## 2. Flow failure (on-update-failure alert)

A single flow (table) failed while the pipeline kept running.

1. Open the pipeline UI → **Event log** → filter by `flow_name` to identify the failing table.
2. Check the error message. Common causes:
   - **Schema evolution** — a new column appeared in bronze. Run a full refresh of that table after acknowledging the change.
   - **Bad SAP data** — an `expect_or_fail` fired (none currently set, but be aware). Check expectation metrics.
   - **Transient Spark error** — retry by clicking **Start** in the UI or using `databricks pipelines start-update`.

---

## 3. Pipeline stopped (on-update-fatal-failure alert)

The entire pipeline has stopped.

```bash
# Restart
databricks pipelines start-update <pipeline-id> --profile DEFAULT
```

If restart fails repeatedly, check:
- Bronze source tables exist and are accessible.
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
3. Monitor the refresh. Data for the affected table will be rebuilt from scratch — downstream Gold queries will see gaps during this window.

**Do not** run a full pipeline full refresh unless all tables need rebuilding — this is time-consuming and causes widespread downstream gaps.

---

## 5. Dev bronze isolation

The dev target (`silver_dev`) currently reads from the same UAT bronze as production. This is intentional until a dev bronze is provisioned. See `docs/adr/004-bronze-source-parameterization.md`.

To add dev bronze isolation once available:
1. Add `source_catalog` / `source_schema` overrides to the `dev` target in `databricks.yml`.
2. Deploy dev: `databricks bundle deploy -t dev`.

---

## 6. Plant access row filter

The Unity Catalog row filter (`plant_access_filter`) must be applied after the first prod deploy. Run `resources/row_filter.sql` once as a Unity Catalog admin:

```bash
databricks sql execute --warehouse-id <warehouse-id> \
  --statement "$(cat resources/row_filter.sql)" --profile DEFAULT
```

---

## 7. PP_PI_ORDER_TYPES TODO

`PP_PI_ORDER_TYPES = None` in `silver/dlt_silver_pipeline.py` — all order types are currently included. Once process order types are confirmed with plant operations teams, update this constant and redeploy. A selective full refresh of `process_order` and `process_order_operation` will be required.
