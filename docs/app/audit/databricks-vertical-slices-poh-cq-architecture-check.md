# Architecture Check — POH + CQ Lab Databricks Vertical Slices

**Date:** 2026-05-16  
**Scope:** `apps/api/shared/query_service/`, `apps/api/adapters/poh/`, `apps/api/adapters/cq/`  
**Reference:** ADR-024, `docs/migration/databricks-vertical-slices-poh-cq-plan.md`

---

## What Was Built

| Artefact | Path | Purpose |
|----------|------|---------|
| `CacheTier` enum | `apps/api/shared/query_service/cache_policy.py` | Three-tier cache policy: GLOBAL_300S / PER_USER_60S / NONE |
| `DatabricksAuthRequiredError` | `apps/api/shared/query_service/errors.py` | Raised when user OAuth token absent — no service-principal fallback |
| `QueryExecutionError` | `apps/api/shared/query_service/errors.py` | Raised on Databricks query failure |
| `UserIdentity` | `apps/api/shared/query_service/identity.py` | User context dataclass; `require_user_oauth()` enforces OAuth-required invariant |
| `QuerySpec` | `apps/api/shared/query_service/query_spec.py` | Parameterised SQL + execution policy descriptor |
| `QueryExecutor` | `apps/api/shared/query_service/query_executor.py` | Executes QuerySpec with user OAuth; `NotImplementedDatabricksClient` placeholder |
| POH adapter | `apps/api/adapters/poh/poh_databricks_adapter.py` | `get_process_order_header_spec`, `get_order_operations_spec` |
| CQ adapter | `apps/api/adapters/cq/cq_databricks_adapter.py` | `get_lab_plants_spec` |
| CQ blocker doc | `docs/migration/cq-lab-databricks-blockers.md` | getLabFailures blocked on missing `vw_gold_process_order_plan` |
| Tests | `apps/api/tests/shared/`, `apps/api/tests/adapters/` | 69 new tests; 76 total passing |

---

## ADR-024 Alignment Check

| ADR-024 requirement | Status |
|--------------------|--------|
| User OAuth token required for all Databricks reads | ✓ — `require_user_oauth()` raises `DatabricksAuthRequiredError` before any query; tested |
| No service-principal fallback | ✓ — error message explicitly states "Do not fall back to a service principal"; test `test_no_service_principal_hint_in_message` verifies the message |
| QuerySpec protocol | ✓ — `QuerySpec` dataclass matches ADR-024 §3 fields: name, module, endpoint, sql, params, cache_policy, source_badge, catalog_override, schema_override, max_rows, timeout_seconds, tags |
| Three-tier cache | ✓ — `CacheTier.GLOBAL_300S` / `PER_USER_60S` / `NONE` |
| MV-first query strategy | ✓ — POH specs target `vw_gold_process_order` and `vw_gold_process_order_phase`; CQ targets `gold_plant` |
| Source badge contract | ✓ — `source_badge = "databricks-api"` on all QuerySpec instances |
| Module migration order respected | ✓ — POH is ADR-024 priority #1; CQ is priority #4. Trace batch-header (priority #2) already has a browser-verified legacy-api path. This tranche starts POH QuerySpec infrastructure first. |
| `catalog_override` for wh360 separation | ✓ — `QuerySpec` has `catalog_override` field; Warehouse slice deferred (last, as per ADR-024) |

---

## Security Invariants (CLAUDE.md rules)

| Rule | Verification |
|------|-------------|
| Production Databricks reads use authenticated user's OAuth | `UserIdentity.require_user_oauth()` raises before query; `TestQueryExecutor::test_calls_require_user_oauth_before_client` confirms call order |
| No service-principal fallback paths | `DatabricksAuthRequiredError` is the only error path — no except/fallback in `QueryExecutor.execute()` |
| If OAuth unavailable, mark as blocked | `QueryExecutor` propagates `DatabricksAuthRequiredError` to the caller; route handler (future) must return HTTP 401, not degrade to mock |

---

## What Is Deferred and Why

### Route wiring (FastAPI → QueryExecutor)

The existing routes in `apps/api/routes/process_order.py` and `connected_quality_lab.py` still forward to V1 via `_forward_post` / `_forward_get`. They have not been modified.

Route wiring requires:
1. **ADR-024 open question #1** (Statement API vs SQL Connector) resolved — gates `NotImplementedDatabricksClient` replacement
2. **ADR-024 open question #7** (cache backend: in-process LRU vs Redis/Lakebase) resolved — gates cache layer implementation
3. **Column names verified** — every SQL column in the adapter specs is marked with `# TODO: verify`; must be confirmed against live `connected_plant_uat` view DDL before any route executes a query in production

### TypeScript `DatabricksApiAdapter` classes

No TypeScript changes in this tranche. Without route wiring, the frontend adapter has no Databricks endpoint to call. Adding a TypeScript adapter that calls a non-existent backend route would introduce speculative code that could produce 404/502 errors in `legacy-api` mode.

### `getLabFailures`

Blocked on `vw_gold_process_order_plan` missing. See `docs/migration/cq-lab-databricks-blockers.md`.

---

## Column Name Verification — Required Before Route Wiring

All SQL column references in the adapters are tagged with `# TODO: verify`. This is intentional.

| Adapter | View | TODO count (approx) | Verification method |
|---------|------|---------------------|---------------------|
| `poh_databricks_adapter.py` | `vw_gold_process_order` | 14 | Run `DESCRIBE TABLE connected_plant_uat.vw_gold_process_order` and confirm each column alias |
| `poh_databricks_adapter.py` | `vw_gold_process_order_phase` | 11 | Run `DESCRIBE TABLE connected_plant_uat.vw_gold_process_order_phase` |
| `cq_databricks_adapter.py` | `gold_plant` | 2 | Run `DESCRIBE TABLE connected_plant_uat.gold_plant` |

Do not remove `# TODO: verify` comments or commit route wiring until all column names in a given spec have been confirmed.

---

## Test Coverage

76 tests total, 76 passing.

New tests added:
- `tests/shared/test_query_service.py` — 27 tests covering CacheTier, error types, UserIdentity, QuerySpec, QueryExecutor
- `tests/adapters/poh/test_poh_databricks_adapter.py` — 27 tests covering both POH QuerySpec factories
- `tests/adapters/cq/test_cq_databricks_adapter.py` — 15 tests covering CQ QuerySpec factory

Key invariants tested:
- OAuth check runs before client call (not after)
- Empty OAuth token raises (not just None)
- Default `params` and `tags` are not shared between `QuerySpec` instances (mutable default guard)
- SQL always contains `LIMIT :max_rows`
- SQL always contains `TODO` markers (unverified columns cannot silently slip through)

---

## Next Steps

In priority order:

1. **Resolve ADR-024 open question #1** — Statement API vs SQL Connector
2. **Resolve ADR-024 open question #7** — cache backend
3. **Verify column names** for each adapter spec against live `connected_plant_uat` views; remove `# TODO: verify` after each confirmation
4. **Browser-verify `POST /api/por/order-header`** against live V1 — needed for parallel validation when route switches to Databricks
5. **Implement real Databricks client** to replace `NotImplementedDatabricksClient`
6. **Wire routes** to call `QueryExecutor` with user OAuth
7. **Add TypeScript `DatabricksApiAdapter` classes** once routes are live
8. **Create `vw_gold_process_order_plan`** in `csm_process_order_history` to unblock `getLabFailures`
