# Overnight Architecture Consolidation Report

**Date:** 2026-05-17
**Scope:** Architecture consolidation, guardrails, deployment capture, and readiness (overnight tranche)
**Status:** Complete — no live Databricks access required or used

---

## 1. Summary of work completed

This tranche consolidated the V2 architecture for safety and correctness without expanding functional scope. Key outcomes:

- **UAT deployment captured:** V2 RUNNING at its public URL; facts documented.
- **Critical `app.yaml` syntax fix permanently documented:** `valueFrom: scope/key` string form enforced in CLAUDE.md so future agent sessions cannot regress to the broken nested YAML form.
- **Architecture guardrail tests added:** 9 automated tests preventing SPN/PAT usage, SQL-in-routes, SQL-in-React, CQ Lab failures premature implementation, and mock fallback from the databricks-api path.
- **Adapter/source status matrix updated** to reflect UAT deployment state.
- **Smoke-test checklist created** covering all three verification phases.
- **Docs consistency pass** on all files containing old nested `valueFrom` syntax.

---

## 2. Files changed

### New files

| File | Purpose |
|---|---|
| `docs/deployment/uat-deployment-record.md` | Permanent record of UAT deployment facts |
| `docs/deployment/uat-smoke-test-checklist.md` | Three-phase smoke-test checklist (deployment / legacy-api / native) |
| `apps/api/tests/architecture/__init__.py` | Package marker |
| `apps/api/tests/architecture/test_architecture_guardrails.py` | 9 architecture guardrail tests |
| `docs/audit/overnight-architecture-consolidation-report.md` | This document |

### Modified files

| File | Change |
|---|---|
| `CLAUDE.md` | Added permanent `valueFrom: scope/key` format rule with "Wrong:" example |
| `docs/deployment/databricks-apps.md` | Fixed `valueFrom.secretScope` text reference |
| `docs/audit/databricks-apps-oauth-header-verification.md` | Fixed commented YAML example showing old nested syntax |
| `docs/audit/native-databricks-execution-hardening-architecture-check.md` | Fixed text reference to `valueFrom.secretScope` |
| `docs/audit/native-databricks-execution-readiness.md` | Fixed text reference to `valueFrom.secretScope` |
| `docs/audit/v1-v2-databricks-config-reconciliation.md` | Fixed 5 YAML code examples using old nested form; added prominent warning box |
| `docs/audit/adapter-source-status-matrix.md` | Added UAT deployment state section; updated FastAPI Route Inventory with UAT status |

### Already correct (no change needed)

| File | Status |
|---|---|
| `apps/api/app.yaml` | Correct `valueFrom: scope/key` syntax — fixed in prior deployment session |
| `databricks.yml` | Bundle config — committed in prior deployment session |

---

## 3. V1/V2 config alignment findings

Covered in full in `docs/audit/v1-v2-databricks-config-reconciliation.md`. Key points:

- V2 correctly forwards end-user OAuth token as `Authorization: Bearer` to the Databricks Statement API — mirrors V1's `user.raw_token` pattern.
- V2 uses `CQ_CATALOG` with fallback to `TRACE_CATALOG` — consistent with V1 behaviour.
- V2 CQ Lab plants uses `gold` schema override — matches V1's `gold.gold_plant` pattern.
- V1 Lab failures depends on `vw_gold_process_order_plan` — this view does not exist in `csm_process_order_history`. V2 defers CQ Lab failures accordingly.
- V1 used `tbl()` helper for backtick-qualified objects. V2 equivalent is `resolve_domain_object()` in `object_resolver.py`.

---

## 4. Object resolver summary

`apps/api/shared/query_service/object_resolver.py` — implemented and tested:
- `quote_identifier(name)` — wraps in backticks, rejects empty or backtick-containing names
- `qualify_object(catalog, schema, object)` — produces `` `c`.`s`.`o` ``
- `resolve_domain_object(domain, object, schema_override, catalog_override)` — resolves from env vars with V1-compatible CQ fallback

Tests: 30+ tests in `apps/api/tests/shared/test_object_resolver.py` (all passing).

---

## 5. QuerySpec qualification summary

All three native adapter files use `resolve_domain_object()` for object names:
- `poh_databricks_adapter.py` — resolves `POH_CATALOG` / `POH_SCHEMA`
- `cq_databricks_adapter.py` — resolves `CQ_CATALOG` (fallback `TRACE_CATALOG`) / `gold` schema override
- `trace2_databricks_adapter.py` — resolves `TRACE_CATALOG` / `TRACE_SCHEMA`

Column names in POH and CQ adapters are still marked TODO — must be confirmed via `DESCRIBE TABLE` before production use.

---

## 6. Deployment env changes

`apps/api/app.yaml` is correct as of the prior deployment session:
- `BACKEND_ADAPTER_MODE: legacy-api` (literal, safe default)
- `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, catalog vars: commented out, ready to activate
- All `valueFrom` entries use `scope/key` string form — nested YAML was corrected during deployment

`databricks.yml` at repo root drives all Databricks Asset Bundle deploys.

Frontend (`ADAPTER_MODE`) vs backend (`BACKEND_ADAPTER_MODE`) env var split:
- `ADAPTER_MODE` is baked into the React JS bundle at build time and cannot be changed without rebuilding.
- `BACKEND_ADAPTER_MODE` is a runtime env var on the FastAPI process and can be changed by redeploying `app.yaml` without a frontend rebuild.

---

## 7. OAuth diagnostics status

`GET /api/diagnostics/auth-headers` — implemented in `routes/auth_diagnostics.py`.
- Disabled by default (returns 404 unless `ENABLE_AUTH_DIAGNOSTICS=true`).
- When enabled: returns `token_present`, `token_length_bucket`, `user_header_present`, `email_header_present` only — never the raw token.
- Tests: `apps/api/tests/routes/test_auth_diagnostics_routes.py`.

Header names (`x-forwarded-access-token`, `x-forwarded-user`, `x-forwarded-email`) are assumed from Databricks documentation — not yet confirmed against a live deployment. Verification plan in `docs/audit/databricks-apps-oauth-header-verification.md`.

---

## 8. Query service hardening summary

Covered in prior tranche (`native-databricks-execution-hardening-architecture-check.md`). Current state:

- `DatabricksHostNormaliser` — strips `https://` prefix to avoid double-scheme URLs; rejects empty host.
- Error hierarchy — `DatabricksAuthRequiredError`, `DatabricksPermissionError`, `DatabricksConfigError`, `DatabricksQueryError`, `DatabricksRateLimitError`, `DatabricksTimeoutError`.
- `QueryExecutor` — accepts `QueryTags` for `query_name`, `module`, `endpoint`, `user_id`, `cache_policy`, `source_badge`.
- Logging — `user_id` logged, `raw_oauth_token` never logged (enforced in code).
- `max_rows` — enforced in `QueryExecutor`; caller cannot exceed the executor's configured limit.

---

## 9. Route hardening summary

POH and CQ Lab routes:
- `legacy-api` path: forwards to V1 unchanged — no change in behaviour.
- `databricks-api` path: requires `DATABRICKS_HOST` + `SQL_WAREHOUSE_ID` (503 if missing), requires OAuth token (401 if absent), no fallback to mock.
- Response headers: `X-Data-Source`, `X-Adapter-Mode`, `X-Query-Name` set on databricks-api responses.
- Helper module: `routes/_databricks.py` provides `require_databricks_config()` and `set_databricks_response_headers()` to avoid duplication.

---

## 10. Adapter/source matrix updates

`docs/audit/adapter-source-status-matrix.md` updated:
- Added UAT deployment state section (V2 RUNNING, V1 STOPPED → 503 expected, native not active).
- FastAPI Route Inventory updated with UAT status for each route.
- No verification claims changed — no new data connectivity confirmed.

Summary unchanged: 50 methods total, 1 browser-verified, 4 wired (not verified), 2 mode-gated for databricks-api, 45 mock-only.

---

## 11. Guardrail tests added

`apps/api/tests/architecture/test_architecture_guardrails.py` — 9 tests:

| Test | Checks |
|---|---|
| `TestNoSPNOrPATInQueryPath::test_no_spn_or_pat_strings` | No `service_principal`, `client_secret`, `DATABRICKS_TOKEN`, `PAT_TOKEN` in query path |
| `TestNoSQLInRoutes::test_no_raw_sql_in_route_files` | No `SELECT`, `INSERT INTO`, backtick-qualified `FROM`/`JOIN` in route files |
| `TestNoSQLInReact::test_no_raw_sql_in_typescript_files` | No SQL fragments in React/TypeScript source |
| `TestCQLabFailuresDeferred::test_get_lab_failures_spec_not_implemented` | `get_lab_failures_spec` not implemented without BLOCKED marker |
| `TestCQLabFailuresDeferred::test_cq_lab_failures_route_not_wired_to_databricks` | CQ failures route not wired to databricks-api without guard |
| `TestQuerySpecObjectQualification::test_adapter_sql_uses_qualified_objects` | No unqualified `FROM table` / `JOIN table` in adapter SQL |
| `TestQuerySpecObjectQualification::test_adapter_sql_uses_resolve_domain_object_or_backticks` | Native adapters use resolver or backticks |
| `TestNoDatabricksApiMockFallback::test_databricks_adapters_do_not_import_mock` | Databricks adapters don't import mock adapters |
| `TestNoDatabricksApiMockFallback::test_routes_do_not_silently_import_mock_as_fallback` | Routes don't import mock adapters |

---

## 12. Tests run and results

```
apps/api: 334 passed (full suite including new architecture guardrails)
```

Architecture guardrail tests: 9/9 passed.

No live Databricks tests were run — all tests are unit/file-scan tests only. Databricks connectivity tests require manual verification (see smoke-test checklist).

---

## 13. Remaining blockers

| Blocker | Impact | Resolution |
|---|---|---|
| V1 apps STOPPED | All legacy-api domain routes return 503 in UAT | Restart V1 Databricks Apps; not a V2 defect |
| OAuth header names unconfirmed | `x-forwarded-access-token` assumed, not tested | Enable `ENABLE_AUTH_DIAGNOSTICS=true` and call `/api/diagnostics/auth-headers` from authenticated browser session |
| SQL column names TODO | POH and CQ adapters will fail with 502 if actual column names differ | Run `DESCRIBE TABLE <object>` in target Unity Catalog workspace |
| `vw_gold_process_order_plan` missing | CQ Lab failures cannot migrate to databricks-api | View must be created in `csm_process_order_history` before proceeding |
| Unity Catalog permissions | SQL Warehouse must have SELECT grants for forwarded user identity | Verify via `SHOW GRANTS ON TABLE ...` |

---

## 14. Exact next manual verification steps

### Option A — Verify V1 proxy path

1. Start the V1 Databricks Apps (trace2, poh, cq, wh360).
2. From an authenticated browser session, navigate to the V2 UAT URL.
3. Test each domain panel — expect legacy-api data (not mock, not 503).
4. Confirm `source: legacy-api` in the source badge.
5. Record results in `docs/deployment/uat-smoke-test-checklist.md` section B.

### Option B — Verify native Databricks path (first)

1. Set secrets in `connectio-v2` scope: `databricks-host`, `sql-warehouse-id`, `poh-catalog`, `cq-catalog`.
2. Update `app.yaml` — uncomment native blocks, change `BACKEND_ADAPTER_MODE` to `databricks-api`.
3. Enable auth diagnostics: add `ENABLE_AUTH_DIAGNOSTICS=true` to `app.yaml` env.
4. Redeploy: `databricks bundle deploy --target uat && databricks apps deploy connectio-v2 --source-code-path "/Workspace/Shared/.bundle/connectio-v2/uat/files/apps/api"`.
5. Call `/api/diagnostics/auth-headers` from authenticated browser session — confirm token is present.
6. Call `/api/cq/lab/plants` — expect 200 with `X-Data-Source: databricks-api`.
7. Disable diagnostics: remove `ENABLE_AUTH_DIAGNOSTICS` from `app.yaml` and redeploy.
8. Record results in `docs/deployment/uat-smoke-test-checklist.md` section C.

---

## 15. Non-negotiables confirmation

| Rule | Status |
|---|---|
| No service-principal fallback | Confirmed — no SPN code in query path (guardrail test) |
| No PAT fallback | Confirmed — no `DATABRICKS_TOKEN` or `PAT` in query path (guardrail test) |
| No silent mock fallback from databricks-api | Confirmed — databricks-api adapters don't import mock adapters (guardrail test) |
| No SQL in React | Confirmed — no SQL fragments in TypeScript files (guardrail test) |
| No SQL in routes | Confirmed — no SQL literals in FastAPI route files (guardrail test) |
| No broad new APIs | Confirmed — no new routes added this tranche |
| No new workspaces | Confirmed — no workspace additions |
| No CQ Lab failures fake implementation | Confirmed — `get_lab_failures_spec` not implemented; guardrail enforces BLOCKED marker |
| No live-verification claims without actual testing | Confirmed — all status fields remain as before; UAT deployment state clearly states what is and is not proven |
