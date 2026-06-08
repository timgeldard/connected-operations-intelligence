# Next Native Databricks Candidate Ranking

**Date:** 2026-05-17  
**Basis:** Current adapter state after e.txt and f.txt tranches  
**Reference:** `docs/audit/current-state-after-native-databricks-work.md`, `docs/audit/architecture-risk-register.md`

---

## Ranking Criteria

| Criterion | Weight |
|---|---|
| Implementation already done (code + DDL confirmed) | Highest |
| DDL confirmed (columns verified against live view) | High |
| High user value (primary entry point for a workspace) | High |
| V1 parity available for parallel validation | Medium |
| Low mapping risk (no unverified enum values, filters, or joins) | Medium |
| Unblocked (no missing views, no config gaps) | Prerequisite |

---

## Ranked Candidates

### Rank 1 — Browser-verify `getOrderConfirmations` + `getOrderGoodsMovements` (POH)

**Effort:** Zero implementation — browser test only  
**Status:** Routes wired, DDL confirmed 2026-05-17, tests passing, UAT deployed

| Item | State |
|---|---|
| Route wired | `GET /api/por/order-confirmations`, `GET /api/por/order-goods-movements` |
| DDL confirmed | `vw_gold_confirmation` + `vw_gold_adp_movement` — confirmed 2026-05-17 |
| Tests | Passing (401/403/429/502/503/504 paths covered) |
| Deployment | UAT RUNNING |
| Action required | Run browser test against PO 7006965038; update matrix |

**Why first:** This is not an implementation candidate — it is verification only. No code to write. The only thing blocking "browser-verified" status is the test run itself. This should be done before any other implementation starts.

**Known schema gaps (accepted):**
- `vw_gold_confirmation`: `operationText`, `isFinalConfirmation` absent — optional in schema
- `vw_gold_adp_movement`: `materialDescription` absent — optional in schema; unmapped MOVEMENT_TYPE values return `direction: 'unknown'`

---

### Rank 2 — Verify Trace DDL and wire `getBatchHeaderSummary`

**Effort:** Low (DDL verification manual; route wiring follows POH dual-mode pattern)  
**Status:** QuerySpec exists with 6 TODOs; DDL verification required before wiring  
**Blocks Rank 3 and 4**

| Step | Action |
|---|---|
| 1 | Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_summary_v` — confirm 6 column names |
| 2 | Run `SELECT DISTINCT language_id FROM connected_plant_uat.gold.gold_material LIMIT 20` — confirm `'EN'` is a valid value |
| 3 | Update `get_batch_header_summary_spec` with confirmed column names (replace 6 TODOs) |
| 4 | Wire `POST /api/trace2/batch-header` with databricks-api mode gate (dual-mode: V1 proxy fallback) |
| 5 | Write tests following `test_process_order_routes.py` pattern |
| 6 | Browser-verify against anchor: material_id=000000000020052009, batch_id=0008602411 |

**Why second:** Highest user value in the Trace domain. Primary Trace entry point. Adapter is 80% complete — only column name confirmation blocks it. V1 legacy-api proxy exists for parallel validation (when V1 is restarted).

---

### Rank 3 — Wire `getTraceGraph` (depth=1 direct lineage)

**Effort:** Low — QuerySpec exists; depends on Rank 2 language_id confirmation  
**Status:** QuerySpec exists; route not wired; DDL mostly confirmed (lineage columns confirmed; language_id TODO)  
**Prerequisite:** Rank 2 must complete first (language_id confirmed as part of batch header work)

| Step | Action |
|---|---|
| 1 | Confirm `gold_material.language_id` resolved by Rank 2 |
| 2 | Wire `POST /api/trace2/trace-graph` (databricks-api mode gate; no V1 fallback — mock only previously) |
| 3 | Write tests |
| 4 | Browser-verify after batch header passes |

**Why third:** Core Trace UI — shows direct inputs/outputs for a batch. QuerySpec complete. Only unresolved dependency is the `language_id` filter, which Rank 2 resolves.

---

### Rank 4 — Wire `getMassBalanceSummary`

**Effort:** Low — QuerySpec exists; only WHERE column names blocked  
**Status:** QuerySpec exists; SELECT columns confirmed; WHERE columns unverified  
**Prerequisite:** Manual DDL check for `gold_batch_mass_balance_v` WHERE columns

| Step | Action |
|---|---|
| 1 | Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v` — confirm `material_id` and `batch_id` column names |
| 2 | Update QuerySpec WHERE clause with confirmed names |
| 3 | Wire `POST /api/trace2/mass-balance` |
| 4 | Write tests |
| 5 | Browser-verify |

**Why fourth:** Medium user value. Adapter is nearly complete — only WHERE clause column names block it. Risk if not done: unfiltered query returns all movements across all batches.

---

### Rank 5 — SPC Monitoring (QuerySpec wrapping exercise)

**Effort:** Medium — no adapter yet; 4 MVs to wrap; 9 methods; routes to add  
**Status:** MVs confirmed to exist; no DDL verification run; no adapter or routes  
**Prerequisite:** Run `DESCRIBE TABLE` on all 4 SPC MVs; confirm catalog/schema

**Why fifth:** MVs exist and are likely well-structured (materialised views usually have stable columns). SPC has no V1 adapter in V2, so no legacy-api baseline exists for parallel testing. All 9 methods currently mock-only. High dashboard value.

**Action before starting:** Confirm exact catalog prefix for `spc_correlation_source_mv`, `spc_material_dim_mv`, `spc_plant_material_dim_mv`, `spc_process_flow_source_mv`.

---

### Rank 6 — POH Plan Risk (`getYieldVarianceSummary`)

**Effort:** Low for one method — `metric_yield_daily` may be directly usable  
**Status:** All 9 plan-risk methods are mock-only; no V1 adapter; planning data gold views exist

**Why sixth:** `getYieldVarianceSummary` is the most tractable of the 9 plan-risk methods because `metric_yield_daily` is listed as available. The other 8 methods require planning-data gold views that are less certain. A one-method slice for yield variance could be a low-risk win before the full plan-risk migration.

**Action before starting:** Confirm `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.metric_yield_daily`.

---

### Rank 7 — WH360 (deferred — lowest priority)

**Effort:** High — separate catalog schema (`wh360`), complex 7-UNION exception view, 9 methods, no adapter  
**Status:** 1 legacy-api route wired (not browser-verified); 8 mock-only; V1 STOPPED  
**Prerequisites:**
1. Implement `catalog_override` in `QueryExecutor` for the `wh360` schema
2. Browser-verify the legacy-api route first (`POST /api/wh360/warehouse-summary`) — requires V1 restart
3. Run `DESCRIBE TABLE` on WH360 views

**Why last:** Highest complexity, separate infrastructure requirement, lowest V2 migration priority per ADR-024.

---

### Not Ranked — Permanently or Indefinitely Blocked

| Candidate | Reason |
|---|---|
| `getLabFailures` databricks-api | `vw_gold_process_order_plan` does not exist — data team dependency |
| `getCustomerExposureSummary` | Business rules (severity/recall thresholds) not defined |
| Recursive trace graph (depth > 1) | Explicit architecture prohibition; deferred indefinitely |
| EnvMon, Maintenance, Production Staging, Quality Batch Release | No gold views confirmed; no planning-data source identified |

---

## Summary Table

| Rank | Candidate | Effort | Value | Unblocked? |
|---|---|---|---|---|
| 1 | Browser-verify POH confirmations + goods movements | Minimal | High | **Yes — immediate** |
| 2 | Trace getBatchHeaderSummary (after DDL) | Low | High | Yes (DDL run first) |
| 3 | Trace getTraceGraph depth=1 | Low | High | Yes (after Rank 2) |
| 4 | Trace getMassBalanceSummary | Low | Medium | Yes (DDL run first) |
| 5 | SPC monitoring | Medium | High | Yes (DDL run first) |
| 6 | POH yield variance | Low | Medium | Yes (DDL run first) |
| 7 | WH360 | High | Medium | No (catalog_override gap) |
| — | Lab fails, customer exposure, recursive trace | — | — | No — blocked |
