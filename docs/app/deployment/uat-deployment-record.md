# UAT Deployment Record — ConnectIO V2

**Date confirmed:** 2026-05-17
**Confirmed by:** `databricks apps get connectio-v2`

---

## Deployment facts

| Field | Value |
|---|---|
| App name | `connectio-v2` |
| UAT URL | `https://connectio-v2-604667594731808.8.azure.databricksapps.com` |
| Status | **RUNNING** |
| Deployment target | Databricks Apps (Azure Databricks workspace `adb-604667594731808.8.azuredatabricks.net`) |
| Confirmation method | `databricks apps get connectio-v2` — `state: RUNNING` |
| Backend adapter mode | `legacy-api` (set as literal value in `app.yaml`) |
| Frontend adapter mode | `legacy-api` (baked into the React bundle at build time via `VITE_ADAPTER_MODE=legacy-api`) |
| React UI loads | Yes — confirmed in browser |
| Secret scope | `connectio-v2` |

---

## What this deployment proves

> **This proves deployment, startup, and static UI serving only — not data connectivity.**

Specifically confirmed:
- The Databricks App resource exists and starts successfully.
- The FastAPI backend (uvicorn) starts on port 8000.
- The React bundle is served correctly from `/`.
- The Databricks Apps HTTPS endpoint is reachable.

Not yet confirmed:
- V1 proxy routes (expected to return 503 while V1 apps are STOPPED — see below).
- Native Databricks reads (not active — `BACKEND_ADAPTER_MODE=legacy-api`).

---

## V1 backend URL secrets configured

| Secret key | Points to | Status |
|---|---|---|
| `v1-trace-api-base-url` | V1 Trace2 Databricks App endpoint | Configured — V1 app currently STOPPED |
| `v1-wh360-api-base-url` | V1 Warehouse 360 Databricks App endpoint | Configured — V1 app currently STOPPED |
| `v1-poh-api-base-url` | V1 Process Order History Databricks App endpoint | Configured — V1 app currently STOPPED |
| `v1-cq-api-base-url` | V1 Connected Quality Databricks App endpoint | Configured — V1 app currently STOPPED |

All four secrets are set in the `connectio-v2` scope. The V1 Databricks Apps they reference currently have `state: STOPPED`, so all V1-backed domain routes return HTTP 503. This is expected and is not a ConnectIO V2 defect.

---

## Domain panel status in UAT

| Panel | Expected state | Reason |
|---|---|---|
| React shell / workspace nav | Working | Static UI confirmed |
| Trace2 batch header | 503 | V1 app STOPPED |
| Connected Quality lab plants | 503 (legacy-api path) or mock | V1 app STOPPED; databricks-api path inactive |
| Process Order History header | 503 (legacy-api path) or mock | V1 app STOPPED; databricks-api path inactive |
| Warehouse 360 | 503 | V1 app STOPPED |
| SPC, EnvMon | Mock | Not yet wired to V1 |

---

## Native Databricks reads

Not active. `BACKEND_ADAPTER_MODE=legacy-api` in `app.yaml`. The `DATABRICKS_HOST`, `SQL_WAREHOUSE_ID`, and catalog/schema env vars are commented out in `app.yaml`. Switching to databricks-api requires:

1. Setting secrets in the `connectio-v2` scope for `databricks-host`, `sql-warehouse-id`, and catalog vars.
2. Updating `app.yaml` to uncomment those blocks and change `BACKEND_ADAPTER_MODE` to reference a secret or hardcode `databricks-api`.
3. Redeploying.

See `docs/deployment/uat-smoke-test-checklist.md` section C for the full verification sequence.

---

## Deployment infrastructure

| Item | Details |
|---|---|
| Bundle config | `databricks.yml` at repo root |
| Bundle name | `connectio-v2` |
| Target | `uat` (default) |
| Root path | `/Workspace/Shared/.bundle/connectio-v2/uat` |
| Source path | `apps/api` |
| Deploy command | `databricks bundle deploy --target uat` |
| App start | `databricks apps start connectio-v2` (first deploy only) |
| Source deploy | `databricks apps deploy connectio-v2 --source-code-path "/Workspace/Shared/.bundle/connectio-v2/uat/files/apps/api"` |

---

## Key fixes made during this deployment

| Issue | Fix |
|---|---|
| `app.yaml` used nested YAML for `valueFrom` (unsupported) | Rewritten to use `valueFrom: scope/key` string format |
| No `databricks.yml` bundle config existed | Created at repo root |
| `connectio-v2` secret scope did not exist | Created and populated with 4 V1 URL secrets |

> **Note on `valueFrom` syntax:** Databricks Apps requires `valueFrom: scope/key` as a plain string.
> The nested dict form (`valueFrom: {secretScope: ..., secretKey: ...}`) causes "error reading app.yaml file"
> and prevents the app from starting. See `CLAUDE.md` for the permanent rule.
