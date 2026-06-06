# Adapter Modes: mock / legacy-api / databricks-api

## Overview

Each domain-integration adapter supports three modes, selected at build time via `VITE_ADAPTER_MODE`. The mode determines where panel data comes from and whether any network calls are made.

```
VITE_ADAPTER_MODE=mock            default in development
VITE_ADAPTER_MODE=legacy-api      calls FastAPI proxy → V1 backends
VITE_ADAPTER_MODE=databricks-api  uses explicit frontend Databricks adapters where implemented
```

The value is baked into the JS bundle at build time. Changing it requires a rebuild.

There is also a backend-only `BACKEND_ADAPTER_MODE`. In Databricks Apps UAT the
backend currently runs with `BACKEND_ADAPTER_MODE=databricks-api`, which makes
native routes execute QuerySpec definitions through the FastAPI layer with the
authenticated user's Databricks OAuth identity. Frontend adapters still call
HTTP routes on the same FastAPI app; in several domains the frontend mode
remains `legacy-api` for same-origin API calls even when the backend route is
native Databricks.

---

## Mode: `mock`

The base adapter class for each domain returns realistic fixture data from a static mock-data file. No network calls are made.

**When to use:**
- Local development when V1 backends are unavailable
- Demos and presentations
- Running tests (default)

**Source badge:** none (no badge shown in the UI)

**Data location:**
```
domain-integrations/<domain>/src/adapters/<domain>-mock-data.ts
```

**Activation:**
```bash
# .env.local (or omit VITE_ADAPTER_MODE entirely)
VITE_ADAPTER_MODE=mock
```

---

## Mode: `legacy-api`

The legacy-api adapter extends the mock adapter and overrides specific methods to call the FastAPI proxy at `VITE_LEGACY_API_BASE_URL` (default: `http://127.0.0.1:8000` in development, injected via Databricks Apps in production).

Methods that have been verified against V1 are overridden. All other methods fall back to `super` (mock data). This means the UI never breaks — unverified panels show mock data until their V1 endpoint is confirmed.

**When to use:**
- Integration testing against a real V1 backend
- Production deployment (Databricks Apps)
- Verifying that a new proxy route works end-to-end

**Source badge:** amber badge in every panel whose data came from this mode

**Browser-verified overrides** — tested end-to-end against a live V1 backend:

| Domain | Adapter class | Method | FastAPI route |
|---|---|---|---|
| Traceability | `Trace2LegacyApiAdapter` | `getBatchHeaderSummary` | `POST /api/trace2/batch-header` |

**Wired but not browser-verified** — proxy route and adapter override exist; live V1 testing not yet completed:

| Domain | Adapter class | Method | FastAPI route |
|---|---|---|---|
| Warehouse | `Warehouse360LegacyApiAdapter` | `getWarehouse360Summary` | `POST /api/wh360/warehouse-summary` |
| Operations | `ProcessOrderReviewLegacyApiAdapter` | `getProcessOrderHeader` | `POST /api/por/order-header` |
| Quality | `ConnectedQualityLabLegacyApiAdapter` | `getLabFailures` | `GET /api/cq/lab/fails` |
| Quality | `ConnectedQualityLabLegacyApiAdapter` | `getLabPlants` | `GET /api/cq/lab/plants` |

Do not mark a method as browser-verified until it has been tested end-to-end in a browser with `VITE_ADAPTER_MODE=legacy-api` against a live V1 backend that returned real data.

**Activation:**
```bash
VITE_ADAPTER_MODE=legacy-api
VITE_LEGACY_API_BASE_URL=http://127.0.0.1:8000   # development default
```

**Adding a new override:**
1. Confirm the V1 endpoint exists and returns expected data (browser-verify)
2. Add a proxy route in `apps/api/routes/<domain>.py`
3. Override the corresponding method in `<domain>-legacy-api-adapter.ts`
4. Add contract tests in `<domain>-legacy-api-adapter.test.ts`
5. Do not add routes for endpoints that have not been verified — 502/503 errors break the UI

---

## Mode: `databricks-api`

Partially implemented. Native Databricks routes now exist for Traceability,
EnvMon, POH / Process Order Review, Warehouse 360, and CQ Lab plants. These
routes execute backend QuerySpec definitions through FastAPI; React never
contains SQL.

Important distinction:

- `VITE_ADAPTER_MODE=databricks-api` selects a frontend Databricks adapter only
  in packages that have one, such as Process Order Review.
- `BACKEND_ADAPTER_MODE=databricks-api` selects native backend execution for
  mode-gated API routes.
- Same-origin Databricks Apps builds may still use `VITE_ADAPTER_MODE=legacy-api`
  so the frontend calls FastAPI routes, while those routes execute Databricks
  QuerySpecs on the backend.

Native routes must not silently fall back to mock or legacy data when the
backend is configured for `databricks-api`. Expected failures are explicit
HTTP responses: 401 for missing OAuth, 403 for permission errors, 429 for rate
limit, 502 for query/source errors, 503 for mode/config issues, and 504 for
timeouts.

**Source badge:** green badge when a panel receives `source: 'databricks-api'`

**Activation:**
```bash
# Frontend: only for domain packages with an explicit Databricks adapter.
VITE_ADAPTER_MODE=databricks-api

# Backend: native Databricks execution for QuerySpec routes.
BACKEND_ADAPTER_MODE=databricks-api
DATABRICKS_HOST=https://<workspace-host>
SQL_WAREHOUSE_ID=<warehouse-id>
```

**Current native Databricks route status**

| Domain | Routes / methods | Status |
|---|---|---|
| Traceability | Trace Graph / lineage route (`trace2.get_trace_graph`) | Functional and browser-verified in shell UI on 2026-05-18. Batch-header and mass-balance still require DDL/source verification. |
| EnvMon | `GET /api/envmon/site-summary`, `GET /api/envmon/swab-results` | Functional native API routes; read-only UI consumes them. Spatial/floorplan/CAPA are deferred. |
| POH / Process Order Review | order header, order operations, confirmations, goods movements | Functional native slices; browser verification recorded for these routes. Remaining review panels are still mock or pending native adapters. |
| Warehouse 360 | overview, inbound, outbound, staging, exceptions | Native route groundwork wired. Overview has returned HTTP 200 in UAT; other routes are partly schema/source blocked and require follow-up DDL alignment. |
| Quality / CQ Lab | lab plants, lab failures | CQ Lab has legacy/native discovery evidence from V1 ConnectedQuality. V2 Quality release panels remain mock/simulated; no native Quality release Databricks adapter exists yet. V1 discovery found read-only MIC/usage-decision/CoA-result candidates, but no governed release workflow. |

---

## Adapter factory pattern

Each domain-integration exposes a factory file that reads `VITE_ADAPTER_MODE` exactly once at module init:

```typescript
// domain-integrations/operations/src/adapters/process-order-review-adapter-factory.ts
const mode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
const baseUrl = import.meta.env.VITE_POH_API_BASE_URL ?? ''

export const processOrderReviewAdapterInstance =
  mode === 'databricks-api'
    ? new ProcessOrderReviewDatabricksApiAdapter(baseUrl)
    : mode === 'legacy-api'
      ? new ProcessOrderReviewLegacyApiAdapter(baseUrl)
      : new ProcessOrderReviewAdapter()
```

All React Query hooks import from the factory, not the adapter class directly. This is the only place where `import.meta.env.VITE_ADAPTER_MODE` should be accessed.

---

## Testing adapters

**Mock adapter tests** (`<domain>-adapter.test.ts`):
- Import the base adapter class directly
- Call methods and validate returned data against Zod schemas
- Do not stub `fetch` — no network calls are made

**Legacy adapter tests** (`<domain>-legacy-api-adapter.test.ts`):
- Stub `fetch` with `vi.stubGlobal` using realistic V1-shaped fixtures
- Test all HTTP error codes (401, 404, 500) and network failures
- Verify fallback to mock when required context (e.g. `batchId`) is absent
- Verify `source: 'legacy-api'` on successful responses
- Verify `source: 'legacy-api'` on error responses

**Databricks adapter / native route tests**:
- Frontend adapters stub `fetch` and verify green `source: 'databricks-api'`
- Backend route tests assert mode gating, OAuth/config failures, query names, and `X-Data-Source: databricks-api`
- Mapper tests preserve SAP identifiers as strings and validate Zod/Pydantic contract shape
- No native route may return mock data as a fallback when Databricks execution is unavailable

---

## Environment variable reference

| Variable | Mode | Default | Purpose |
|---|---|---|---|
| `VITE_ADAPTER_MODE` | all | `mock` | Selects adapter tier at build time |
| `VITE_LEGACY_API_BASE_URL` | legacy-api | `http://127.0.0.1:8000` | Historical FastAPI proxy base URL (dev); many same-origin builds now use per-domain empty base URLs instead |
| `VITE_TRACE_API_BASE_URL` | legacy-api frontend | empty | Trace API base URL; empty means same-origin FastAPI |
| `VITE_POH_API_BASE_URL` | legacy-api / databricks-api frontend | empty | POH API base URL; empty means same-origin FastAPI |
| `VITE_WH360_API_BASE_URL` | legacy-api frontend | empty | Warehouse API base URL; empty means same-origin FastAPI |
| `BACKEND_ADAPTER_MODE` | server | `legacy-api` or `databricks-api` | Selects V1 proxy vs native QuerySpec execution for mode-gated backend routes |
| `DATABRICKS_HOST` | databricks-api server | — | Workspace host for native Databricks queries |
| `SQL_WAREHOUSE_ID` | databricks-api server | — | SQL warehouse used by QueryExecutor |
| `TRACE_CATALOG` / `TRACE_SCHEMA` | databricks-api server | `gold` schema default | Traceability Unity Catalog source |
| `POH_CATALOG` / `POH_SCHEMA` | databricks-api server | domain defaults | POH Unity Catalog source |
| `WH360_CATALOG` / `WH360_SCHEMA` | databricks-api server | domain defaults | Warehouse 360 Unity Catalog source |
| `CQ_CATALOG` / `CQ_SCHEMA` | databricks-api server | domain defaults | CQ Lab / SAP QM Unity Catalog source |
| `V1_TRACE_API_BASE_URL` | legacy-api (server) | — | V1 Trace2 backend URL (Databricks secret) |
| `V1_WH360_API_BASE_URL` | legacy-api (server) | — | V1 WH360 backend URL (Databricks secret) |
| `V1_POH_API_BASE_URL` | legacy-api (server) | — | V1 POH backend URL (Databricks secret) |
| `V1_CQ_API_BASE_URL` | legacy-api (server) | — | V1 Connected Quality backend URL (Databricks secret) |

Server-side variables are injected by Databricks Apps from the `connectio-v2`
secret scope or `app.yaml` literals. They are never hardcoded in the repo.
