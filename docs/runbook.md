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

Each script creates or replaces `plant_access_filter` before applying any table row filters. Do not split the script or run the `ALTER TABLE ... SET ROW FILTER` statements before the function exists.

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
No manual SQL script is required for the Gold tables. Gold row filters are disabled by default (`gold_apply_row_filter=false`) so materialized views can use incremental refresh where Databricks supports it. Run the Gold pipeline as a trusted/admin identity that can read the row-filtered Silver tables; enforce plant-level security for direct Silver consumers.

---

## 7. PP/PI Process Order Scope

`process_order` is restricted to AUFK `AUTYP = '40'`, the PP/PI process-order category (verified against live `connected_plant_uat.sap`; `AUTYP = '10'` returns zero rows in Kerry's configuration). Controlled by `silver.helpers.PP_PI_ORDER_CATEGORY = "40"`. `PP_PI_ORDER_TYPES = None` means no additional AUART allowlist is applied — all type-40 orders are included. Once AUART values are confirmed with plant operations teams, update `PP_PI_ORDER_TYPES` and redeploy. A selective full refresh of `process_order` and `process_order_operation` will be required.

---

## 8. Running the Gold Pipeline

Since the Gold pipeline runs in **Triggered (batch)** mode, use the bundled `gold_refresh_job` to refresh slow Silver domains and then Gold three times daily. The Silver fast pipeline is continuous and is not included as a scheduled job task because continuous pipeline tasks do not naturally complete.

Gold output for production orders and material movements reflects the current state of `silver_fast_pipeline` at job-run time. If the continuous fast pipeline is stopped or lagging, Gold refreshes can complete successfully while aggregating stale fast-domain data.

Gold reads from Silver tables that have Unity Catalog row filters applied, but Gold table row filters are disabled by default. Databricks may choose full refresh for materialized views sourced from row-filtered tables, even on serverless. After first deployment, compare Gold update duration and input rows across several runs before increasing schedule frequency.

To run the Gold pipeline manually:
```bash
databricks pipelines start-update <gold-pipeline-id> --profile DEFAULT
```
The bundled job is paused by default. Enable it after validating target-specific cadence and notification settings.

---

## 9. Data Freshness & Alerting

The Gold pipeline publishes two observability tables on every run:

* `gold_data_freshness_status` — one row per monitored Silver dependency, with
  `latest_replicated_at`, `max_lag_minutes`, SLA, criticality, and status
  (`FRESH`, `STALE`, `NO_DATA`, or `STATIC`).
* `gold_data_health_summary` — rollup of freshness, expectation/event-log ownership,
  storage-type role coverage, process-order staging validation, and stock reconciliation
  exception severity.

### Freshness SLAs

| Dependency group | Examples | SLA |
|---|---|---:|
| Critical operational facts | `goods_movement`, `process_order`, WM transfer orders/requirements, `storage_bin` | 120 minutes |
| Stock facts | `batch_stock`, `stock_at_location`, handling units | 240 minutes |
| Reference/master data | `material`, purchase orders | 1440 minutes |
| Seed/config tables | `movement_type_classification`, role/staging mappings | `STATIC` |

`gold_critical_freshness_gate` fails the Gold update when any **critical** dependency is
`STALE` or `NO_DATA`. This is intentional: critical empty/stale inputs should not produce a
green Gold refresh.

### Triage queries

```sql
SELECT
  table_name,
  domain,
  criticality,
  freshness_status,
  latest_replicated_at,
  round(max_lag_minutes, 1) AS max_lag_minutes,
  freshness_sla_minutes
FROM gold_data_freshness_status
WHERE freshness_status IN ('STALE', 'NO_DATA')
ORDER BY
  CASE criticality WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
  max_lag_minutes DESC;
```

```sql
SELECT *
FROM gold_data_health_summary
ORDER BY
  CASE health_status
    WHEN 'FAIL' THEN 1
    WHEN 'WARN' THEN 2
    WHEN 'EVENT_LOG' THEN 3
    ELSE 4
  END,
  health_area;
```

Use the second query as the source for a Databricks SQL alert or dashboard tile:

* **Alert condition:** any row where `health_status = 'FAIL'`.
* **Warning condition:** any row where `health_status = 'WARN'`.
* **Escalation SLA:** investigate `FAIL` rows before publishing or acting on affected daily KPIs;
  review `WARN` rows during the same operating shift.

For reconciliation-specific failures:

```sql
SELECT
  plant_code,
  warehouse_number,
  mismatch_reason,
  mismatch_severity,
  exception_count,
  abs_delta_quantity_total,
  abs_delta_value_total
FROM gold_stock_reconciliation_summary
WHERE reconciliation_status = 'ACTION_REQUIRED'
ORDER BY abs_delta_value_total DESC;
```

### Escalation

1. If `gold_critical_freshness_gate` fails, identify the blocking table in
   `gold_data_freshness_status`.
2. Check the owning Silver pipeline:
   * fast operational tables → `silver_fast_pipeline`
   * reference/published tables → `silver_slow_pipeline`
   * quality tables → `silver_quality_pipeline`
3. If the Silver pipeline is stopped or failing, restart or remediate it before rerunning Gold.
4. If Silver is healthy but a dependency remains stale, verify upstream replication and the
   `_replicated_at` watermark on the source table.
5. If `gold_data_health_summary.health_area = 'stock_reconciliation'`, open
   `gold_stock_reconciliation_summary` for the plant/warehouse and then drill into
   `gold_stock_reconciliation_exceptions_v2`.
6. If `gold_data_health_summary.health_area = 'storage_type_role_coverage'`, review unmapped storage
   types with the WM config owner before trusting line-side/reconciliation KPIs.
7. For `EVENT_LOG` expectation health, open the Gold pipeline event log and filter by expectation
   name/flow. Expectation metrics are not materialized into a Gold table.

Use the pipeline notification configured in `resources/gold_pipeline.pipeline.yml` for failure
alerts. Treat `FAIL` health rows as immediate triage; `WARN` rows require operational review
before consumers use the affected KPI for plant action.
