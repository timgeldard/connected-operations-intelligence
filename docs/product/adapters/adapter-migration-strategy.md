# Adapter Migration Strategy

## The lifecycle: mock → legacy-api → databricks-api

ConnectIO RAD V2 uses a three-tier adapter lifecycle. Every domain-integration
starts at `mock`, may bridge through `legacy-api` for V1 parity, and advances
toward `databricks-api` as Unity Catalog sources and QuerySpec routes are
verified. Some native Databricks routes now exist before every legacy V1 route
is fully verified because the V1 apps are stopped or being retired.

```
mock  →  legacy-api  →  databricks-api
  │            │               │
  │        V1 bridge        QuerySpec/UC
  │        (FastAPI)        (FastAPI)
  │
  └─ mock only when explicitly selected or when a legacy adapter intentionally delegates to base fixtures
```

---

## When to use each tier

| Tier | Use when | Data source |
|---|---|---|
| `mock` | V1 endpoint unknown, unavailable, or unverified | Static fixture file |
| `legacy-api` | V1 endpoint confirmed + browser-tested; V1 backend is authoritative | FastAPI proxy → V1 |
| `databricks-api` | Data is available in Unity Catalog and route/query contract is verified | FastAPI QuerySpec route → Databricks SQL warehouse |

---

## Advancing from mock to legacy-api

A method may be overridden in the legacy adapter only when:

1. **V1 endpoint confirmed** — the endpoint URL, HTTP method, and request/response shape are known from the V1 source system team
2. **Proxy route added** — a corresponding route exists in `apps/api/routes/<domain>.py`
3. **Browser-verified** — the proxy route has been tested end-to-end in a browser against a live V1 backend (not just unit-tested)
4. **Contract tests written** — `<domain>-legacy-api-adapter.test.ts` covers: success, 401, 404, 500, network failure, and fallback-to-mock when context is missing

Do not advance to legacy-api based on V1 API documentation alone — field names, casing, and data presence are only reliably known after live testing.

---

## Advancing from legacy-api to databricks-api

A method may be exposed as a native Databricks route only when:

1. **Data available in Databricks** — the equivalent data is queryable from Unity Catalog or a Databricks SQL warehouse
2. **QuerySpec defined** — backend reads go through QuerySpec / QueryExecutor, not SQL embedded in React or route handlers
3. **Identity preserved** — production reads use the authenticated user's Databricks OAuth identity; no service-principal or PAT fallback
4. **Schema validated** — the Databricks response maps cleanly to the `@connectio/data-contracts` type and backend Pydantic model
5. **Error behavior explicit** — no silent fallback to mock or V1 when native execution is unavailable
6. **Browser verification tracked** — route/UI status is recorded in the deployment verification docs

Frontend implementation varies by domain. POH has an explicit
`ProcessOrderReviewDatabricksApiAdapter`. Traceability, EnvMon, Warehouse, and
CQ Lab currently call native backend routes through the same FastAPI HTTP layer
used by legacy adapters, often under `VITE_ADAPTER_MODE=legacy-api` for
same-origin Databricks Apps compatibility. The source badge and response
headers are authoritative for the actual data source.

---

## Adding a new override: step-by-step

### legacy-api override

1. Get the V1 endpoint spec (URL, method, request/response shape)
2. Add a proxy route in `apps/api/routes/<domain>.py` following the existing pattern:
   ```python
   @router.post("/<domain>/<endpoint>")
   async def endpoint_handler(body: RequestModel, ...) -> dict:
       return await _forward_post("/api/v1/...", body.model_dump(), token)
   ```
3. Register the router in `apps/api/main.py` if not already done
4. Test the proxy route manually: `curl -X POST http://127.0.0.1:8000/api/<domain>/<endpoint>`
5. Override the adapter method in `<domain>-legacy-api-adapter.ts`:
   ```typescript
   override async getMethodName(request): Promise<AdapterResult<ContractType>> {
     if (!request.requiredField) return super.getMethodName(request)
     // fetch, map, return with source: 'legacy-api'
   }
   ```
6. Map V1 snake_case fields to contract types using `??` fallbacks for camelCase variants
7. Always set `source: 'legacy-api'` on both success and error returns
8. Write contract tests in `<domain>-legacy-api-adapter.test.ts`
9. Browser-verify the end-to-end flow with `VITE_ADAPTER_MODE=legacy-api`

### databricks-api override

1. Add a QuerySpec factory and mapper in `apps/api/adapters/<domain>/`.
2. Add or update the route in `apps/api/routes/<domain>.py`.
3. Gate the route with `BACKEND_ADAPTER_MODE=databricks-api`.
4. Require OAuth identity and Databricks config through the shared helpers.
5. Execute with `run_query(...)`; do not put SQL directly in route handlers.
6. Return source headers:
   - `X-Data-Source: databricks-api`
   - `X-Adapter-Mode: databricks-api`
   - `X-Query-Name: <domain>.<query>`
7. Map known errors explicitly: 401, 403, 429, 502, 503, 504.
8. Add route tests, mapper tests, and frontend adapter tests where applicable.
9. Browser-verify the API and UI before marking the route verified.

---

## Fallback rules

Legacy adapters may intentionally delegate to mock fixtures for methods that
are not implemented or for missing optional context. Native Databricks routes
do not use this fallback pattern.

```
Mock mode          → fixture data, no network calls
Legacy-api mode    → V1 proxy for overridden methods; base fixtures for non-overridden methods
Databricks routes  → QuerySpec execution or explicit error; no mock / V1 fallback
```

This means:
- A panel never crashes due to an unimplemented adapter method
- Mock or fallback data must be visibly mock/no-source or explicitly labeled
- Native failures show honest error states instead of pretending data is live
- Source badge visibility makes the data origin transparent to users

---

## Code comments and type annotations

Add a JSDoc comment to every overridden method explaining its tier status:

```typescript
/**
 * Proxy to V1 batch-header endpoint.
 * Tier: legacy-api — browser-verified 2024-03-08.
 * Next tier: databricks-api (pending V1 Trace2 retirement).
 */
override async getBatchHeaderSummary(request): Promise<AdapterResult<BatchHeaderSummary>> {
```

Mark each adapter class with its tier in its class JSDoc:

```typescript
/**
 * Tier: legacy-api
 * Verified methods: getBatchHeaderSummary
 * Fallback: Trace2Adapter (mock)
 */
export class Trace2LegacyApiAdapter extends Trace2Adapter {
```

---

## Current state (as of 2026-05-20)

| Domain | Native Databricks status | Remaining mock / legacy surface |
|---|---|---|
| Traceability | Trace Graph / lineage route is functional and browser-verified in the shell UI. | Batch-header and mass-balance native routes still need DDL/source verification; some panels remain mock or legacy. |
| EnvMon | `site-summary` and `swab-results` native routes are functional and consumed by the read-only monitoring screen. | Spatial/floorplan/zoning/heatmap and CAPA are deferred; older mock panels remain outside the native primary path. |
| POH / Process Order Review | Order header, operations, confirmations, and goods movements are functional native slices. | Related batches, quality context, staging context, and some review surfaces are still mock/pending. |
| Warehouse 360 | Native route groundwork exists for overview/inbound/outbound/staging/exceptions; overview returned HTTP 200 in UAT. | Inbound/outbound/staging/exceptions need schema/source alignment before verification can be marked complete. |
| Quality / CQ Lab | Lab plants native route is browser-verified. | Lab failures is blocked by missing source view; batch release decision panels remain simulated unless separately wired. |
| SPC | Native/legacy adapter scaffolding exists for selected live-source work. | Most SPC monitoring panels remain mock or gated pending UAT/source validation. |
| Maintenance | No native Databricks path yet. | Maintenance panels remain mock. |

---

## Governance

- Tier advancement for a method is a **product decision**, not just a technical one — confirm with the domain owner that the V1 endpoint is stable and the data contract is agreed
- The `source` badge in the UI makes the adapter tier visible to end users and pilots — amber = legacy-api, green = databricks-api
- Pilot sign-off criteria in `docs/adr/ADR-016-pilot-validation-and-signoff-model.md` include a requirement that all panels used in the pilot are at `legacy-api` tier or higher for the workspaces under test
- Do not advance a method to `legacy-api` without the corresponding contract tests — the tests are the audit trail that the V1 contract was understood and validated
