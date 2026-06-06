# Traceability — First Live API Smoke Test

**Status: AWAITING EXECUTION — no live validation performed as of 2026-05-19**  
**Candidate batch:** `material_id = '000000000020052009'`, `batch_id = '0008602411'`, `plant_id = 'C061'`

> **Browser validation preferred.**
> The V2 app runs on Databricks Apps, which injects the authenticated user's OAuth token
> as `x-forwarded-access-token`. Local `curl` cannot replicate this header without manual
> token extraction. For all authentication and data-access scenarios, validate through
> the deployed app in a browser where possible. Use `curl` only for basic connectivity checks
> or when a browser session has already been established.

---

## Current adapter wire status

Before testing, confirm which adapters are active in the deployed build.

| Route | Adapter tier | Notes |
|---|---|---|
| `POST /api/trace2/batch-header` | `legacy-api` (V1 proxy) | Forwarded to V1 backend via `V1_TRACE_API_BASE_URL` |
| `POST /api/trace2/trace-graph` | `databricks-api` (native) | Requires `BACKEND_ADAPTER_MODE=databricks-api` |
| Mass balance | `mock` | No live route wired yet |
| Customer exposure | `mock` | No live route wired yet |
| Supplier exposure | `mock` | No live route wired yet |
| CoA / quality | `mock` | No live route wired yet |

Source badges in the deployed app should reflect the active adapter tier for each panel.

---

## Prerequisites

Before running any test:

- [ ] V2 app is deployed to a Databricks Apps environment (not local dev).
- [ ] Tester is authenticated via AAD OAuth (not a service principal).
- [ ] `BACKEND_ADAPTER_MODE=databricks-api` is confirmed in app configuration.
- [ ] `V1_TRACE_API_BASE_URL` is set and points to the correct V1 backend.
- [ ] Unity Catalog grants are active for the tester's identity (see `docs/security/unity-catalog-authorization-prerequisite.md`).
- [ ] Candidate batch `000000000020052009 / 0008602411` is confirmed to exist in the target environment (run Section 6 of `traceability-first-live-validation-sql.md` first).

---

## Placeholder conventions for curl examples

```bash
APP_BASE_URL="https://<your-databricks-apps-domain>"
# Note: x-forwarded-access-token is injected automatically by Databricks Apps.
# For local curl testing, extract a short-lived token from the browser DevTools
# Network tab — never hardcode or commit tokens.
AUTH_HEADER="x-forwarded-access-token: <user-oauth-token>"
```

---

## Route 1 — POST /api/trace2/batch-header

**Adapter tier:** `legacy-api` — proxied to V1 backend  
**What it does:** Returns batch header metadata (material, plant, status, dates) for a given material_id + batch_id.

### 1.1 Success — known valid batch

**Request:**
```bash
curl -s -X POST "$APP_BASE_URL/api/trace2/batch-header" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"material_id": "000000000020052009", "batch_id": "0008602411"}'
```

**Expected success shape (V1 response, then mapped by frontend adapter):**
- HTTP 200
- Response body contains a JSON object with batch identity fields.
- Frontend adapter maps to `BatchHeaderSummary`:
  `{ materialId, batchId, materialDescription, plantId, plantName, stockStatus, qualityStatus, releaseStatus, quantity, uom, manufactureDate?, expiryDate?, processOrderId? }`
- Source badge on the panel reads `legacy-api`.

**What to capture:**
- Exact response body.
- Field values for `stockStatus`, `qualityStatus`, `releaseStatus`, `batchStatus`.
- Whether `plantName` is populated.
- Whether `manufactureDate` and `expiryDate` are populated.
- Compare against V1 direct output for the same batch (parity check).

### 1.2 Not found — invalid batch

**Request:**
```bash
curl -s -X POST "$APP_BASE_URL/api/trace2/batch-header" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{"material_id": "000000000000000000", "batch_id": "INVALID-BATCH-9999"}'
```

**Expected:**
- HTTP 404 from V1 backend → proxied as HTTP 404 from V2 API.
- Frontend adapter maps to `{ ok: false, error: { code: 'not-found', ... } }`.
- Cockpit shows "Batch not found" banner (not a blank panel or infinite spinner).

### 1.3 Unauthorized (insufficient permissions)

**Test approach:** Use a user account that does not have `trace.read` permission or V1 backend access.

**Expected:**
- HTTP 401 from V1 backend → proxied as HTTP 401 from V2 API.
- Frontend adapter maps to `{ ok: false, error: { code: 'unauthorized', ... } }`.
- Cockpit shows "Not authorized or data not accessible" banner.
- **Critical:** 401 must not be silently treated as "no data" or an empty state.

### 1.4 V1 backend unavailable

**Test approach:** Deploy with `V1_TRACE_API_BASE_URL` pointing to an unreachable host, or test with the V1 service stopped.

**Expected:**
- HTTP 502 or 503 from V2 API.
- Frontend adapter maps to `{ ok: false, error: { code: 'network' | 'timeout', ... } }`.
- Cockpit shows "Batch header unavailable" or "Data source timeout" banner.

---

## Route 2 — POST /api/trace2/trace-graph

**Adapter tier:** `databricks-api` — native Databricks SQL WITH RECURSIVE  
**What it does:** Executes a recursive lineage traversal against `gold_batch_lineage` in Unity Catalog.  
**Requires:** `BACKEND_ADAPTER_MODE=databricks-api`; active Unity Catalog grants for the tester.

### 2.1 Success — known valid batch

**Request:**
```bash
curl -s -X POST "$APP_BASE_URL/api/trace2/trace-graph" \
  -H "Content-Type: application/json" \
  -H "$AUTH_HEADER" \
  -d '{
    "material_id": "000000000020052009",
    "batch_id": "0008602411",
    "plant_id": "C061",
    "direction": "both",
    "max_depth": 3,
    "max_edges": 1000
  }'
```

**Expected success shape:**
- HTTP 200
- Response body conforms to `TraceGraph` schema:
  `{ nodes: [...], edges: [...], truncated: boolean, warnings: string[], unresolvedNodeCount: number }`
- `nodes` array is non-empty (batch has lineage).
- `edges` contain `linkType` values (e.g. `PRODUCTION`, `BATCH_TRANSFER`, `VENDOR_RECEIPT`).
- Source badge reads `databricks-api`.

**What to capture:**
- Node count, edge count.
- `truncated` value.
- Distinct `linkType` values in edge objects.
- Whether `direction` on nodes is `upstream` | `downstream` as expected.
- Confirm raw LINK_TYPE values match assumptions in `gold_batch_lineage` (cross-ref with SQL Section 6).

### 2.2 Requires BACKEND_ADAPTER_MODE

**Request:** Same as 2.1 but deploy with `BACKEND_ADAPTER_MODE` unset or set to `mock`.

**Expected:**
- HTTP 503 with detail `trace-graph requires BACKEND_ADAPTER_MODE=databricks-api`.
- Frontend adapter maps to `{ ok: false, error: { code: 'unknown', ... } }`.

### 2.3 Unauthorized (Unity Catalog access denied)

**Test approach:** Use a user account without UC grants for `gold_batch_lineage`.

**Expected:**
- HTTP 401 or 403 from Databricks SQL Warehouse, propagated as HTTP 401 by the V2 API.
- Frontend adapter maps to `{ ok: false, error: { code: 'unauthorized', ... } }`.
- Trace Graph panel shows an error card.
- **Critical:** Access denied must not produce an empty graph or silent zero-node result.

### 2.4 Empty lineage (batch exists but no edges)

**Test approach:** Submit a batch that exists in `gold_batch_stock_v` but has no rows in `gold_batch_lineage`.

**Expected:**
- HTTP 200 with empty `nodes` and `edges` arrays.
- `truncated: false`, `warnings: []`.
- Trace Graph panel shows an appropriate empty state (not an error card).

### 2.5 Truncation (deep lineage)

**Test approach:** Submit a batch with lineage deeper than `max_depth=3`, or use `max_depth=1` with a known multi-hop batch.

**Expected:**
- `truncated: true` in response.
- `warnings` includes `max_depth_reached` or `max_edges_reached`.
- Trace Graph panel shows amber truncation banner.

---

## Routes not yet wired (mock only)

The following adapters are currently mock-only. There are no live API routes for them. Validate via the browser UI in mock mode only.

| Adapter | Expected mock source badge | Route when wired |
|---|---|---|
| Mass balance | `mock` | `POST /api/trace2/mass-balance` (not yet created) |
| Customer exposure | `mock` | `POST /api/trace2/customer-exposure` (not yet created) |
| Supplier exposure | `mock` | `POST /api/trace2/supplier-exposure` (not yet created) |
| CoA release status | `mock` | `POST /api/trace2/coa-status` (not yet created) |

When these routes are eventually wired, update this doc with the same success / not-found / unauthorized / timeout scenarios as Routes 1–2 above.

---

## Response header evidence

The V2 API sets response headers for Databricks queries. Capture these during live testing:

```
x-databricks-query-id    — Databricks warehouse query ID for debugging
x-databricks-warehouse-id — Confirms which SQL warehouse was used
x-source-adapter-mode    — Should be 'databricks-api' or 'legacy-api'
```

---

## Permission denied — critical constraint

Across all routes: a `401 Unauthorized` or `403 Forbidden` response **must not** be silently
converted to an empty result or a zero-count state. The frontend adapter must propagate it as
`{ ok: false, error: { code: 'unauthorized' } }` so that the UI shows a permission-denied
error card, not a blank panel or a "no data found" message.

Confirm this behaviour for both batch-header and trace-graph routes during the live session.

---

## Evidence to capture for each route

| Field | What to record |
|---|---|
| Route | `/api/trace2/batch-header` or `/api/trace2/trace-graph` |
| HTTP status | Exact status code |
| Source badge in UI | Text shown on panel source badge |
| Key response fields | Values for identity fields, counts, flags |
| Error message (if any) | Exact text of error card or banner |
| Databricks query ID | From response header (trace-graph only) |
| Time to first response | Approximate seconds from click to data visible |
| Screenshot taken | Yes / No |

Record all results in `domain-integrations/traceability/docs/uat-validation-ledger.md`.
