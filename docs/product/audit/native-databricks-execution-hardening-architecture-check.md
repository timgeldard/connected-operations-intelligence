# Native Databricks Execution Hardening — Architecture Check

**Date:** 2026-05-17
**Tranches:** l.txt — Native Databricks Execution Hardening and Verification Readiness; m.txt — V1/V2 Databricks Config Reconciliation
**Reference:** ADR-024, ADR-025

This document confirms that the hardening tranche preserved all architecture guardrails defined in ADR-024 and the project CLAUDE.md.

---

## Guardrail confirmations

### No SQL in React

**Status: CONFIRMED**

No SQL strings exist in any TypeScript/React file. All SQL is in Python QuerySpec factories under `apps/api/adapters/`. React receives only typed data contract objects.

### No SQL directly in FastAPI routers

**Status: CONFIRMED**

`apps/api/routes/process_order.py` and `apps/api/routes/connected_quality_lab.py` contain zero SQL. They call `get_process_order_header_spec()` and `get_lab_plants_spec()` from the adapter layer and pass the resulting `QuerySpec` to `QueryExecutor`. SQL lives in `apps/api/adapters/poh/poh_databricks_adapter.py` and `apps/api/adapters/cq/cq_databricks_adapter.py`.

### No service-principal fallback

**Status: CONFIRMED**

`QueryExecutor.execute()` calls `identity.require_user_oauth()` as the first operation. If the token is absent, `DatabricksAuthRequiredError` is raised immediately — no SPN credential is read, no environment variable `DATABRICKS_CLIENT_ID` or `DATABRICKS_CLIENT_SECRET` is accessed. Verified by test `test_does_not_read_service_principal_env_vars` in `test_query_service.py`.

### No PAT fallback for production reads

**Status: CONFIRMED**

`StatementApiDatabricksClient.execute()` accepts `oauth_token` as an explicit parameter. It does not read any PAT or static credential from environment variables. The only credential path is the caller-supplied OAuth token.

### No silent fallback from databricks-api to mock

**Status: CONFIRMED**

Routes with `BACKEND_ADAPTER_MODE=databricks-api` raise `HTTPException` on any Databricks error — they do not return mock data. Verified by `test_does_not_fall_back_to_legacy_on_query_error` and `test_does_not_fall_back_on_databricks_error` in the route test files.

### No broad endpoint families added

**Status: CONFIRMED**

This tranche adds one diagnostic endpoint (`GET /api/diagnostics/auth-headers`) which is gated by `ENABLE_AUTH_DIAGNOSTICS=true` and returns 404 when disabled. No domain endpoint families were added.

### No new domain slices beyond hardening the first two

**Status: CONFIRMED**

No new QuerySpec factories were added. No new FastAPI proxy routes for domain data were created. The tranche hardened the existing POH and CQ Lab slices only.

### No recursive Trace implementation

**Status: CONFIRMED**

No Trace QuerySpec or route wiring was added in this tranche.

### Existing mock and legacy-api modes preserved

**Status: CONFIRMED**

- `BACKEND_ADAPTER_MODE=legacy-api` (default) still proxies to V1 for both POH and CQ Lab routes. The `_forward_post()` and `_forward_get()` functions are unchanged.
- Mock data in domain-integration adapters is untouched.
- `_V1_BASE_URL` and `_V1_CQ_BASE_URL` module-level vars remain; routes read `BACKEND_ADAPTER_MODE` at request time.

### Source headers and badges accurate

**Status: CONFIRMED**

All successful databricks-api responses now set three headers via `set_databricks_response_headers()`:
- `X-Data-Source: databricks-api` — matches `spec.source_badge`
- `X-Adapter-Mode: databricks-api`
- `X-Query-Name: <spec.name>`

Legacy-api responses do not set these headers (V1 response is returned as-is).

### QuerySpec used for every native Databricks query

**Status: CONFIRMED**

Both implemented slices (`poh.get_process_order_header`, `cq.get_lab_plants`) are backed by `QuerySpec` objects. The `QueryExecutor` only accepts `QuerySpec` inputs — no raw SQL can be passed through it.

### QueryExecutor requires OAuth

**Status: CONFIRMED**

`QueryExecutor.execute()` calls `identity.require_user_oauth()` before any client interaction. See `apps/api/shared/query_service/query_executor.py`.

### Diagnostics do not expose tokens

**Status: CONFIRMED**

`GET /api/diagnostics/auth-headers` returns only:
- `token_present: bool`
- `token_length_bucket: "absent" | "short" | "medium" | "long"`
- `user_header_present: bool`
- `email_header_present: bool`
- `path: string`
- `warning: string`

The raw token value is never included. Verified by test `test_raw_token_never_in_response` in `test_auth_diagnostics_routes.py`.

---

## m.txt guardrail confirmations

### Catalog env vars read at request time (not import time)

**Status: CONFIRMED**

`resolve_domain_object()` reads `os.environ` inside the function body, not at module level. Env var changes (including `monkeypatch` in tests) are reflected immediately. Verified by `test_reads_env_var_at_call_time` in `test_object_resolver.py`.

### Object names are code constants — not user-supplied

**Status: CONFIRMED**

`object_name` in `resolve_domain_object()` is always a string literal passed by the adapter factory (e.g. `"vw_gold_process_order"`, `"gold_plant"`). Request parameters never reach the object resolver. Verified by `test_object_name_from_code_constant_not_user_input` in `test_object_resolver.py`.

### All identifiers backtick-quoted

**Status: CONFIRMED**

`qualify_object()` wraps catalog, schema, and object name in backticks. No identifier is interpolated without quoting. Verified by `test_backtick_quotes_all_parts` in `test_object_resolver.py`.

### Missing catalog raises DatabricksConfigError → HTTP 503

**Status: CONFIRMED**

Missing `POH_CATALOG`, `CQ_CATALOG` (with no `TRACE_CATALOG` fallback), or `TRACE_CATALOG` all raise `DatabricksConfigError`. Both `routes/process_order.py` and `routes/connected_quality_lab.py` catch `DatabricksConfigError` and return HTTP 503. Verified by `test_returns_503_when_poh_catalog_missing` and `test_returns_503_when_cq_catalog_missing` in the respective route test files.

### Legacy-api mode does not require catalog env vars

**Status: CONFIRMED**

`BACKEND_ADAPTER_MODE=legacy-api` routes never call the spec factory. `POH_CATALOG` and `CQ_CATALOG` are not read in legacy mode. Verified by `test_legacy_api_mode_does_not_require_poh_catalog` and `test_legacy_api_mode_does_not_require_cq_catalog`.

### CQ lab plants uses confirmed V1 column names

**Status: CONFIRMED**

`get_lab_plants_spec()` uses `PLANT_ID` and `PLANT_NAME` (not SAP `werks`/`name1`). Columns confirmed from V1 source. SQL qualifies the table as `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` matching the V1 query exactly.

### CQ_CATALOG fallback to TRACE_CATALOG preserved

**Status: CONFIRMED**

`resolve_domain_object("cq", ...)` falls back to `TRACE_CATALOG` when `CQ_CATALOG` is unset, matching V1 behaviour (`os.environ.get("CQ_CATALOG", os.environ.get("TRACE_CATALOG", ""))`). Verified by `test_cq_catalog_falls_back_to_trace_catalog` in `test_object_resolver.py`.

---

## Changes made in this tranche

### New error classes (errors.py)

| Class | HTTP mapping | Trigger |
|-------|-------------|---------|
| `DatabricksPermissionError` | 403 | Statement API returns HTTP 403 |
| `DatabricksRateLimitError` | 429 | Statement API returns HTTP 429 |
| `DatabricksWarehouseConfigError` | 503 | Statement API returns HTTP 404 (warehouse not found) |

### databricks_client.py hardening

- **Host normalisation:** `StatementApiDatabricksClient.__init__()` strips `https://` or `http://` scheme if present, leading/trailing whitespace, and trailing slashes. The URL is reconstructed with explicit `https://` in `execute()`. Prevents double-scheme URLs when `DATABRICKS_HOST` is set with the prefix.
- **None param guard:** `_infer_param_type(None)` raises `ValueError` instead of returning `"STRING"`. Prevents the string literal `"None"` from reaching SQL.
- **403/404/429 mapping:** New `DatabricksPermissionError`, `DatabricksWarehouseConfigError`, `DatabricksRateLimitError` raised on the corresponding HTTP status codes.

### query_executor.py hardening

`tags["cache_policy"]` and `tags["source_badge"]` are set after the `spec.tags` loop to prevent spec tags from overriding these reserved keys.

### Route helpers (routes/_databricks.py)

`require_databricks_config()` and `set_databricks_response_headers()` extracted as a shared module to avoid duplicating config check and header-setting logic across POH and CQ Lab routes.

### app.yaml

- `BACKEND_ADAPTER_MODE: legacy-api` added as a literal value (safe default).
- `DATABRICKS_HOST` and `SQL_WAREHOUSE_ID` documented as commented-out `valueFrom: scope/key` entries for when `databricks-api` mode is activated (Databricks Apps requires string form, not nested YAML dicts).
- `ENABLE_AUTH_DIAGNOSTICS` documented as a commented-out option for the diagnostic endpoint.

---

## Remaining live-verification blockers

1. **OAuth header names** — `x-forwarded-access-token`, `x-forwarded-user`, `x-forwarded-email` are assumed. Must be confirmed in a live Databricks Apps deployment using `GET /api/diagnostics/auth-headers`.
2. **Column names** — All SQL column aliases in `poh_databricks_adapter.py` and `cq_databricks_adapter.py` are marked TODO. Must be confirmed via `DESCRIBE TABLE` before production use.
3. **Unity Catalog access** — The SQL Warehouse used for queries must have SELECT grants on `connected_plant_uat.vw_gold_process_order` and `connected_plant_uat.gold_plant` for the user identity being forwarded.
4. **V1 network connectivity** — Firewall/private link rules for Databricks Apps → V1 backends have not been tested.

---

## Tests added in this tranche

| Test file | New tests |
|-----------|-----------|
| `tests/shared/test_databricks_client.py` | Host with `https://` normalised; host with `http://` normalised; host without scheme preserved; whitespace stripped; None raises ValueError; 403 → DatabricksPermissionError; 404 → DatabricksWarehouseConfigError; 429 → DatabricksRateLimitError; OAuth token not in log records |
| `tests/shared/test_query_service.py` | `cache_policy` and `source_badge` in tags |
| `tests/routes/test_process_order_routes.py` | `X-Adapter-Mode` header; `X-Query-Name` header |
| `tests/routes/test_connected_quality_lab_routes.py` | `X-Adapter-Mode` header; `X-Query-Name` header |
| `tests/routes/test_auth_diagnostics_routes.py` | 12 new tests covering disabled/enabled states, token safety, length buckets |

**Total tests after tranche:** 276 (all passing).
