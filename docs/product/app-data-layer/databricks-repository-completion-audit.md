# DatabricksRepository Completion Audit

## Current Baseline

This audit follows the Quality usage-decision, SPC chart-data, and subsequent
backend repository migration work now merged into `main`.

The shared Databricks execution path is:

1. Route extracts request identity and Databricks configuration.
2. `routes._databricks.build_databricks_repository(...)` creates the request
   repository over the app-lifecycle-owned Statement API client pool.
3. Domain repository wrappers call `DatabricksRepository.fetch(...)`.
4. Routes set standard Databricks response headers from the returned
   `QuerySpec`.

This audit is intentionally code-only. It does not add live Databricks calls,
browser UAT evidence, contract changes, generated assets, SQL semantic changes,
or frontend changes.

## Scan Scope

Production code scanned:

- `apps/api/adapters/**/*.py`
- `apps/api/routes/**/*.py`
- `apps/api/shared/query_service/**/*.py`

Search terms:

- `StatementApiDatabricksClient`
- `QueryExecutor`
- `DatabricksRepository`
- `run_query`
- `httpx.AsyncClient`
- `execute_query` / direct `execute(...)`

## Summary Finding

The remaining migration work is no longer primarily adapter-owned direct
Databricks client usage.

Current domain adapter modules already use domain repository wrappers over
`DatabricksRepository` where they own native Databricks access. The remaining
cleanup is mostly route-level native execution through the shared
`run_query(...)` helper. That helper is repository-backed, so it is not an
unpooled or identity-bypassing Databricks client path, but it still leaves
QuerySpec orchestration and row mapping in route modules.

The next migration PRs should move those route-owned native paths behind domain
repository wrappers without changing SQL, response contracts, generated assets,
or user-facing route behaviour.

## Current Repository-Wrapped Adapter Coverage

| Domain                 | Repository wrapper               | Current state                                                                |
| ---------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Connected Quality lab  | `CqLabRepository`                | Uses `DatabricksRepository.fetch` for lab fails and plants.                  |
| Quality usage decision | `QualityUsageDecisionRepository` | Uses `DatabricksRepository.fetch` for read-only evidence.                    |
| EnvMon                 | `EnvMonRepository`               | Uses `DatabricksRepository.fetch` for native EnvMon routes.                  |
| POH                    | `PohRepository`                  | Uses `DatabricksRepository.fetch` for native POH route methods.              |
| SPC subgroups          | `SpcSubgroupsRepository`         | Uses `DatabricksRepository.fetch` for subgroup reads.                        |
| SPC chart data         | `SpcChartDataRepository`         | Uses `DatabricksRepository.fetch` for chart data and optional locked limits. |
| Warehouse 360          | `Warehouse360Repository`         | Uses `DatabricksRepository.fetch` for native Warehouse reads.                |

## Remaining Route-Owned Native Databricks Paths

These paths use `routes._databricks.run_query(...)`. The helper constructs the
shared `DatabricksRepository`, but the route still owns spec selection and row
mapping. Treat these as the remaining adapter-completion backlog.

| Priority | File                        | Current path                                                                                                                                                                                                                                                                                               | Recommended next action                                                                               |
| -------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1        | `apps/api/routes/trace2.py` | Most Trace2 consumer and investigation endpoints still call `run_query(...)` directly. Batch header, batch search, customer exposure, customer deliveries, supplier exposure, production history, mass balance, recall readiness, supplier batches, and batch quality passport now use `Trace2Repository`. | Continue migrating Trace2 endpoint families behind `Trace2Repository` one small family per PR.        |
| 2        | `apps/api/routes/spc.py`    | Three SPC endpoints still call `run_query(...)` directly.                                                                                                                                                                                                                                                  | Extend the existing SPC repository wrappers so all native SPC reads go through adapter-owned methods. |

## Explicitly Accepted Shared Execution Paths

These are not migration targets:

- `apps/api/routes/_databricks.py` may instantiate
  `StatementApiDatabricksClient`, `QueryExecutor`, and `DatabricksRepository`.
  This is the central request-scoped repository factory.
- `apps/api/shared/query_service/databricks_client.py` may own
  `httpx.AsyncClient` through `DatabricksHttpClientPool`.
- `apps/api/shared/query_service/query_executor.py` may call the injected
  Databricks query client. This is the approved low-level execution boundary.

## Legacy Proxy HTTP Paths

Several route modules still use request-scoped `httpx.AsyncClient` for legacy
V1 proxy forwarding:

- `apps/api/routes/connected_quality_lab.py`
- `apps/api/routes/process_order.py`
- `apps/api/routes/spc.py`
- `apps/api/routes/trace2.py`
- `apps/api/routes/warehouse360.py`

These are not DatabricksRepository migration targets unless the route is being
converted from legacy proxy mode to native Databricks mode. They should not be
removed or rewritten as part of repository-completion work unless a dedicated
route migration PR has verified source objects, route contracts, and tests.

## Suggested PR Slicing

### PR 1: Trace2 Repository Facade for One Endpoint Family

Scope:

- Move low-risk Trace2 endpoint families from route-owned `run_query(...)` to
  `Trace2Repository` methods. The first slice covers `/api/trace2/batch-header`,
  `/api/trace2/batch-search`, `/api/trace2/customer-exposure`, and
  `/api/trace2/customer-deliveries`. The supplier exposure route now follows the
  same facade pattern, as do `/api/trace2/production-history` and
  `/api/trace2/mass-balance`. `/api/trace2/recall-readiness` is also
  facade-backed while preserving the `not-evaluated` recommendation semantics.
  `/api/trace2/supplier-batches` keeps its two-query consumed-lots plus sibling
  batch behaviour inside the facade. `/api/trace2/batch-quality-passport` keeps
  its existing multi-query fan-out and primary response-header spec inside the
  facade.
- Preserve the existing QuerySpec, mapper, response model, response headers,
  and error mapping.
- Add route tests that patch `QueryExecutor.execute`, not live Databricks.

Do not include:

- Broad Trace2 migration.
- Recall/containment semantics changes.
- SQL rewrites beyond moving existing spec construction behind the facade.
- Contract or generated asset changes.

### PR 2: Complete Remaining SPC Native Reads

Scope:

- Move remaining SPC `run_query(...)` route paths behind existing or new SPC
  repository methods.
- Preserve chart/subgroup response semantics and current caveats.
- Keep legacy proxy routes unchanged.

Do not include:

- New SPC visual primitives.
- Frontend consumer app changes.
- Live UAT evidence.

### PR 3: Trace2 Remaining Endpoint Families

Scope:

- Migrate the rest of the route-owned Trace2 native reads in small families.
- Keep any multi-query aggregation explicit and tested.
- Preserve wording protections around trace, containment, and recall readiness.

Do not include:

- Automated recall decisions.
- New trace contracts or generated response shapes unless a separate contract
  PR has already landed.

### PR 4: Repository Usage Guardrail

Scope:

- Add a backend test or static check that prevents domain adapter or route
  modules from instantiating `StatementApiDatabricksClient` / `QueryExecutor`
  outside the approved shared helper boundary.
- Allowlist:
  - `apps/api/routes/_databricks.py`
  - `apps/api/shared/query_service/**`
  - tests

Do not include:

- Behaviour changes.
- Broad migrations.

## Migration Rules For Follow-Up PRs

- Keep SQL semantics unchanged unless a source-verification document requires a
  separate SQL fix.
- Keep route contracts and generated response shapes unchanged.
- Return `(mapped_result, QuerySpec)` from repository wrappers so routes can set
  standard Databricks headers.
- Preserve catalog allowlist validation and catalog context reset behaviour.
- Keep OAuth user identity as mandatory for user-facing Databricks reads.
- Test timeout, rate limit, permission, auth, config, and query-error mapping
  for each migrated route family.
- Do not add live Databricks calls, browser UAT evidence, caching, frontend
  changes, or generated-contract updates in repository-only migration PRs.

## Completion Definition

Repository migration is complete when:

- Domain route modules no longer call `run_query(...)` directly for native
  Databricks reads.
- Domain repository wrappers own QuerySpec selection and mapping for native
  routes.
- Direct `StatementApiDatabricksClient` and `QueryExecutor` construction is
  restricted to the approved shared helper and query-service layers.
- Tests enforce the boundary.

This definition does not require removing legacy V1 proxy forwarding code.
