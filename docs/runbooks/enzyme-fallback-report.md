# Runbook — Enzyme Fallback Report (ADR 017 gate 5a)

**Script:** `data-products/io-reporting/scripts/enzyme_fallback_report.py`  
**When to run:** On a quiet day, after the cost-observation baseline is complete (see
memory `cost-observation-period`). Do NOT run during or immediately after a run that
included estate-gate expansions, first-ever materialisations, or forced full-refresh
operations — these inflate COMPLETE_RECOMPUTE share and produce misleading rewrite
candidates.

---

## Purpose

ADR 017 gate 5a requires a per-flow planning-mode distribution and, for flows that fell
back to COMPLETE_RECOMPUTE, the Enzyme-emitted **reason** (from the pipeline event log).
The reason is read directly from the event log — not inferred from SQL shape. This data
drives the flow-rewrite candidate list before any cadence change is armed.

The report output is a tidy table:

| Column | Description |
|---|---|
| `flow_name` | DLT flow / materialized-view name |
| `planning_mode` | Most-recent Enzyme decision: `NO_OP`, `ROW_BASED`, or `COMPLETE_RECOMPUTE` |
| `fallback_reason` | Enzyme-emitted reason (only populated for `COMPLETE_RECOMPUTE`) |
| `rows_affected` | Row count from the planning decision (cost proxy) |
| `last_planning_ts` | Timestamp of the most-recent planning event |

Sorted by recompute cost: COMPLETE_RECOMPUTE rows first, then by `rows_affected` DESC.

---

## Event-log schema (how the report is grounded)

DLT pipeline events are available at:

1. **`system.lakeflow.pipeline_events`** — the Unity Catalog system table (preferred;
   requires system-table access to be granted for the workspace).
2. **`<catalog>.<gold_schema>.event_log`** — the pipeline-local event log Delta table
   (fallback; use `--use-local-event-log` flag).

Relevant event structure for Enzyme planning:

```
event_type: 'flow_progress'
level:      'INFO'
details (JSON):
  flow_progress:
    status: 'RUNNING' | 'COMPLETED' | 'FAILED'
    planning_information:           # only present when Enzyme ran
      planning_mode: 'NO_OP' | 'ROW_BASED' | 'COMPLETE_RECOMPUTE'
      reason: '<string>'            # only present for COMPLETE_RECOMPUTE
      rows_affected: <bigint>       # present for ROW_BASED / COMPLETE_RECOMPUTE
```

The script extracts `details:flow_progress.planning_information.*` using Databricks
SQL's JSON path notation (`:` operator).

---

## Prerequisites

1. The gold pipeline has run at least once since the lookback window start (default: 7 days).
2. Either:
   - System-table access granted: `GRANT SELECT ON system.lakeflow.pipeline_events TO ...`
   - Or the pipeline-local `event_log` table is accessible in the gold schema.
3. The gold pipeline UUID — get it from the Pipelines UI or:
   ```bash
   databricks pipelines list --profile DEFAULT | grep "Gold"
   ```

---

## Running the report

### Option A — Print SQL for manual execution (no tooling required)

```bash
python data-products/io-reporting/scripts/enzyme_fallback_report.py \
    --pipeline-id <gold-pipeline-uuid> \
    --catalog connected_plant_uat \
    --gold-schema gold_io_reporting
```

Paste the printed SQL into the Databricks SQL editor. Run from a warehouse that has
access to `system.lakeflow` (UAT workspace, DEFAULT profile).

### Option B — Execute directly against a SQL warehouse

```bash
pip install databricks-sdk   # if not already installed

python data-products/io-reporting/scripts/enzyme_fallback_report.py \
    --pipeline-id <gold-pipeline-uuid> \
    --catalog connected_plant_uat \
    --gold-schema gold_io_reporting \
    --warehouse-id <sql-warehouse-id> \
    --profile DEFAULT
```

### Option C — Use pipeline-local event log (when system tables unavailable)

```bash
python data-products/io-reporting/scripts/enzyme_fallback_report.py \
    --pipeline-id <gold-pipeline-uuid> \
    --catalog connected_plant_uat \
    --gold-schema gold_io_reporting \
    --use-local-event-log
```

Then in the Databricks SQL editor:
```sql
USE CATALOG connected_plant_uat;
USE SCHEMA gold_io_reporting;
-- paste the printed SQL here
```

---

## Interpreting results

| Planning mode | Meaning | Action |
|---|---|---|
| `NO_OP` | No upstream changes; Enzyme skipped the recompute | Healthy — no action |
| `ROW_BASED` | Enzyme propagated a delta incrementally | Healthy — this is the target state |
| `COMPLETE_RECOMPUTE` | Enzyme could not propagate incrementally; full recompute | Review `fallback_reason` |

**Common COMPLETE_RECOMPUTE reasons (Enzyme):**

- `schema_change` — a column was added/dropped/renamed upstream
- `no_prior_state` — first materialisation (expected once; not a steady-state concern)
- `source_non_cdf` — an upstream source does not have CDF enabled
- `source_full_refresh` — an upstream flow itself was fully recomputed this run
- `configuration_change` — pipeline or table config changed
- `non_incremental_source` — a `dlt.read_stream` that is not a streaming table

A flow is a **rewrite candidate** (ADR 017 decision 1 three-part test) only when:
1. It is **persistently** COMPLETE_RECOMPUTE on quiet days (not just after schema changes), AND
2. It is **material in cost** (high rows_affected and/or long wall-time), AND
3. It is subject to a **genuine sub-15-minute SLA** agreed with pilot floor users.

All three conditions must hold. Satisfying only one or two does not justify a streaming-table
conversion.

**Candidate flows from ADR 017 Consequences** (recheck against quiet-day report):
journey events, SPC subgroup, QM lot tables, event ledger.

---

## Adjusting lookback window

Default lookback is 7 days. For a single-run snapshot use `--lookback-days 1`. For a
longer trend to confirm persistence use `--lookback-days 30`.

---

## Gates for cadence change (ADR 017 decision 5)

This report satisfies gate 5a. The remaining gates before arming the 15-minute triggered
cadence are:

1. ✅ **5a** — quiet-day Enzyme report pulled (this runbook)
2. ⏳ **5b** — per-surface latency SLAs defined with pilot floor users
3. ⏳ **5c** — only then change cadence (arm via `cadence_pause_status: UNPAUSED` per-target)

See `data-products/io-reporting/docs/runbook.md` §ADR 017 — Cadence and Maintenance for
the arming procedure.
