# Trace Native — Architecture Check

**Date:** 2026-05-17  
**Status:** Adapter implemented; routes NOT wired to Databricks — all slices DEFERRED pending DDL verification.  
**References:**
- `docs/migration/trace-native-batch-header-lineage-plan.md`
- `docs/audit/trace-native-column-verification-checklist.md`
- `ADR-024` (`docs/adr/ADR-024-native-databricks-data-access-architecture.md`)

---

## Architecture Guardrail Checks

### No new workspaces

- [x] Confirmed — Trace Investigation uses its existing workspace. No new workspaces added.

### No broad APIs

- [x] Confirmed — only narrowly scoped batch-header, trace-graph, and mass-balance routes are planned. No unauthenticated endpoints. No aggregated governance APIs.

### No SQL in React components

- [x] Confirmed — no SQL in any React component. All SQL lives exclusively in QuerySpec factories in `apps/api/adapters/trace2/trace2_databricks_adapter.py`.

### No SQL in FastAPI route handlers

- [x] Confirmed — current Trace routes (`apps/api/routes/trace2.py`) contain only V1 proxy logic. When Databricks routes are wired, they must call `run_query()` (from `routes/_databricks.py`) — no inline SQL.

### QuerySpec used for native SQL

- [x] Confirmed — three QuerySpec factories exist:
  - `get_batch_header_summary_spec` — `trace2.get_batch_header_summary`
  - `get_trace_graph_spec` — `trace2.get_trace_graph`
  - `get_mass_balance_spec` — `trace2.get_mass_balance`

### QueryExecutor used for execution (via run_query)

- [x] Confirmed — when routes are wired, they will use `run_query(spec_factory, identity, host, warehouse_id)` from `routes/_databricks.py`. `QueryExecutor` is the only execution path. No alternative paths.

### OAuth required

- [x] Confirmed — `run_query` delegates to `QueryExecutor.execute(spec, identity)` which calls `require_user_oauth()`. Missing OAuth raises `DatabricksAuthRequiredError` → HTTP 401.

### No SPN/PAT fallback

- [x] Confirmed — no service-principal credentials in `app.yaml` or any route. Only end-user OAuth is used. This rule holds for all future Trace routes.

### No silent fallback from databricks-api to mock

- [x] Confirmed — when `BACKEND_ADAPTER_MODE=databricks-api`, Trace routes must return appropriate HTTP error codes on failure. They must not fall back to mock data or legacy-api on Databricks errors.

### No recursive Trace traversal

- [x] Confirmed — `get_trace_graph_spec` implements depth=1 only. It is a flat SELECT of direct lineage rows. No recursive CTEs. No multi-hop graph expansion. Recursive traversal is explicitly deferred.

### Source headers accurate

- [x] Confirmed — when routes are wired, they must return:
  - `X-Data-Source: databricks-api`
  - `X-Adapter-Mode: databricks-api`
  - `X-Query-Name: trace2.<spec_name>`

### Existing browser-verified routes preserved

- [x] Confirmed — existing `POST /api/trace2/batch-header` V1 proxy is unchanged. POH and CQ routes are not touched.

### CQ Lab failures remains blocked

- [x] Confirmed — `GET /api/cq/lab/fails` not touched. Still blocked on `vw_gold_process_order_plan`.

---

## DDL-Gated Implementation Status

| Slice | QuerySpec exists | Route wired | DDL confirmed | Implement decision |
|---|---|---|---|---|
| `getBatchHeaderSummary` | ✓ (with 6 TODOs) | No | No — `gold_batch_summary_v` columns unverified | DEFERRED |
| `getTraceGraph` (depth=1) | ✓ (with language_id TODO) | No | No — `gold_material.language_id` filter unverified | DEFERRED |
| `getMassBalanceSummary` | ✓ (with WHERE TODOs) | No | No — WHERE column names unverified | DEFERRED |
| `getCustomerExposureSummary` | No | No | N/A — business rules missing | DEFERRED |

---

## What Must Be True When Routes Are Wired

When DDL is confirmed and routes are wired, the following must hold:

1. Route checks `BACKEND_ADAPTER_MODE == "databricks-api"` — returns 503 otherwise (no silent fallback).
2. Route uses `run_query(lambda: spec_factory(request), identity, host, warehouse_id)` from `routes/_databricks.py`.
3. Route sets headers via `set_databricks_response_headers(response, spec)`.
4. `TRACE_CATALOG` env var must be set in `app.yaml` (or the spec factory raises `DatabricksConfigError` → 503).
5. All TODO column names in `trace2_databricks_adapter.py` are replaced with confirmed names.
6. Tests must cover 401/403/429/502/503/504 error paths (follow `test_process_order_routes.py` pattern).
7. No additional mock fallback wiring in `domain-integrations/traceability/`.

---

## Deferred Work

| Item | Reason |
|---|---|
| Route wiring | DDL verification required first |
| Frontend `Trace2DatabricksApiAdapter` | Not needed until route is wired and browser-verified |
| `getCustomerExposureSummary` | Business rules (severity/recall thresholds) not derivable from gold views |
| Recursive trace graph | Architecture decision required; not in this tranche |
| Mass balance route | WHERE column verification required |
