# Deploying ConnectIO V2 to Databricks Apps

## Overview

ConnectIO V2 runs as a single Databricks App that combines a FastAPI backend
(the V2 proxy layer) with the React frontend served as static files.
Databricks Apps handles HTTPS termination, identity forwarding, and access
control — the app itself does not implement authentication.

```
Browser → Databricks Apps (TLS + OAuth2) → FastAPI (apps/api/)
                                              ├── /api/...   V1 proxy or native Databricks QuerySpec routes
                                              └── /          static React bundle
```

> **UAT status (2026-05-20):** App is RUNNING with
> `BACKEND_ADAPTER_MODE=databricks-api`. Native Databricks reads are functional
> for Traceability lineage, EnvMon site summary/swab results, multiple POH
> process-order slices, Warehouse 360 overview groundwork, and CQ Lab plants.
> Some legacy V1 proxy routes remain wired for fallback/parity work, but V1
> apps may be stopped and should not be assumed reachable.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Databricks workspace (Premium or above) | Databricks Apps requires Unity Catalog enabled |
| Databricks CLI ≥ 0.220 | `databricks --version` |
| Python 3.11+ on the build machine | For local validation only |
| Node.js 20+ and npm 10+ | To build the React frontend |
| `connectio-v2` secret scope in the target workspace | See [Secret scope setup](#secret-scope-setup) |

---

## Secret scope setup

Create the scope and add the V1 backend URL secrets before the first deploy.
Replace the placeholder values with the actual internal service URLs for the
target environment.

```bash
# Create the scope (skip if it already exists)
databricks secrets create-scope connectio-v2

# V1 Trace2 backend
databricks secrets put-secret connectio-v2 v1-trace-api-base-url \
  --string-value "https://<trace2-service-host>"

# V1 Warehouse 360 backend
databricks secrets put-secret connectio-v2 v1-wh360-api-base-url \
  --string-value "https://<wh360-service-host>"

# V1 Process Order History backend
databricks secrets put-secret connectio-v2 v1-poh-api-base-url \
  --string-value "https://<poh-service-host>"

# V1 Connected Quality Lab backend
databricks secrets put-secret connectio-v2 v1-cq-api-base-url \
  --string-value "https://<cq-service-host>"
```

Secrets are encrypted at rest and never appear in logs or environment variable
listings. The app reads them at startup via `valueFrom: scope/key` entries in
`apps/api/app.yaml` — Databricks Apps requires this string form; nested YAML dicts are not supported.

---

## Build

Run these steps from the repository root.

### 1. Install dependencies

```bash
npm install
```

### 2. Build and package (recommended: use the preparation script)

```bash
npm run prepare:databricks
```

This runs `scripts/prepare-databricks-app.mjs`, which:

1. Sets safe VITE env var defaults for same-origin deployment
2. Builds the React frontend via `nx run web:build`
3. Removes any stale `apps/api/static/` directory
4. Copies `apps/web/dist/` → `apps/api/static/`
5. Verifies `apps/api/static/index.html` exists

#### Manual equivalent

```bash
VITE_ADAPTER_MODE=legacy-api \
VITE_TRACE_API_BASE_URL="" \
VITE_WH360_API_BASE_URL="" \
VITE_POH_API_BASE_URL="" \
VITE_CQ_API_BASE_URL="" \
npm exec nx -- run web:build

rm -rf apps/api/static
cp -r apps/web/dist apps/api/static
```

`VITE_ADAPTER_MODE` and the per-domain base URLs are baked into the bundle at
build time. Leave base URL vars empty for same-origin Databricks Apps
deployment so fetch calls resolve against the current host. Set them to the
full API host only when the React app and API are on different origins.

**Two-layer adapter model:** frontend adapter mode controls whether panels call
FastAPI over HTTP instead of returning mock fixtures. Backend adapter mode
controls whether those FastAPI routes proxy to V1 or execute native Databricks
QuerySpecs. For same-origin Databricks Apps builds, `VITE_ADAPTER_MODE=legacy-api`
is still valid for domains whose HTTP adapter calls native backend routes.
Some packages, such as Process Order Review, also expose an explicit frontend
`databricks-api` adapter. In both cases, Databricks itself is accessed only
through FastAPI; React does not execute SQL or hold Databricks credentials.

> **Note:** `apps/api/static/` is **committed to git** so that `databricks bundle deploy`
> can include the compiled React bundle without a build step in the deploy pipeline.
> Run `npm run prepare:databricks` and commit the updated `apps/api/static/` before
> each deploy whenever the frontend changes.

### 3. Python dependencies

Databricks Apps installs Python packages from `apps/api/requirements.txt`.
This file lists only public PyPI packages:

```
fastapi>=0.111
uvicorn[standard]>=0.29
httpx>=0.27
```

`apps/api/pyproject.toml` also declares `shared-db = { workspace = true }` as
a uv workspace source, but Databricks Apps uses pip, not uv. None of the route
modules import `shared_db`, so `requirements.txt` without it is correct. Do
not add `shared-db` to `requirements.txt`.

---

## Deploy

The repo root contains a `databricks.yml` bundle configuration. Use it for all deploys:

```bash
# 1. Build and package the frontend
npm run prepare:databricks

# 2. Upload source to workspace and create/update the app resource
databricks bundle deploy --target uat

# 3. Start the app compute (first deploy only — it starts stopped)
databricks apps start connectio-v2

# 4. Deploy source code to the running compute
databricks apps deploy connectio-v2 \
  --source-code-path "/Workspace/Shared/.bundle/connectio-v2/uat/files/apps/api"
```

For subsequent deploys (compute already running), steps 3–4 only:

```bash
npm run prepare:databricks && databricks bundle deploy --target uat
databricks apps deploy connectio-v2 \
  --source-code-path "/Workspace/Shared/.bundle/connectio-v2/uat/files/apps/api"
```

### Verify

```bash
databricks apps get connectio-v2
```

The `url` field in the response is the public HTTPS endpoint.
Open `<url>/health` — it should return `{"status": "ok"}`.

**Live UAT URL:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`

---

## Local production smoke-test

Run this before deploying to Databricks Apps to verify the build artefact is
self-contained and the proxy wiring is correct.

### Prerequisites

- Python 3.11+ with `pip`
- The frontend built and copied (run `npm run prepare:databricks` first)

### Steps

```bash
# Install Python deps (from repo root)
pip install -r apps/api/requirements.txt

# Start the local server from apps/api/ (single process is fine for smoke-test)
cd apps/api
V1_TRACE_API_BASE_URL="https://<trace2-host>" \
V1_WH360_API_BASE_URL="https://<wh360-host>" \
V1_POH_API_BASE_URL="https://<poh-host>" \
V1_CQ_API_BASE_URL="https://<cq-host>" \
uvicorn main:app --host 0.0.0.0 --port 8000
```

Omit the `V1_*` vars if the V1 backends are not reachable — proxy routes will return 503,
but the React app and `/health` should still work.

### What to check

| URL / request | Expected result |
|---|---|
| `GET http://localhost:8000/health` | `{"status": "ok"}` |
| `GET http://localhost:8000/` | React app loads (ConnectIO login or workspace shell) |
| `GET http://localhost:8000/?workspace=trace-investigation` | Trace workspace renders |
| Browser refresh on any `?workspace=X` URL | React app reloads correctly (search params preserved) |
| `POST http://localhost:8000/api/trace2/batch-header` body `{"material_id":"<id>","batch_id":"<id>"}` | V1 response (with V1 set) or `{"detail":"V1_TRACE_API_BASE_URL is not configured"}` 503 |
| `POST http://localhost:8000/api/wh360/warehouse-summary` body `{"warehouse_id":"<id>"}` | V1 response or 503 |
| `POST http://localhost:8000/api/por/order-header` body `{"process_order_id":"<id>"}` | V1 response or 503 |
| `GET http://localhost:8000/api/cq/lab/fails?plant_id=IE10` | V1 response or 503 |
| `GET http://localhost:8000/api/cq/lab/plants` | V1 response or 503 |

**Note:** all three proxy endpoints accept `snake_case` request fields only (`material_id`, `batch_id`,
`warehouse_id`, `process_order_id`, `plant_id`). The TypeScript adapters already send snake_case — do
not send camelCase to the proxy.

**Source badge:** With V1 reachable, the batch header panel should show
`source: legacy-api`. With V1 unreachable, only `getBatchHeaderSummary`
falls back to mock — all other methods always return mock data until
browser-verified.

**Static serving:** The app routes via URL search params (`?workspace=X`),
not URL path segments. Every navigation sends `GET /` to the server, which
`StaticFiles(html=True)` handles correctly. There are no path-segment deep
links that require a catch-all route.

---

## Databricks Apps smoke-test checklist

After deploying to Databricks Apps, verify in order:

- [ ] `databricks apps get connectio-v2` shows `state: RUNNING`
- [ ] `<url>/health` returns `{"status": "ok"}` (confirms uvicorn started)
- [ ] `<url>/` loads the React app without blank page or JS errors
- [ ] Navigate to a workspace (`?workspace=trace-investigation`) — renders correctly
- [ ] Browser refresh on `<url>/?workspace=trace-investigation` — React app reloads (not 404)
- [ ] Traceability lineage route returns `X-Data-Source: databricks-api`
- [ ] EnvMon `site-summary` and `swab-results` return `X-Data-Source: databricks-api`
- [ ] POH order header / operations / confirmations / goods movements return source headers or specific source errors
- [ ] Warehouse 360 overview returns source headers or a documented schema/source error
- [ ] CQ Lab plants returns source headers or a documented source error
- [ ] Check Databricks Apps logs: `databricks apps logs connectio-v2` — no startup errors

**Expected failures (not blockers when documented):** some Warehouse 360 native
routes are schema/source blocked; CQ Lab failures is blocked by source view
availability; Traceability batch-header / mass-balance native paths still need
DDL verification. These should show honest API errors or deferred UI states,
not live-looking mock data.

---

## Serving static files from FastAPI

`apps/api/main.py` mounts the React bundle after all API routers:

```python
import os
from fastapi.staticfiles import StaticFiles

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
```

Place this **after** all `app.include_router(...)` calls so API routes take
precedence over the static fallback.

**Why `html=True` is sufficient:** The app navigates entirely via URL search
parameters (`?workspace=X&view=Y`). The server always receives `GET /`
regardless of which workspace the user is viewing. A catch-all route for
path-segment deep links is not needed.

---

## Environment variable reference

| Variable | Source | Purpose |
|---|---|---|
| `V1_TRACE_API_BASE_URL` | Secret scope | Base URL of the V1 Trace2 proxy target |
| `V1_WH360_API_BASE_URL` | Secret scope | Base URL of the V1 Warehouse 360 proxy target |
| `V1_POH_API_BASE_URL` | Secret scope | Base URL of the V1 Process Order History proxy target |
| `V1_CQ_API_BASE_URL` | Secret scope | Base URL of the V1 Connected Quality backend |
| `BACKEND_ADAPTER_MODE` | app.yaml literal | `legacy-api` or `databricks-api`. Controls whether POH and CQ Lab routes query Databricks directly or proxy to V1. Currently `databricks-api` in UAT. |
| `DATABRICKS_HOST` | app.yaml literal | Full Databricks workspace URL including `https://`. Required when `BACKEND_ADAPTER_MODE=databricks-api`. |
| `SQL_WAREHOUSE_ID` | app.yaml literal | SQL Warehouse ID to run statements against. Required when `BACKEND_ADAPTER_MODE=databricks-api`. |
| `POH_CATALOG` | app.yaml literal | Unity Catalog name for the POH domain (e.g. `connected_plant_uat`). Required when `BACKEND_ADAPTER_MODE=databricks-api` and POH route is active. |
| `POH_SCHEMA` | app.yaml literal (optional) | Schema name for POH views. Defaults to `csm_process_order_history` if unset. |
| `CQ_CATALOG` | app.yaml literal | Unity Catalog name for the CQ domain. Required when `BACKEND_ADAPTER_MODE=databricks-api` and CQ Lab routes are active. Falls back to `TRACE_CATALOG` if unset (V1-compatible). |
| `CQ_SCHEMA` | app.yaml literal (optional) | Schema name for CQ tables. Defaults to `csm_process_order_history` if unset. Note: CQ lab plants always uses `gold` schema regardless of this setting. |
| `TRACE_CATALOG` | app.yaml literal (commented out) | Unity Catalog name for the Trace2 domain. Required when `BACKEND_ADAPTER_MODE=databricks-api` and Trace2 routes are active. Also used as `CQ_CATALOG` fallback. |
| `TRACE_SCHEMA` | app.yaml literal (optional) | Schema name for Trace2 gold views. Defaults to `gold` if unset. |
| `VITE_CQ_API_BASE_URL` | Build env | Frontend base URL for CQ API (empty = same-origin Databricks Apps deployment) |
| `ADAPTER_MODE` | app.yaml literal | Informational only — the frontend adapter mode is baked into the JS bundle at build time |
| `PYTHONUNBUFFERED` | app.yaml literal | Ensures FastAPI logs appear immediately in Databricks Apps log stream |
| `PORT` | Injected by Databricks Apps | Databricks may override the port; current app.yaml binds to 8000 regardless — align if needed |

### Databricks-api mode secrets

To enable native Databricks reads, add the following secrets and update `app.yaml`:

```bash
databricks secrets put-secret connectio-v2 backend-adapter-mode \
  --string-value "databricks-api"

databricks secrets put-secret connectio-v2 databricks-host \
  --string-value "<workspace>.azuredatabricks.net"

databricks secrets put-secret connectio-v2 sql-warehouse-id \
  --string-value "<warehouse-id>"
```

In `app.yaml` (use the `scope/key` string format — nested YAML is not supported):
```yaml
env:
  - name: BACKEND_ADAPTER_MODE
    valueFrom: connectio-v2/backend-adapter-mode
  - name: DATABRICKS_HOST
    valueFrom: connectio-v2/databricks-host
  - name: SQL_WAREHOUSE_ID
    valueFrom: connectio-v2/sql-warehouse-id
```

### Databricks Apps OAuth headers (identity forwarding)

Databricks Apps injects the following headers into every authenticated request. The backend reads these to extract the user's OAuth identity for Databricks queries:

| Header | Purpose | Verified in production? |
|---|---|---|
| `x-forwarded-access-token` | End-user OAuth bearer token | **Confirmed 2026-05-17** — `token_present: true`, `token_length_bucket: "long"` |
| `x-forwarded-user` | User identifier | **Confirmed 2026-05-17** — `user_header_present: true` |
| `x-forwarded-email` | User email address | **Confirmed 2026-05-17** — `email_header_present: true` |

Header names are confirmed correct. `identity.py` is authoritative.

---

## Updating secrets

To rotate a V1 backend URL without redeploying the app:

```bash
databricks secrets put-secret connectio-v2 v1-trace-api-base-url \
  --string-value "https://<new-host>"
```

The running app reads secrets at startup only — restart the app after rotating:

```bash
databricks apps stop connectio-v2
databricks apps start connectio-v2
```

---

## CI/CD sketch

A minimal pipeline for automated deploys:

```yaml
# Example: GitHub Actions step sequence (adapt to your CI)
steps:
  - name: Install deps
    run: npm install

  - name: Build and package
    run: npm run prepare:databricks
    env:
      # Defaults to same-origin (empty base URLs). Override if cross-origin.
      VITE_ADAPTER_MODE: legacy-api

  - name: Deploy to Databricks
    run: |
      databricks apps deploy connectio-v2 \
        --source-code-path apps/api
    env:
      DATABRICKS_HOST: ${{ secrets.DATABRICKS_HOST }}
      DATABRICKS_TOKEN: ${{ secrets.DATABRICKS_TOKEN }}
```

Store `DATABRICKS_HOST` and `DATABRICKS_TOKEN` as CI secrets — never commit
them.

---

## Readiness status

| Area | Status | Notes |
|---|---|---|
| Build packaging | Ready | `requirements.txt` contains only PyPI packages; `shared-db` excluded |
| Static serving | Ready | `StaticFiles(html=True)` correct for search-param routing |
| OAuth identity forwarding | Confirmed 2026-05-17 | All three `x-forwarded-*` headers verified; `sql` scope in user token confirmed |
| Traceability lineage (databricks-api) | Browser-verified 2026-05-18 | Trace graph / shell UI confirmed against `gold_batch_lineage`; source badge green |
| EnvMon site summary + swab results (databricks-api) | API browser-verified / UI wired | `GET /api/envmon/site-summary` and `GET /api/envmon/swab-results`; spatial/CAPA deferred |
| POH native slices (databricks-api) | Browser-verified 2026-05-17/18 | Order header, operations, confirmations, and goods movements verified on selected process orders |
| Warehouse 360 overview (databricks-api) | UAT HTTP 200 | Overview route returned real WH360 KPI payload; other WH360 routes still need schema/source alignment |
| CQ Lab plants (databricks-api) | Browser-verified 2026-05-17 | `GET /api/cq/lab/plants` returns real data; `X-Data-Source: databricks-api` |
| Trace2 proxy (legacy-api) | Partially verified legacy path | `getBatchHeaderSummary` V1 proxy browser-verified historically; V1 reachability may be stopped in UAT |
| WH360 proxy | Not yet verified legacy path | `POST /api/wh360/warehouse-summary` remains V1 proxy/backlog |
| POH proxy (legacy-api) | Not yet verified | Wired; unverified while V1 STOPPED |
| CQ Lab failures | Blocked | `vw_gold_process_order_plan` view missing in `connected_plant_uat` |
| V1 network connectivity | Not confirmed | Databricks Apps → V1 firewall/private link rules not tested |

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `/health` returns 503 | App failed to start; uvicorn crash | Check `databricks apps logs connectio-v2` |
| Proxy returns 503 on `/api/trace2/batch-header` | `V1_TRACE_API_BASE_URL` secret missing or empty | Re-run `databricks secrets put-secret` |
| Proxy returns 502 | V1 backend unreachable from Databricks network | Verify firewall / private link rules allow egress from the Apps compute to the V1 host |
| React app shows blank page | Static files not copied before deploy | Re-run `npm run prepare:databricks`, then redeploy |
| App returns 401 on all routes | Databricks Apps OAuth2 token not forwarded | Ensure the app's permission settings allow the relevant user groups |
| Source badge shows `mock` instead of `legacy-api` / `databricks-api` | Frontend adapter mode, feature flag, or route wiring did not select an HTTP-backed adapter | Rebuild with the intended VITE mode, check feature flags, and confirm the panel is on a native/legacy path |
| pip install fails during deploy | `shared-db` in requirements | Ensure `apps/api/requirements.txt` is present and does not include `shared-db` |
