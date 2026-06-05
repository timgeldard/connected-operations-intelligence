# ADR 006 — Daily warehouse snapshots

## Status
Accepted

## Context
The warehouse Gold layer is **current-state only**: tables such as
`gold_transfer_requirement_backlog`, `gold_bin_occupancy`, `gold_stock_reconciliation`,
`gold_warehouse_exceptions` and `gold_warehouse_kpi_snapshot` are Declarative-Pipeline
materialized views that **recompute on every refresh and keep no history**. The
warehouse-operations data product needs trends — backlog ageing, occupancy over time,
exception burn-down, KPI movement — which current-state MVs cannot provide.

## Decision
Add history by **appending the current state** of selected current-state Gold tables to
`<table>_snapshot` companions, partitioned by `snapshot_date`.

- **Mechanism: a scheduled job running `INSERT … SELECT CURRENT_DATE(), *`** — *not* a
  DLT materialized view (which would recompute and discard history) and *not* a streaming
  table (there is no event stream to consume — the source is a recomputed MV). The job is
  `gold/snapshots/warehouse_snapshot.py`, wired as a triggered serverless job in
  `resources/warehouse_snapshot.job.yml`.
- **Idempotency:** the job clears the current day's partition before appending, so a
  re-run replaces (not duplicates) today's snapshot.
- **Schedule:** daily 02:00 UTC, **paused by default**; unpause per target once the Gold
  tables are populated.
- **Retention:** default **400 days** (~13 months, enabling year-on-year comparison),
  enforced by deleting partitions older than the window. Override via `--retention_days`.
- **Snapshotted tables:** transfer-requirement & dispensary backlog, bin occupancy,
  line-side stock, stock reconciliation, exceptions, KPI snapshot.

## Consequences
- Trend/ageing analysis becomes possible without changing the current-state Gold contracts.
- Storage grows ~linearly with retention; partitioning by `snapshot_date` keeps pruning and
  retention cheap.
- The job depends on the Gold pipeline having run; if Gold is empty a snapshot row set is
  simply empty for that day.
- Snapshot tables are append-only history and are **not** row-filtered (they aggregate Gold,
  which is the trusted layer); plant access is enforced at the Silver/consumption boundary.
