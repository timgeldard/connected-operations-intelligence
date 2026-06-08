# Current State — After Native Databricks Work

**Date:** 2026-05-17  
**Branch:** feat/poh-order-operations-databricks  
**App:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`  
**Status:** RUNNING — `BACKEND_ADAPTER_MODE=databricks-api` active

---

## What Changed

Prior to this work, the only native Databricks read was `getLabPlants` (CQ Lab), browser-verified 2026-05-17. The e.txt and f.txt tranches added:

- `getOrderOperations` — databricks-api route, browser-verified 2026-05-17
- `getOrderConfirmations` — databricks-api route, DDL confirmed, awaiting browser verification
- `getOrderGoodsMovements` — databricks-api route, DDL confirmed, awaiting browser verification
- Three Trace2 QuerySpec factories (`getBatchHeaderSummary`, `getTraceGraph`, `getMassBalanceSummary`) — adapters written, routes NOT wired pending DDL verification
- Architecture guardrail tests (7 classes), POH route tests, Trace adapter tests

---

## Route Status by Tier

### Browser-Verified (databricks-api) — 3 routes

| Route | Method | Adapter method | Source view | Verified |
|---|---|---|---|---|
| `GET /api/cq/lab/plants` | GET | `getLabPlants` | `connected_plant_uat.gold.gold_plant` | 2026-05-17 |
| `POST /api/por/order-header` | POST | `getProcessOrderHeader` | `connected_plant_uat.csm_process_order_history.vw_gold_process_order` | 2026-05-17 — PO 7006965038 |
| `GET /api/por/order-operations` | GET | `getOrderOperations` | `connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase` | 2026-05-17 — 11 operations for PO 7006965038 |

### Executable (DDL confirmed, route wired, not browser-verified) — 2 routes

| Route | Method | Adapter method | Source view | Confirmed |
|---|---|---|---|---|
| `GET /api/por/order-confirmations` | GET | `getOrderConfirmations` | `connected_plant_uat.csm_process_order_history.vw_gold_confirmation` | DDL confirmed 2026-05-17 |
| `GET /api/por/order-goods-movements` | GET | `getOrderGoodsMovements` | `connected_plant_uat.csm_process_order_history.vw_gold_adp_movement` | DDL confirmed 2026-05-17 |

**Missing fields (by design — not in view):**
- `vw_gold_confirmation`: `operationText`, `isFinalConfirmation` — schema fields relaxed to optional
- `vw_gold_adp_movement`: `materialDescription` — no material master join; `direction: 'unknown'` for MOVEMENT_TYPE 711/712/999/null

### QuerySpec-Only (adapter written, route NOT wired) — 3 slices

| Adapter method | Views used | Blocker |
|---|---|---|
| `getBatchHeaderSummary` | `gold_batch_stock_v` (confirmed), `gold_batch_summary_v` (NOT verified), `gold_material` (language_id NOT verified), `gold_plant` (assumed) | 6 TODOs in `gold_batch_summary_v`; language_id filter value unverified |
| `getTraceGraph` (depth=1) | `gold_batch_lineage` (confirmed), `gold_material` (language_id NOT verified), `gold_plant` (assumed) | `gold_material.language_id` — column may not exist or value `'EN'` may be wrong |
| `getMassBalanceSummary` | `gold_batch_mass_balance_v` (SELECT confirmed; WHERE NOT verified) | WHERE filter column names unverified — unfiltered query risk |

Adapter file: `apps/api/adapters/trace2/trace2_databricks_adapter.py`  
DDL verification required before wiring — see `docs/audit/trace-native-column-verification-checklist.md`

### Wired Legacy-Api (V1 proxy, NOT browser-verified) — 3 routes

All return 503 while V1 apps are STOPPED.

| Route | Adapter method | Blocker |
|---|---|---|
| `POST /api/trace2/batch-header` | `getBatchHeaderSummary` (V1 proxy only) | V1 STOPPED; no databricks-api gate wired |
| `POST /api/wh360/warehouse-summary` | `getWarehouse360Summary` (V1 proxy only) | V1 STOPPED; no databricks-api gate wired |
| `GET /api/cq/lab/fails` | `getLabFailures` (V1 proxy only; databricks-api blocked) | V1 STOPPED; `vw_gold_process_order_plan` does not exist |

### Mock-Only — 74 adapter methods

All remaining adapter methods across all domains return typed mock data. No FastAPI routes exist for these methods. See `docs/audit/adapter-source-status-matrix.md` for the per-method breakdown.

---

## Known View Field Gaps

These gaps are design constraints of the current gold views, not implementation bugs. They are documented here so future work can re-require the fields when richer views become available.

| View | Missing field | Impact | When to re-require |
|---|---|---|---|
| `vw_gold_process_order` | `orderType`, `plannedQuantity`, `confirmedQuantity`, `uom`, `plannedStart`, `plannedFinish`, `batchId`, `productionLine` | POH order header shows minimal fields | When view is enriched or richer view confirmed |
| `vw_gold_process_order_phase` | `workCentre`, `plannedStart`, `plannedFinish`, `plannedDurationMinutes`, `actualStart`, `actualFinish`, `resource` | Operation dates/durations absent; status inferred from `START_USER`/`END_USER` | When richer operations view confirmed |
| `vw_gold_confirmation` | `operationText`, `isFinalConfirmation` | Confirmation panels show no operation label or finality flag | When view adds description and flag columns |
| `vw_gold_adp_movement` | `materialDescription` | Goods movement rows show material ID only | When view adds material master join |

---

## Testing Infrastructure State

| Component | Count | Notes |
|---|---|---|
| Architecture guardrail tests | 7 test classes | No SQL in routes, no SPN/PAT, no mock fallback, no SQL in React, QuerySpec object qualification, no raw token logging, CQ lab fails deferred |
| POH route tests | — | Covers all 4 POH routes; tests 401/403/429/502/503/504 paths per route |
| Trace2 adapter tests | — | Tests QuerySpec factories and row mappers for 3 slices |
| CQ lab tests | — | getLabPlants and architecture checks |
| Total passing | — | All tests pass on current branch |

---

## Known Blockers

| Blocker | Affects | Resolution |
|---|---|---|
| `vw_gold_process_order_plan` does not exist | `getLabFailures` databricks-api | Data team must create view; no workaround |
| `gold_batch_summary_v` DDL unverified (6 column TODOs) | `getBatchHeaderSummary` native route | Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_summary_v` |
| `gold_material.language_id` filter unverified | `getBatchHeaderSummary`, `getTraceGraph` native routes | Run `SELECT DISTINCT language_id FROM connected_plant_uat.gold.gold_material LIMIT 20` |
| `gold_batch_mass_balance_v` WHERE columns unverified | `getMassBalanceSummary` native route | Run `DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v` |
| WH360 catalog_override not implemented | WH360 databricks-api migration | `wh360` schema requires separate catalog qualification not yet in QueryExecutor |
| V1 apps STOPPED | All legacy-api proxy routes | V1 restart required for legacy-api verification |

---

## Immediate Next Action

Browser-verify `GET /api/por/order-confirmations` and `GET /api/por/order-goods-movements` against process order `7006965038` in UAT. Both routes are wired and DDL-confirmed — zero implementation work required.

See `docs/deployment/browser-verification-backlog.md` for the full verification queue.
