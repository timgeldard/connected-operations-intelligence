# DatabricksRepository Migration Pilot

## Scope

This pilot migrates one read-only adapter group:

- `POST /api/quality/read-only-evidence`
- `apps/api/adapters/quality/quality_databricks_adapter.py`

The route contract and response body stay unchanged. The route still validates
request shape, mode, and required identifiers. The migrated adapter now owns
Databricks QuerySpec creation, repository execution, and row-to-contract
mapping through `QualityUsageDecisionRepository`.

## What Changed

- Quality usage-decision evidence now uses a domain repository wrapper over the
  shared `DatabricksRepository`.
- The shared route helper exposes repository construction and repository fetch
  error translation.
- The Quality route sets the standard Databricks response headers from the
  returned `QuerySpec`.
- Tests cover route-level auth, config, timeout, rate limit, permission,
  warehouse config, query-error behavior, response headers, and catalog override
  isolation.

## What Stayed Unchanged

- No SQL semantics changed.
- No data contracts changed.
- No generated contracts changed.
- No frontend panels changed.
- No caching was introduced.
- No live Databricks calls were added.

## Connection Lifecycle Decision

The repository path uses app-lifecycle-owned Databricks HTTP client pooling.

`DatabricksHttpClientPool` owns reusable `httpx.AsyncClient` instances keyed by
normalized Databricks host and statement timeout. The key is intentionally
bounded; OAuth tokens are passed per request and are never stored in the pooled
client. `StatementApiDatabricksClient` receives the pool through injection or
uses the module-level app pool.

FastAPI shutdown closes the app-level pool through the application lifespan
hook. Pool close is idempotent, clears all managed clients, and later requests
can safely create fresh clients rather than reusing a closed instance.

Tests cover:

- reusing the same client for the same host and timeout
- creating separate clients for different timeouts
- closing all managed clients
- idempotent close behavior
- recreating a client when a cached client is closed
- timeout and HTTP error paths keeping ownership with the pool until close
- FastAPI lifespan shutdown calling pool close

Out of scope: connection-pool sizing, retry policy redesign, caching, and
live Databricks verification.

## Catalog override allowlist

Per-request catalog targeting uses the `x-databricks-catalog` header, mapped to
`UserIdentity.catalog_target` and applied through `catalog_context` during
`DatabricksRepository.fetch`.

Behaviour:

- **No override** — blank or absent header; environment catalog resolution via
  `CQ_CATALOG` / `TRACE_CATALOG` (and domain fallbacks) is unchanged.
- **Allowlisted override** — header value must appear in
  `DATABRICKS_ALLOWED_CATALOGS` (comma-separated Unity Catalog names).
- **Invalid override** — unknown catalog, unsafe characters, or override when
  the allowlist env var is unset/empty → HTTP 400
  `Unsupported Databricks catalog target` before SQL generation or
  `QueryExecutor.execute`. User input is not echoed in error details.

Validation lives in `shared/query_service/catalog_policy.py` and runs in
`build_user_identity`, `extract_user_identity`, and `DatabricksRepository.fetch`
so invalid values do not reach `object_resolver` or leak into `catalog_context`.

OAuth tokens and catalog targets are not stored in pooled HTTP clients.
Catalog context reset/isolation after success/error remains covered by tests.

Deployment-specific approved catalog values remain an environment configuration
concern (`DATABRICKS_ALLOWED_CATALOGS`). This does not imply production readiness.

## Standard Error Behaviors

Future repository-backed routes should preserve this mapping:

- missing Databricks host or warehouse config -> HTTP 503
- missing user OAuth token -> HTTP 401
- missing Unity Catalog config -> HTTP 503
- Unity Catalog permission failure -> HTTP 403
- rate limit -> HTTP 429
- query timeout or cancellation -> HTTP 504
- SQL/query execution failure -> HTTP 502 with SQL details kept server-side

## Pattern For Next Adapters

1. Keep request validation and response assembly in the route.
2. Add a small domain repository wrapper that accepts the shared
   `DatabricksRepository`.
3. Move QuerySpec creation, execution, and row mapping into that wrapper.
4. Return `(mapped_result, QuerySpec)` so routes can set standard response
   headers.
5. Add tests for auth, config, timeout, rate limit, permission, query errors,
   response headers, and catalog override isolation.
6. Keep SQL, contracts, and frontend behavior unchanged unless the adapter
   migration itself reveals a blocking bug.

## Second adapter migration

Migrated adapter:

- `POST /api/spc/chart-data`
- `apps/api/adapters/spc/spc_databricks_chart_adapter.py` via `SpcChartDataRepository`

Why low-risk:

- Single read-only route with two small QuerySpecs (subgroups + optional locked limits)
- Stable `SpcChartDataResponse` shape already covered by mapper and route tests
- No write-back, no Warehouse/Trace complexity, no new proxy routes

What stayed unchanged:

- SQL strings and bind parameters (except `source_badge` metadata on QuerySpec for headers)
- Contracts, frontend, generated assets, catalog allowlist, connection pooling
- `run_query(...)` remains for non-migrated SPC routes (e.g. `GET /spc/subgroups`)
- Response assembly still uses `map_spc_chart_response` in the route

Tests added:

- `SpcChartDataRepository` unit tests (execution, optional `chartType` skip, catalog isolation/reset)
- Route tests for standard headers, error mapping, catalog override, and single-execute path when `chartType` is absent

Edge cases:

- Locked limits query runs only when `chartType` is set; otherwise the repository returns `([], None)` without calling Databricks.
- Subgroups and limits fetches run in parallel when `chartType` is present.

Readiness:

- Pattern is proven on two domains (Quality + SPC chart-data). A third small read-only adapter can follow the same steps.
- Warehouse 360 and Trace Investigation remain deferred until another backend route is migrated.

## Retry semantics

`DatabricksRepository` uses **`max_attempts`** (total `QueryExecutor.execute` calls per
`fetch()`), not an ambiguous “retry count”. The default is **3 total attempts** (one
initial call plus up to two retries).

**Retryable errors** (exponential backoff between attempts, configurable via
`base_backoff` on the repository constructor):

- `DatabricksQueryTimeoutError`
- `DatabricksRateLimitError`

**Not retried** (propagate immediately):

- `DatabricksConfigError`
- `DatabricksAuthRequiredError`
- `DatabricksCatalogTargetError`
- `DatabricksPermissionError`
- `DatabricksWarehouseConfigError`
- `DatabricksQueryError`
- other unexpected errors

When all attempts fail on a retryable error, the **last** retryable exception is
re-raised and mapped by `run_repository_fetch` / route helpers (timeout → HTTP 504,
rate limit → HTTP 429).

`max_attempts=1` means a single execute call with no sleep. `max_attempts` must be
at least 1 or construction raises `ValueError`.

Tests live in `apps/api/tests/shared/test_query_executor.py`.

## Completion Audit

See [`databricks-repository-completion-audit.md`](./databricks-repository-completion-audit.md)
for the current inventory of remaining route-owned native Databricks paths and
the recommended follow-up PR slicing.

## Third adapter migration

Migrated adapter:

- `GET /api/spc/subgroups`
- `apps/api/adapters/spc/spc_databricks_adapter.py` via `SpcSubgroupsRepository`

Why low-risk:

- Single QuerySpec and stable `SPCSubgroupResponse` shape (already the only native
  SPC GET route; chart-data POST was migrated in the second adapter PR)
- All required filters are mandatory query params — no optional bind-param edge case
- Extensive existing route and adapter tests; databricks-api-only (legacy mode 503)

What stayed unchanged:

- SQL, contracts, frontend, catalog allowlist, pooling, `max_attempts` retry semantics
- `POST /api/spc/chart-data` remains on `SpcChartDataRepository`
- Other SPC proxy routes still use legacy-api or 503 in databricks-api mode
- Row mapping stays in the route via `map_spc_subgroup_rows`

Tests added:

- `SpcSubgroupsRepository` unit tests (execution, catalog isolation/reset)
- `TestSpcSubgroupsRepositoryBacked` route tests (headers, catalog override, 503/504/429)

Edge cases:

- Limit is embedded as a validated integer literal in SQL (not a bind param) — unchanged
- P999 plant rejection remains in the route before repository construction

Readiness:

- Three repository-backed routes now share the same pattern (Quality, SPC chart-data,
  SPC subgroups). Warehouse 360 and Trace Investigation remain deferred — multi-query
  orchestration and higher UAT complexity.

## Remaining Blockers Before Broad Migration

- Caching requires an ADR before implementation and must be tied to freshness
  policy.
- Warehouse 360 and Trace Investigation should wait until a deliberate migration
  plan addresses multi-query routes and UAT scope.
