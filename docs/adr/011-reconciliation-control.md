# ADR 011 — SAP→Silver→Gold reconciliation control

## Status
Accepted

## Context
The platform had **no control proving outputs tie back to the SAP source**. Per-row
`@dlt.expect` checks exist in Silver (key presence, quantity bounds), but nothing compared
**counts or totals** across bronze → silver → gold. Silent row loss or duplication — e.g. a
mis-scoped filter (the `AUTYP 10→40` bug that would have emptied `process_order`), a CDC
ordering fault, or a Gold join fan-out (the handling-unit gross-weight double-count) — would
ship undetected. For production-critical reporting this is the headline control gap.

## Decision
A standalone **reconciliation job** (`gold/recon/reconciliation_job.py`, deployed as
`resources/reconciliation.job.yml`) that runs after the Gold pipeline and writes two
persisted control tables in the Gold schema.

It is a **job, not a DLT table**, because the bronze source config (`source_catalog`/
`source_schema`) lives in the Silver pipelines — a Gold DLT table cannot read bronze. The file
is under `gold/recon/` so the Gold pipeline glob (`../gold/*.py`, top-level only) ignores it.

### 1. `gold_reconciliation_control` — bronze (SAP) ↔ silver tie-out
For each registered entity it reuses **silver's exact change-data semantics** so the counts can
tie by construction:
- latest record per business key by `sequence_by = (AEDATTM, AERUNID, AERECNO)`;
- a key is **active** unless its latest record is a delete (`RecordActivity = 'D'`);
- everything **as-of the silver watermark** (silver's `max(_replicated_at)`), excluding bronze
  rows silver has not yet ingested.

`bronze_active_keys − dropped_by_dq` (rows silver drops via its key-presence expectations) should
equal `silver_row_count`; the residual is `unexplained_delta`. Control-measure sums (e.g. RESB
`BDMNG` vs `required_quantity`) are reconciled too.

- **`exact`** entities (single bronze streaming source: `reservation_requirement`, `batch_stock`)
  must have `unexplained_delta = 0` and measure delta within tolerance, else `passed = FAIL`.
- **`monitored`** entities (multi-source header+item: `goods_movement`, `outbound_delivery`,
  `warehouse_transfer_order/_requirement`) are recorded only — their grain is the item table but
  deletes/lag arrive on the header side, so an exact tie is not guaranteed. They surface drift
  without false-failing the gate. (Tightening these to exact requires header-aware delete
  handling — tracked as follow-up.)

### 2. `gold_grain_integrity` — gold duplication check
Silver SCD1 keys cannot duplicate (`apply_changes` guarantees one row per key), so the real
silent-duplication risk is **Gold join fan-out**. Each Gold table is asserted to hold one row per
its intended grain: `duplicate_rows = row_count − distinct_grain_keys` must be 0.

### Behaviour
- Both tables are appended per `run_date` (idempotent: clear-then-append today's partition), so
  variances are queryable and trendable over time.
- Any `FAIL` (exact tie-out or gold duplication) raises and **fails the job** (`--fail_on_variance=true`),
  triggering the failure email — variances are detectable, not buried. Set `false` for a soft run.

## Consequences
- Adds a daily job per target (paused until Silver/Gold are populated).
- Run-as principal needs read on bronze/silver and write on the Gold schema; if Gold row filters
  are later enabled, the principal must satisfy `plant_access_filter` (see ADR 005 / Gold RLS) so
  its reconciliation reads are not silently filtered.
- The entity registry is explicit and extensible; multi-source exact tie-out and a true SAP
  **balance** (value) reconciliation for the inventory figure are follow-ups.
