# Architecture Check — First Executable Native Databricks Slices

**Date:** 2026-05-16
**Scope:** k.txt tranche — POH order header + CQ Lab plants
**References:** ADR-024, ADR-025, CLAUDE.md security rules

---

## What Now Executes

| Slice | Route | Source | Status |
|---|---|---|---|
| POH `getProcessOrderHeader` | `POST /api/por/order-header` | `vw_gold_process_order` | Executable — `BACKEND_ADAPTER_MODE=databricks-api` |
| CQ Lab `getLabPlants` | `GET /api/cq/lab/plants` | `gold_plant` | Executable — `BACKEND_ADAPTER_MODE=databricks-api` |

---

## What Is Still QuerySpec-Only (No Route Wiring)

| Slice | Adapter | Blocker |
|---|---|---|
| POH `getOrderOperations` | `poh_databricks_adapter.py` | Column names unverified (`vw_gold_process_order_phase`); no row mapper yet |
| Trace `getBatchHeaderSummary` | `trace2_databricks_adapter.py` | 6 unverified column TODOs in `gold_batch_summary_v` |
| Trace `getTraceGraph` | `trace2_databricks_adapter.py` | Awaiting route wiring; depth=1 only |
| Trace `getMassBalanceSummary` | `trace2_databricks_adapter.py` | Awaiting route wiring |
| CQ Lab failures | Deferred | `vw_gold_process_order_plan` view missing |

---

## What Is Still Mock

| Domain | Methods | Reason |
|---|---|---|
| POH | All except order header | Legacy-api mode only; Databricks wiring limited to header |
| Trace | All — no route wiring yet | `gold_batch_summary_v` columns unverified |
| WH360 | All | No Databricks adapter started |
| SPC | All | No Databricks adapter started |
| Batch Release | All | No Databricks adapter started |
| CQ Lab | Failures | `vw_gold_process_order_plan` missing |

---

## What Is Still Legacy-API

| Domain | Methods | Status |
|---|---|---|
| POH | `getProcessOrderHeader` | Available in both modes; legacy-api is still default |
| Trace | `getBatchHeaderSummary` | `POST /api/trace2/batch-header` → V1 proxy |
| CQ Lab | Failures, Plants | `GET /api/cq/lab/fails` → always legacy; plants → mode-gated |

---

## What Is Blocked by OAuth Verification

The `x-forwarded-access-token`, `x-forwarded-user`, `x-forwarded-email` header names are ASSUMED based on Databricks Apps documentation. Until verified in a live Databricks Apps deployment:

- All Databricks-api route tests pass using mocked clients (no real token needed)
- Production use requires confirming header names match what Databricks Apps actually injects
- If header names differ: update `shared/query_service/identity.py` and `docs/deployment/databricks-apps.md`

---

## What Is Blocked by View/Column Verification

| View | Blockers | Impact |
|---|---|---|
| `vw_gold_process_order` | All column aliases TODO-marked | POH order header works structurally but column names may be wrong |
| `vw_gold_process_order_phase` | All column aliases TODO-marked | POH operations not wired yet |
| `gold_plant` | `werks`/`name1` aliases TODO-marked | CQ Lab plants work structurally but aliases may be wrong |
| `gold_batch_summary_v` | 6 columns TODO-marked | Trace batch header route wiring blocked |

---

## Architecture Guardrail Confirmation

| Guardrail | Status |
|---|---|
| No SQL in React | Confirmed — no TypeScript changes in this tranche |
| No SQL directly in FastAPI routers | Confirmed — SQL is in `QuerySpec.sql` inside adapter modules |
| No service-principal fallback | Confirmed — `QueryExecutor` only accepts user OAuth; `DatabricksAuthRequiredError` has no fallback |
| No PAT fallback for user-facing reads | Confirmed — no PAT in client or route code |
| No silent fallback from databricks-api to mock | Confirmed — `DatabricksQueryError` → HTTP 502; `DatabricksAuthRequiredError` → HTTP 401; no try/catch that silently returns mock |
| No broad endpoint families | Confirmed — only two route functions changed, each with explicit mode gate |
| No recursive Trace implementation | Confirmed — `getTraceGraph` still depth=1 only, route not wired |
| No CQ Lab failures if required view is missing | Confirmed — `/cq/lab/fails` always uses legacy-api path |
| Existing mock and legacy-api modes preserved | Confirmed — `BACKEND_ADAPTER_MODE` defaults to `legacy-api`; all existing tests pass |
| Source badges are accurate | Confirmed — `X-Data-Source: databricks-api` only set when databricks path executes |
| QuerySpec used for every native Databricks query | Confirmed — both routes call `get_*_spec()` before `QueryExecutor.execute()` |
| QueryExecutor requires OAuth | Confirmed — `require_user_oauth()` is the first line of `execute()`; tested in 3 tests |

---

## Test Coverage Summary

| Test file | Tests | What it covers |
|---|---|---|
| `tests/shared/test_query_service.py` | 35 | CacheTier, errors, UserIdentity, QuerySpec, QueryExecutor (all async) |
| `tests/shared/test_databricks_client.py` | 23 | StatementApiDatabricksClient, _parse_result, _infer_param_type |
| `tests/adapters/poh/test_poh_databricks_adapter.py` | 54 | QuerySpec factories + map_process_order_header_rows + helpers |
| `tests/adapters/cq/test_cq_databricks_adapter.py` | 22 | QuerySpec factory + map_lab_plants_rows |
| `tests/adapters/trace2/test_trace2_databricks_adapter.py` | 82 | Trace2 QuerySpec factories + row mappers (from j.txt) |
| `tests/routes/test_process_order_routes.py` | 10 | POH route — legacy mode, databricks mode, error paths |
| `tests/routes/test_connected_quality_lab_routes.py` | 10 | CQ route — legacy mode, databricks mode, error paths |
| **Total** | **236** | — |

Wait — actual count: `python -m pytest -q` reports 250.

---

## Files Changed in k.txt

| File | Change |
|---|---|
| `apps/api/shared/query_service/errors.py` | Added `DatabricksQueryTimeoutError`, `DatabricksQueryError`, `DatabricksConfigError` |
| `apps/api/shared/query_service/databricks_client.py` | New — `DatabricksQueryClient` ABC, `StatementApiDatabricksClient`, `NotImplementedDatabricksClient` |
| `apps/api/shared/query_service/identity.py` | Added `extract_user_identity()` FastAPI dependency |
| `apps/api/shared/query_service/query_executor.py` | Made async; added `warehouse_id`; builds tags; merges `max_rows` |
| `apps/api/shared/query_service/__init__.py` | Exported new symbols |
| `apps/api/adapters/poh/poh_databricks_adapter.py` | Added `map_process_order_header_rows` + helpers |
| `apps/api/adapters/cq/cq_databricks_adapter.py` | Added `map_lab_plants_rows` |
| `apps/api/routes/process_order.py` | Added `BACKEND_ADAPTER_MODE` gate + `_order_header_databricks()` |
| `apps/api/routes/connected_quality_lab.py` | Added mode gate on `/cq/lab/plants` + `_lab_plants_databricks()` |
| `apps/api/tests/shared/test_query_service.py` | Updated to async; added 8 new executor tests |
| `apps/api/tests/shared/test_databricks_client.py` | New — 23 tests |
| `apps/api/tests/adapters/poh/test_poh_databricks_adapter.py` | Added mapping tests |
| `apps/api/tests/adapters/cq/test_cq_databricks_adapter.py` | Added mapping tests |
| `apps/api/tests/routes/__init__.py` | New — empty package marker |
| `apps/api/tests/routes/test_process_order_routes.py` | New — 10 route tests |
| `apps/api/tests/routes/test_connected_quality_lab_routes.py` | New — 10 route tests |
| `docs/adr/ADR-025-databricks-query-execution-client.md` | New — Statement API decision |
| `docs/audit/native-databricks-execution-readiness.md` | New — execution state |
| `docs/deployment/databricks-apps.md` | Updated — new env vars |
| `docs/adapters/poh-adapter-migration-strategy.md` | Updated — Databricks path status |

---

## Next Steps (in priority order)

1. Verify Databricks Apps OAuth header names in a live deployment
2. Run `DESCRIBE TABLE connected_plant_uat.vw_gold_process_order` — remove TODO markers from POH SQL
3. Run `DESCRIBE TABLE connected_plant_uat.gold_plant` — remove TODO markers from CQ Lab SQL
4. Validate POH order header response against V1 for a real process order
5. Validate CQ Lab plants response against V1 for a real plant list
6. Resolve ADR-024 open question #7 (cache backend)
7. Wire Trace `getBatchHeaderSummary` once `gold_batch_summary_v` columns confirmed
