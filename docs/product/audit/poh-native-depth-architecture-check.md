# POH Native Databricks Depth — Architecture Check

**Date:** 2026-05-17  
**Scope:** Operations slice implementation (getOrderOperations)  
**Reference:** ADR-024, `docs/audit/adapter-source-status-matrix.md`

---

## Architecture Guardrails

| Guardrail | Status | Evidence |
|-----------|--------|----------|
| No new workspaces | **PASS** | No new Nx workspace, no new `apps/` directory |
| No broad APIs | **PASS** | One targeted route added: `GET /api/por/order-operations` — scoped to POH, process_order_id param required |
| No SQL in React | **PASS** | `grep -r "SELECT" apps/web/src` — 0 matches |
| No SQL in FastAPI routes | **PASS** | `process_order.py` contains no SQL strings; SQL is in `get_order_operations_spec` in `poh_databricks_adapter.py` |
| QuerySpec used for all native SQL | **PASS** | `poh.get_order_operations` spec in `poh_databricks_adapter.py:get_order_operations_spec` |
| QueryExecutor used for execution | **PASS** | `order_operations()` route calls `executor.execute(spec, identity)` |
| OAuth required | **PASS** | `UserIdentity.require_user_oauth()` called via `QueryExecutor.execute` — missing token raises `DatabricksAuthRequiredError` → 401 |
| No SPN/PAT fallback | **PASS** | No `DATABRICKS_TOKEN`, `client_secret`, or `service_principal` references added |
| No silent fallback from databricks-api | **PASS** | `order_operations()` returns 503 if `BACKEND_ADAPTER_MODE != "databricks-api"` — no path to legacy or mock |
| Source headers accurate | **PASS** | `set_databricks_response_headers(response, spec)` sets `X-Data-Source: databricks-api`, `X-Adapter-Mode: databricks-api`, `X-Query-Name: poh.get_order_operations` |
| Existing browser-verified POH header preserved | **PASS** | `POST /api/por/order-header` route unchanged |
| Existing browser-verified CQ plants preserved | **PASS** | `GET /api/cq/lab/plants` route unchanged |
| CQ Lab failures still blocked | **PASS** | `vw_gold_process_order_plan` still missing; no implementation added |
| Trace recursion not implemented | **PASS** | No changes to `adapters/trace/` |
| SPC/Warehouse not expanded | **PASS** | No changes to SPC or Warehouse adapters |

---

## QuerySpec Compliance Check

`poh.get_order_operations` in `apps/api/adapters/poh/poh_databricks_adapter.py`:

| Requirement | Status |
|-------------|--------|
| Fully-qualified object name via `resolve_domain_object("poh", "vw_gold_process_order_phase")` | **PASS** |
| `process_order_id` is parameter-bound (`:process_order_id`) | **PASS** |
| `LIMIT :max_rows` present | **PASS** |
| SQL column names confirmed from live DDL (2026-05-17) | **PASS** — all 9 columns confirmed |
| `source_badge = "databricks-api"` | **PASS** (QuerySpec default) |
| `cache_policy = CacheTier.PER_USER_60S` | **PASS** |
| No hardcoded catalog/schema strings in SQL | **PASS** — resolved via `object_resolver.py` |
| Endpoint field correct | **PASS** — `/api/por/order-operations` (bug was fixed) |

---

## Row Mapper Compliance Check

`map_order_operations_rows` in `apps/api/adapters/poh/poh_databricks_adapter.py`:

| Requirement | Status |
|-------------|--------|
| Empty input returns empty list | **PASS** |
| Missing optional fields handled safely (`.get()` with defaults) | **PASS** |
| Leading zeros preserved (str conversion, no int cast) | **PASS** |
| No invented data for view-missing fields | **PASS** — `workCentre=""`, `plannedStart=""`, etc. are documented defaults |
| Status inference conservative and documented | **PASS** — based on START_USER/END_USER presence only |
| No SQL in mapper | **PASS** |

---

## Route Compliance Check

`GET /api/por/order-operations` in `apps/api/routes/process_order.py`:

| Requirement | Status |
|-------------|--------|
| Returns 503 if `BACKEND_ADAPTER_MODE != "databricks-api"` | **PASS** |
| Returns 401 on missing OAuth | **PASS** |
| Returns 403 on Databricks permission error | **PASS** |
| Returns 503 on config error | **PASS** |
| Returns 502 on query error | **PASS** |
| Returns 504 on timeout | **PASS** |
| Returns 429 on rate limit | **PASS** |
| No fallback to legacy-api or mock | **PASS** |
| Response headers set | **PASS** — `set_databricks_response_headers` called |
| No raw OAuth token in response body | **PASS** |
| No SQL in route handler | **PASS** |

---

## Frontend Compliance Check

`ProcessOrderReviewLegacyApiAdapter.getOrderOperations` in `domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts`:

| Requirement | Status |
|-------------|--------|
| Falls back to mock if `processOrderId` is missing | **PASS** |
| Uses `credentials: 'include'` for cookie forwarding | **PASS** |
| Maps all required contract fields from response | **PASS** |
| Handles 401 with `unauthorized` error code | **PASS** |
| Handles network errors safely | **PASS** |
| No SQL in frontend | **PASS** |
| TypeScript typecheck passes | **PASS** |

---

## Known Gaps (documented, not defects)

1. `workCentre`, `plannedStart`, `plannedFinish`, `plannedDurationMinutes`, `hasException` not available in `vw_gold_process_order_phase` — returned as empty/zero. Documented in column checklist and mapper docstring.
2. Status inference from START_USER/END_USER is conservative — no direct status column in the view.
3. `getOrderConfirmations` and `getOrderGoodsMovements` deferred — source view DDL not confirmed.
4. Browser verification of `GET /api/por/order-operations` pending.
