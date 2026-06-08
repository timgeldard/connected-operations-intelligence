# EnvMon Native Databricks Architecture Check

**Date:** 2026-05-17 (i.txt groundwork) | **Updated:** 2026-05-17 (k.txt — QuerySpec skeleton added)
**Tranche:** i.txt groundwork + k.txt SAP QM recovery
**Scope:** Architecture guardrail verification for EnvMon tranches i.txt and k.txt
**Result:** ALL CHECKS PASS — QuerySpec-only; no route wired; no SQL in routes or React

---

## Overview

k.txt added:
- `apps/api/adapters/envmon/envmon_databricks_adapter.py` — QuerySpec factory and row mapper for `getEnvMonSiteSummary`
- `apps/api/shared/query_service/object_resolver.py` — "envmon" domain key added

No route was wired. No frontend changes. SQL lives entirely in the QuerySpec factory — not in a route handler or React component.

i.txt added documentation only (no code).

---

## Guardrail Checklist

### Structural Rules

| Rule | Status | Evidence |
|---|---|---|
| No SQL in React components | **Pass** | No frontend changes |
| No SQL in FastAPI routes | **Pass** | No route file created for envmon |
| SQL only in QuerySpec factories | **Pass** | All SQL in `envmon_databricks_adapter.py` QuerySpec factory |
| QueryExecutor used for all Databricks calls | **Pass (deferred)** | No route yet; QueryExecutor will be required when route is wired |
| No new workspace added | **Pass** | EnvMon workspace already exists |
| No broad API surface added | **Pass** | No routes added |
| resolve_domain_object used for object names | **Pass** | All three views via `resolve_domain_object("envmon", ...)` |

### Identity and Security Rules

| Rule | Status | Evidence |
|---|---|---|
| OAuth required (no SPN/PAT fallback) | **Pass (deferred)** | No route yet; route must use `require_user_oauth()` when wired |
| Missing OAuth returns 401 | **Pass (deferred)** | No route yet |
| Missing config returns 503 | **Pass** | `resolve_domain_object` raises `DatabricksConfigError` if TRACE_CATALOG unset |
| No silent fallback to mock or legacy-api | **Pass** | No fallback in QuerySpec adapter |
| No service-principal credential use | **Pass** | `app.yaml` unchanged; no SPN added |

### Data Integrity Rules

| Rule | Status | Evidence |
|---|---|---|
| No invented inspection lot types | **Pass** | Only `('14','Z14')` used — confirmed-v1 from V1 `em_config.py` |
| No invented source views | **Pass** | Only confirmed-v1 views used |
| No fake browser verification | **Pass** | No verification claimed |
| No invented risk scoring | **Pass** | Site summary uses V1 `fetch_plant_kpis` valuation logic only |
| No heatmap implementation | **Pass** | Heatmap blocked — em_* tables may not exist in UAT |
| No fake missing data | **Pass** | Unavailable fields (`criticalZoneExposures` etc.) return documented defaults |
| No SQL in routes | **Pass** | No route file created |
| No SQL in React | **Pass** | No frontend changes |

---

## Known Concern: Panel Source Badge

All 8 EnvMon panels register `sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' }`.

Note: the actual V1 source is **SAP QM** inspection lots, not a LIMS system. The `systemName: 'lims'` badge in V1 panels reflects domain context terminology, not the data integration technology. When a native Databricks slice is implemented:

- The `systemName: 'lims'` field will become misleading if the data now comes from Databricks
- The EvidencePanel component renders this field as a visible source badge to users
- Each panel's registration object must be updated at the time the native route is wired

**Action required at implementation time:** Update `systemName` in each affected panel's `sourceOwnership` registration. Do not update it before the native route is wired — the badge should reflect the actual active source, not the future intended source.

---

## Future Tranche Requirements

When a native EnvMon slice is implemented, the implementing developer must verify:

1. SQL is in a `QuerySpec` factory (`envmon_databricks_adapter.py`), not in a route or React component
2. The route uses `QueryExecutor` and calls `require_user_oauth()` before execution
3. `BACKEND_ADAPTER_MODE != 'databricks-api'` returns 503 (no mock fallback in the native route)
4. Route tests cover: success, 401, 403, 502, 503, 504 — no fallback assertions
5. All QuerySpec SQL uses `:param` binding — no f-string interpolation
6. Databricks objects are fully qualified (`catalog.schema.view`)
7. Panel source badge (`systemName`) is updated to reflect the actual Databricks source
8. No `confirmed-ddl` claim is made for any column unless `DESCRIBE TABLE` output was seen
9. No `browser-verified` claim is made unless the response was observed in UAT DevTools

This checklist must be re-run and updated for each new EnvMon route added.
