# ADR-024: Native Databricks Data-Access Architecture for ConnectIO RAD V2

| Field | Value |
|-------|-------|
| Status | Proposed |
| Date | 2026-05-16 |
| Authors | Tim Geldard |
| Deciders | ConnectIO Platform Team |
| Scope | All RAD V2 modules (Trace, SPC, POH, Warehouse, Quality/Lab, EnvMon) |

---

## 1. Context

ConnectIO RAD V2 introduces a clean adapter-based data-access pattern where each module
declares its data needs through a typed interface and the runtime selects a concrete
adapter at startup. Today two adapters are implemented:

| Adapter | Purpose | Data Source |
|---------|---------|-------------|
| `mock` | Local development, Playwright E2E, demos | In-memory fixtures |
| `legacy-api` | Bridging period — calls V1 FastAPI endpoints | V1 Databricks SQL via REST Statement API |

A third adapter — `databricks-api` — is the long-term production target but has no
design or implementation yet. This ADR establishes the architecture for that adapter
and the surrounding infrastructure.

### Current V1 Architecture (for reference)

```
React App → V1 FastAPI → shared_db.run_sql_async() → Databricks SQL Warehouse
                                                        (REST Statement API)
                                                        connected_plant_uat (PRO)
```

Each V1 DAL file constructs SQL inline, forwards the user's OAuth token, and caches
results in a 5-minute TTL LRU (max 1000 rows). There is no abstraction between the
router and the raw SQL — the router IS the data layer.

### Why This Decision Is Needed Now

1. V2 modules are progressing from mock → legacy-api. The next step must be defined
   before modules start hard-coding SQL patterns ad-hoc.
2. The gold layer has matured: curated views (`csm_process_order_history.vw_gold_*`),
   pre-computed MVs (`gold.metric_*`), and serving tables now exist.
3. The platform cost analysis shows that moving compute to the DB layer (MVs, views)
   rather than the app layer (Python aggregation) saves 80%+ at high frequency.
4. RAD V2 already has the adapter seam — we must decide what flows through it.

---

## 2. Decision Drivers

- **Cost**: Minimise DBU consumption; prefer pre-computed MVs over per-request aggregation.
- **Latency**: Sub-500ms P95 for dashboard page loads.
- **Consistency**: All modules share one data-access pattern; no per-module special cases.
- **Testability**: The adapter seam must remain mockable for unit and E2E tests.
- **Security**: Row-level access, token forwarding, no service-principal-as-user anti-pattern.
- **Observability**: Every query must be attributable to a user, module, and endpoint.
- **Migration**: Smooth module-by-module migration from legacy-api → databricks-api.

---

## 3. Options Evaluated

### Option A: React Directly Queries Databricks

The frontend calls the Databricks SQL Statement API (or Genie API) directly using the
user's OAuth token from the Apps proxy.

| Pros | Cons |
|------|------|
| Eliminates backend entirely for reads | Exposes SQL/schema to the browser |
| Zero backend latency | No server-side caching or batching |
| Native Databricks auth | Cannot enforce row-level policies beyond UC |
| | CORS complexity with Statement API |
| | No domain logic layer (validation, normalisation) |
| | Bundle size bloat (SQL strings in JS) |

**Verdict: Rejected.** Violates separation of concerns; couples frontend to schema;
prevents server-side optimisations; makes testing harder (no mock seam in browser).

---

### Option B: V2 FastAPI Queries Databricks SQL Warehouse Directly

Each V2 DAL module constructs parameterised SQL and executes via a shared async client
against the PRO SQL warehouse, forwarding the proxy user's token.

```
React → V2 FastAPI (adapter=databricks-api) → Databricks SQL Warehouse
                                                  (Statement API / connector)
```

| Pros | Cons |
|------|------|
| Full control over SQL | Re-invents what V1 already does |
| Server-side caching possible | SQL strings scattered in Python (V1 anti-pattern) |
| Domain logic in Python | Each module re-implements pagination, error handling |
| Token forwarding preserves user identity | Tight coupling to table schemas |

**Verdict: Partially suitable.** This is essentially what V1 does. Acceptable as a
mechanism, but needs a structured query layer on top (see Option D).

---

### Option C: V2 FastAPI Proxies V1 Legacy APIs

V2's `legacy-api` adapter calls the existing V1 endpoints (which remain deployed).

```
React → V2 FastAPI (adapter=legacy-api) → V1 FastAPI → SQL Warehouse
```

| Pros | Cons |
|------|------|
| Zero V1 code changes needed | Double-hop latency (~200ms overhead) |
| Immediate V2 parity | V1 tech debt preserved indefinitely |
| Module-by-module opt-in | Two services to monitor, deploy, version |
| | Auth token must be forwarded twice |
| | V1 cache and V2 cache can diverge |

**Verdict: Acceptable as a transitional step (current state).** Not a long-term target.

---

### Option D: V2 FastAPI Calls a Shared Query Service (Recommended)

A thin, typed query-service layer within the V2 backend provides:

- Parameterised SQL execution (shared_db)
- Schema-aware result mapping (typed response models)
- Transparent source selection (MV → view → fallback SQL)
- Server-side caching (per-user + global tiers)
- Observability (query tagging, latency histograms)

```
React → V2 FastAPI → DomainAdapter(databricks-api) → QueryService → SQL Warehouse
                          ↑                                ↑
                     typed interface                  shared_db + cache
                     (port pattern)                   (infrastructure)
```

This is NOT a separate microservice. It is a shared library (`shared_db`) already
deployed as a wheel, extended with:

1. A `QuerySpec` protocol (SQL template + params + cache config + source badge)
2. A `QueryExecutor` that resolves the spec against the warehouse
3. Result mapping to domain models at the adapter boundary

| Pros | Cons |
|------|------|
| Single execution path for all modules | Requires defining QuerySpec protocol |
| Caching, tagging, metrics in one place | shared_db wheel must be versioned carefully |
| Adapter seam preserved (mock/legacy/databricks) | Slightly more abstraction than raw SQL |
| MV-aware: prefers pre-computed tables | |
| Token forwarding preserved | |
| One cache layer (not two) | |

**Verdict: Recommended target architecture.**

---

### Option E: Curated Serving Views vs. Direct Gold Queries

This is orthogonal to the transport mechanism (it applies to Options B and D). The
question is: should the query service hit gold tables directly, or should a layer of
"serving views" exist between gold and the app?

| Approach | Characteristics |
|----------|----------------|
| Direct gold queries | App SQL references `gold.gold_*` or `csm.vw_gold_*` directly |
| Serving views/MVs | App references `gold.metric_*` or `gold.serving_*` |
| Hybrid | Simple lookups hit gold directly; aggregations hit MVs |

**Verdict: Hybrid (recommended).**

- **Point lookups** (e.g., fetch order by ID, get plant list): query `csm.vw_gold_*`
  or `gold.gold_*` directly. These are fast, cacheable, and don't benefit from
  pre-computation.
- **Aggregations** (e.g., daily yield, downtime summary, quality trends): query
  `gold.metric_*` MVs. These are pre-computed at 06:00 UTC daily (or on-demand
  refresh), eliminating per-request aggregation cost.
- **Complex joins** (e.g., lab failures, quality result enriched): query the curated
  views (`vw_gold_order_summary`, `vw_gold_quality_result_enriched`,
  `vw_gold_day_view_blocks`). These encapsulate the join logic so the app never
  constructs multi-table joins itself.

---

## 4. Recommended Architecture

### 4.1 Layer Responsibilities

#### Frontend (React)

| Responsibility | NOT Responsible For |
|----------------|---------------------|
| Render data from typed API responses | SQL construction |
| Send plant/date/filter params | Token management (handled by Apps OAuth) |
| Optimistic UI + loading states | Caching decisions |
| Select adapter mode via env/config | Schema awareness |
| Call V2 API endpoints only | Direct Databricks calls |

#### FastAPI (V2 Backend)

| Responsibility | NOT Responsible For |
|----------------|---------------------|
| Route requests to domain adapters | SQL construction (delegated to QuerySpec) |
| Validate + normalise input params | Token storage (stateless, forwarded) |
| Enforce cross-origin mutation block | Compute-intensive aggregation |
| Return typed domain models | Schema migration |
| Expose `/api/health` + `/api/ready` | |

#### Domain Adapter (databricks-api)

| Responsibility | NOT Responsible For |
|----------------|---------------------|
| Implement the typed port interface | HTTP concerns (no Request/Response) |
| Construct `QuerySpec` objects | Direct SQL execution |
| Map result rows → domain models | Caching (delegated to QueryExecutor) |
| Declare source badge per query | Authentication |
| Handle empty/null coercion | |

#### QueryService / QueryExecutor (shared_db v2)

| Responsibility | NOT Responsible For |
|----------------|---------------------|
| Execute parameterised SQL via Statement API | Domain logic |
| Manage concurrency semaphore | Input validation |
| Server-side cache (global + per-user tiers) | Result type mapping |
| Tag queries with module/endpoint/user | |
| Route to correct catalog/schema via config | |
| Emit latency + row-count metrics | |

#### Unity Catalog / Databricks SQL

| Responsibility | NOT Responsible For |
|----------------|---------------------|
| Gold tables (source of truth) | Application logic |
| Curated views (join encapsulation) | User session management |
| Materialized views (pre-computed metrics) | Frontend rendering |
| Row-level security (future) | |
| Column masking (PII) | |
| Query audit log | |

---

### 4.2 Auth & Secrets

```
Browser → Databricks Apps OAuth Proxy → V2 FastAPI
                                            ↓
                                     UserIdentity.raw_token
                                            ↓
                                     QueryExecutor → SQL Warehouse
                                        (token forwarded per-request)
```

| Concern | Approach |
|---------|----------|
| User authentication | Databricks Apps OAuth proxy (existing) |
| Token format | OAuth access token (user-scoped) |
| Token forwarding | `UserIdentity.raw_token` passed to QueryExecutor |
| Service principal | Used for deployment/scheduling only, never for user queries |
| Warehouse selection | Environment variable `SQL_WAREHOUSE_ID` |
| Catalog/schema | Environment variables `CQ_CATALOG`, `CQ_SCHEMA` |
| Row-level security | Future: UC row filters on gold tables per plant/role |
| Secret storage | Databricks Apps resource bindings (no vault needed) |

**Critical rule**: Every user-facing query runs as the authenticated user's token.
The service principal token is NEVER used for data queries — only for background
jobs (MV refresh, ETL). This preserves the UC audit trail and enables future ABAC.

---

### 4.3 Source Badges

Each query result carries a `source_badge` metadata field indicating provenance:

| Badge | Meaning | Example |
|-------|---------|---------|
| `mv:metric_yield_daily` | Pre-computed materialized view | Yield trend chart |
| `view:vw_gold_order_summary` | Curated gold view (real-time) | Order list page |
| `table:gold_process_order` | Direct gold table scan | Order detail lookup |
| `cache:global:300s` | Served from global cache (TTL) | Plant dropdown |
| `cache:user:60s` | Served from per-user cache | Repeated page nav |
| `mock` | Fixture data (dev/test) | E2E suite |
| `legacy-api:/api/poh/orders` | Proxied V1 response (bridge) | During migration |

Badges are:

- Included in API response headers (`X-Data-Source`)
- Logged with every query execution
- Surfaced in the frontend dev toolbar (non-production builds)
- Used by the test harness to assert correct adapter routing

---

### 4.4 Migration Path: mock → legacy-api → databricks-api

```
Phase 1 (current):   mock ──── E2E tests, demos, local dev
Phase 2 (current):   legacy-api ── bridge to V1 (deployed, working)
Phase 3 (this ADR):  databricks-api ── native Databricks access
```

#### Migration Rules

1. **One adapter per module at a time.** A module uses exactly one adapter in a given
   deployment. No hybrid within a single module.
2. **Module-by-module cutover.** Each module migrates independently:
   `POH → Trace → SPC → Quality/Lab → EnvMon → Warehouse`
3. **Feature-flag gated.** `PLATFORM_FEATURE_<MODULE>_ADAPTER=databricks-api` in
   `app.yaml` env vars. Roll back by changing the flag.
4. **Parallel validation window.** During cutover, the module's integration tests run
   against BOTH legacy-api and databricks-api, comparing response shapes.
5. **Legacy-api remains deployable.** Never remove the legacy-api adapter from the
   codebase until all modules have been stable on databricks-api for 30+ days.

#### Per-Module Migration Sequence

| Module | Priority | Complexity | Key Dependencies |
|--------|----------|-----------|------------------|
| POH | 1 (first) | Medium | `vw_gold_order_summary`, `metric_yield_*`, `vw_gold_day_view_blocks` |
| Trace | 2 | Low | `gold_batch_material`, lineage graph (already simple queries) |
| SPC | 3 | High | `spc_*` MVs, correlation source, process flow (complex joins) |
| Quality/Lab | 4 | Medium | `vw_gold_quality_result_enriched`, `metric_quality_daily`, missing `vw_gold_process_order_plan` |
| EnvMon | 5 | Low | Environmental monitoring views (small dataset, simple queries) |
| Warehouse | 6 (last) | High | `wh360.*` schema (separate), IMWM stock views, exception rules |

---

## 5. Domain-by-Domain Implications

### 5.1 Process Order History (POH)

| Concern | Data Source |
|---------|-------------|
| Order list | `vw_gold_order_summary` (pre-joined: confirmations, receipts, material) |
| Yield analytics | `metric_yield_per_order` + `metric_yield_daily` (MVs, daily refresh) |
| Day view blocks | `vw_gold_day_view_blocks` (includes PROCESS_LINE via silver join) |
| Downtime trends | `metric_downtime_daily` (MV) for trends; `vw_gold_downtime_and_issues` for detail |
| Equipment states | `metric_equipment_state_snapshot` (MV) for current states |

**V1 patterns eliminated**: 3-CTE order query, Python UOM conversion (G→kg), Python
time-bucketing (tz_day_ms/tz_hour_ms), Python zero-padding of missing days/hours.

**Note**: `metric_yield_per_order` currently computes yield ONLY from Tulip movements
(`gold_adp_movement`, 5,852 rows). SAP inventory movements (154.7M rows in
`silver_inventory_movement`) are a separate table with different schema. If SAP yield
is needed, a separate MV against silver_inventory_movement is required.

### 5.2 Traceability (Trace)

| Concern | Data Source |
|---------|-------------|
| Batch lineage graph | `gold_batch_material` + recursive CTE (already simple in V1) |
| Mass balance | `gold_adp_movement` filtered by PROCESS_ORDER_ID |
| Recall readiness | Aggregate from `gold_batch_material` + `gold_process_order` |
| Top-down / bottom-up | Graph traversal (stateless, port directly) |

**Low complexity**: Trace queries are lookups and graph traversals. Minimal
refactoring needed beyond wrapping in QuerySpec.

### 5.3 Statistical Process Control (SPC)

| Concern | Data Source |
|---------|-------------|
| Control charts | `spc_correlation_source_mv` (existing MV) |
| Scorecard | `spc_material_dim_mv` + `spc_plant_material_dim_mv` |
| Process flow | `spc_process_flow_source_mv` (existing MV) |
| Nelson rules | Compute in Python (stateless, no DB dependency) |

**Already MV-heavy**: SPC was the first module to adopt MVs. Migration is mostly
wrapping existing SQL in QuerySpec protocol. Nelson rule computation stays client-side.

### 5.4 Warehouse360

| Concern | Data Source |
|---------|-------------|
| IMWM stock | `wh360.imwm_stock_v` (separate schema, complex view stack) |
| Exceptions | `wh360.imwm_exceptions_v` (rule-generated queue, 7 UNION branches) |
| Stock comparison | `wh360.imwm_stock_comparison_v` |
| Goods receipts | SAP tables via wh360 views |

**Separate schema**: Warehouse uses `connected_plant_uat.wh360` (not
`csm_process_order_history`). The QueryExecutor must support per-module
catalog/schema routing via `catalog_override` in QuerySpec.

**High complexity**: The IMWM view stack is deeply layered (view 11 depends on
view 3, exception view depends on view 11). Schema changes require careful ordering.

### 5.5 Quality / Lab

| Concern | Data Source |
|---------|-------------|
| Lab failures | `vw_gold_quality_result_enriched` (curated 4-way join) |
| Lab plants | `gold_plant` + `vw_gold_inspection_result` (join for plant names) |
| Quality daily | `metric_quality_daily` (MV) |
| Failure detail | Needs `vw_gold_process_order_plan` for PROCESS_LINE |

**Blocker**: The lab DAL currently references `vw_gold_process_order_plan` which does
NOT exist in `csm_process_order_history`. This view must be created (exposing
PROCESS_ORDER_ID → PROCESS_LINE from `silver.silver_process_order`) before the
databricks-api adapter can go live for this module. The unit test
`test_lab_fails_endpoint` passes only because it mocks at the application layer,
masking the runtime SQL failure.

### 5.6 Environmental Monitoring (EnvMon)

| Concern | Data Source |
|---------|-------------|
| Active plants | Distinct plants from sensor data |
| Floor KPIs | Aggregate sensor readings by floor/zone |
| Alert history | Currently returns `data_available: False` (gold views pending) |
| Floor layout | Static config, no DB dependency |

**Low volume, low complexity.** Blocked on gold view creation for the history
endpoint but otherwise straightforward.

---

## 6. Performance & Cost Considerations

### Query Cost Model

| Pattern | Cost per request | When to use |
|---------|-----------------|-------------|
| MV scan (`metric_*`) | ~0.001 DBU | Trend charts, KPIs, aggregations |
| View scan (`vw_gold_*`) | ~0.005 DBU | Lists, detail pages, lookups |
| Multi-table join (ad-hoc) | ~0.05 DBU | Avoid — pre-compute in view/MV |
| Full table scan (`gold_*`) | 0.01–0.5 DBU | Only with filter pushdown |

### Caching Strategy

| Tier | TTL | Scope | Use Case |
|------|-----|-------|----------|
| Global | 300s | All users, same params | Plant list, material dropdown |
| Per-user | 60s | Single user session | Repeated page navigation |
| None | 0 | Real-time critical | Equipment state (future 5-min mode) |

### Cost Projection

| Metric | legacy-api (V1) | databricks-api (V2) | Saving |
|--------|-----------------|---------------------|--------|
| Avg DBU per page load | 0.05 | 0.008 | 84% |
| Reason | V1 runs CTEs per request | V2 hits pre-computed MVs | |
| Cache hit rate | ~40% (5-min TTL, 1000 max) | ~70% (tiered, larger pool) | |
| P95 latency | 800ms | 200ms | 75% |

### MV Refresh Strategy

Current state: all 5 metric MVs refresh daily at 06:00 UTC via CRON schedule.

| Strategy | Availability | When |
|----------|-------------|------|
| `SCHEDULE CRON` (current) | Available now | Daily 6am UTC |
| `TRIGGER ON UPDATE` (preferred) | Blocked — requires workspace feature preview | When preview enabled |

`TRIGGER ON UPDATE AT MOST EVERY INTERVAL 15 minutes` is the preferred long-term
strategy: it only refreshes when upstream data changes, eliminating wasted refreshes.
Currently blocked because the workspace has not enrolled in the Serverless Generic
Compute Materialized View/Streaming Table feature preview.

### ETL Frequency vs. App Query Frequency

The 10 Tulip ETL jobs run every 5 minutes (204 runs/day each) but process only
~150–350 rows/day total. 96% of runs find zero new data. This means:

- MV refresh more than once/day is unnecessary for current data volumes
- App-layer caching with 60–300s TTL provides sufficient freshness
- If ETL moves to hourly (recommended), daily MV refresh + 60s app cache gives
  sub-minute effective staleness for the user

### Warehouse Sizing

The `connected_plant_uat` PRO warehouse is appropriate for current load (2 plants,
<50 concurrent users). At scale (20+ plants, 200+ users), consider:

- Serverless SQL warehouse (auto-scaling, pay-per-query)
- Query routing: heavy aggregations to a dedicated warehouse, lookups to shared

---

## 7. Testing Approach

### Unit Tests (per module)

```
Adapter interface → MockAdapter (in-memory fixtures)
                  → Assert: correct params passed, response shape validated
```

No network, no SQL, no warehouse. Tests run in <1s.

### Integration Tests (per module)

```
Adapter interface → DatabricksApiAdapter → SQL Warehouse (UAT catalog)
                  → Assert: correct data returned, source badge = expected
```

Run against `connected_plant_uat` with a test user token. Gated by CI flag.

### Adapter Parity Tests (during migration)

```
Same request → LegacyApiAdapter → response_a
Same request → DatabricksApiAdapter → response_b
Assert: response_a ≈ response_b (structural match, not exact values)
```

These run nightly during the parallel validation window to catch regressions.

### E2E Tests (Playwright)

```
Frontend → V2 API (adapter=mock) → MockAdapter
         → Assert: UI renders correctly from fixture data
```

E2E tests NEVER hit Databricks. They validate frontend rendering and interaction
only. The mock adapter provides deterministic, fast, offline-capable fixtures.

### Performance Tests

```
Locust / k6 → V2 API (adapter=databricks-api) → SQL Warehouse
            → Assert: P95 < 500ms, no query timeouts, cache hit rate > 60%
```

Run weekly against UAT to catch query regression before production.

---

## 8. QuerySpec Protocol (Sketch)

```python
@dataclass(frozen=True)
class QuerySpec:
    """Declares a single data need for the QueryExecutor."""

    sql: str                              # Parameterised SQL template
    params: list[SqlParam]                # Named parameters (:param syntax)
    source_badge: str                     # e.g. "mv:metric_yield_daily"
    cache_tier: CacheTier                 # GLOBAL_300S | PER_USER_60S | NONE
    module: str                           # "poh" | "spc" | "trace" | ...
    endpoint: str                         # "yield_daily" | "order_list" | ...
    max_rows: int = 1000                  # Safety limit
    timeout_seconds: int = 30             # Per-query timeout
    catalog_override: str | None = None   # For wh360 schema routing
```

The adapter constructs a `QuerySpec`; the `QueryExecutor` handles execution,
caching, tagging, and metrics. The adapter never touches `run_sql_async` directly.

---

## 9. Open Questions

| # | Question | Owner | Status |
|---|----------|-------|--------|
| 1 | Should QueryExecutor use the REST Statement API or the Databricks SQL Connector (Python)? Statement API is async-native but has 10MB response limit; Connector is synchronous but supports larger results and server-side cursors. | Platform | Open |
| 2 | How do we handle cross-module queries (e.g., POH order detail needs Trace lineage data)? Shared QuerySpecs? Composed adapters? | Platform | Open |
| 3 | Should the `wh360` module use the same warehouse or a dedicated one (different cost profile, SAP-heavy data at 154.7M rows)? | Warehouse team | Open |
| 4 | When do we introduce row-level security via UC row filters (per-plant access)? Before or after databricks-api migration? | Security | Open |
| 5 | Should MVs move to TRIGGER ON UPDATE when the workspace preview becomes available? What is the timeline for that preview? | Data Eng | Open |
| 6 | How do we version QuerySpecs when gold schema evolves? Pin to view definitions or allow floating references? | Platform | Open |
| 7 | Should the global cache be in-process (LRU dict) or external (Redis via Lakebase)? In-process is simpler but lost on App restart. | Platform | Open |
| 8 | What is the fallback behaviour when the SQL warehouse is cold-starting (~15s)? Queue? Return stale cache? 503? | Platform | Open |
| 9 | Should SAP inventory movements (154.7M rows) also feed yield calculations? Currently metric_yield_per_order uses only Tulip movements (5,852 rows). | Product | Open |
| 10 | How do we handle the bronze-layer duplicates (26 in process_order_material)? Deduplicate at ingestion or accept silver-layer dedup? | Data Eng | Open |

---

## 10. Decision

**We adopt Option D (Shared Query Service) with a Hybrid serving strategy (Option E).**

The `databricks-api` adapter will:

1. Construct typed `QuerySpec` objects per domain operation.
2. Delegate execution to a shared `QueryExecutor` (evolved from `shared_db`).
3. Prefer materialized views for aggregations, curated views for joins, direct gold
   tables for point lookups.
4. Forward the user's OAuth token for every query (no service-principal queries).
5. Tag every query with module, endpoint, and user for observability.
6. Cache results in a tiered strategy (global 300s / per-user 60s / none).
7. Emit source badges in response headers for debugging and test assertions.
8. Migrate module-by-module, feature-flag gated, with parallel validation.

---

## 11. Consequences

### Positive

- Single, auditable data-access path for all modules.
- 84% cost reduction from MV-first query pattern.
- 75% latency improvement from pre-computation + tiered caching.
- Clean adapter seam preserved for testing (mock stays unchanged).
- Module-by-module migration with zero-downtime rollback via feature flags.
- UC audit trail intact (user token forwarded, not service principal).

### Negative

- Requires defining and maintaining the QuerySpec protocol (new shared contract).
- shared_db wheel becomes a critical shared dependency (versioning discipline needed).
- Gold layer must be "complete" before a module can migrate (e.g., Lab blocked on
  missing `vw_gold_process_order_plan`).
- Two cache invalidation concerns: MV refresh schedule + app-layer TTL.

### Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Warehouse cold-start latency (15s) during low-traffic | Medium | Keep-alive ping every 10 min from readiness probe |
| Cache staleness if MV refresh fails silently | Low | Source badge exposes freshness; monitor `__UPDATED_ON` |
| Token expiry mid-request for long-running queries | Low | 30s timeout per query; refresh token on 401 |
| shared_db version conflict between modules | Medium | Semantic versioning; pin in each wheel's deps |
| Gold schema change breaks QuerySpec SQL | Medium | Integration tests per module; view abstraction layer |

---

## Appendix A: Current Gold Layer Inventory

### Materialized Views (pre-computed, refreshed daily 06:00 UTC)

| MV | Purpose | Upstream Dependencies |
|----|---------|----------------------|
| `gold.metric_yield_per_order` | Per-order yield with UOM conversion | `gold_adp_movement`, `gold_process_order`, `gold_material` |
| `gold.metric_yield_daily` | Daily yield aggregation by plant | `metric_yield_per_order` |
| `gold.metric_downtime_daily` | Daily downtime by reason/plant | `vw_gold_downtime_and_issues`, `vw_gold_process_order` |
| `gold.metric_quality_daily` | Daily quality acceptance/rejection | `vw_gold_inspection_result`, `vw_gold_process_order`, `vw_gold_inspection_usage_decision` |
| `gold.metric_equipment_state_snapshot` | Latest state per instrument | `vw_gold_equipment_history` |
| `gold.spc_correlation_source_mv` | SPC control chart data | SPC-specific views |
| `gold.spc_material_dim_mv` | SPC material dimension | SPC-specific views |
| `gold.spc_plant_material_dim_mv` | SPC plant-material dimension | SPC-specific views |
| `gold.spc_process_flow_source_mv` | SPC process flow graph | SPC-specific views |

### Curated Views (real-time, join encapsulation)

| View | Purpose | Schema |
|------|---------|--------|
| `vw_gold_order_summary` | Order list with confirmations + receipts + material | `csm_process_order_history` |
| `vw_gold_quality_result_enriched` | Quality 4-way join (result, lot, spec, material) | `csm_process_order_history` |
| `vw_gold_day_view_blocks` | Day view with PROCESS_LINE from silver | `csm_process_order_history` |

### Missing (must create before module migration)

| View | Needed By | Provides |
|------|-----------|----------|
| `vw_gold_process_order_plan` | Quality/Lab | PROCESS_ORDER_ID → PROCESS_LINE mapping |

---

## Appendix B: Adapter Interface Contract (Pseudocode)

```python
class ProcessOrderPort(Protocol):
    """Typed data-access interface for the POH module."""

    async def fetch_orders(
        self, plant_id: str, date_from: date, date_to: date, status: list[str] | None
    ) -> OrderListResponse: ...

    async def fetch_yield_daily(
        self, plant_id: str, days: int = 30
    ) -> YieldDailyResponse: ...

    async def fetch_day_view_blocks(
        self, plant_id: str, target_date: date
    ) -> DayViewResponse: ...


class LabPort(Protocol):
    """Typed data-access interface for the Quality/Lab module."""

    async def fetch_failures(
        self, plant_id: str, lot_type: str | None = None
    ) -> LabFailuresResponse: ...

    async def fetch_plants(self) -> LabPlantsResponse: ...
```

Each adapter (mock, legacy-api, databricks-api) implements the relevant Protocol.
The router depends only on the Protocol — never on a concrete adapter.

---

## Appendix C: Data Volume Reference

| Table/View | Rows | Source | Notes |
|-----------|------|--------|-------|
| `silver.silver_inventory_movement` | 154.7M | SAP | No duplicates, key: doc+year+item |
| `gold.gold_adp_movement` | 5,852 | Tulip | No duplicates, key: ID (GUID). MATERIAL_DOCUMENT 100% NULL |
| `gold.gold_process_order` | ~1,175 | Tulip | 2 plants only (C113, C274) |
| `gold.gold_process_order_material` | 1,186 | Tulip | PO_MATERIAL_BATCH_ID composite key |
| `silver.silver_process_order_phase` | 9,910 | Tulip | Busiest table: ~100-250 rows/day |
| `gold.gold_plant` | small | SAP | Plant ID → Name lookup (all plants) |
| `tulip_bronze.process_order_material` | 1,224 | Tulip API | 26 duplicates (deduped at silver) |
