# Source Badge and Error State Review

**Date:** 2026-05-17  
**Scope:** All domain-integration panels that consume FastAPI routes or adapter data — source badge behaviour and error state correctness  
**Context:** `VITE_ADAPTER_MODE=legacy-api` is baked into the production frontend bundle. The frontend calls FastAPI via HTTP (same-origin in Databricks Apps). The frontend never calls Databricks directly.  
**Reference:** `docs/audit/adapter-source-status-matrix.md`, ADR-024

---

## Source Badge Model

The frontend renders a source badge in panels based on the `sourceAdapterType` field returned by the adapter:

| `sourceAdapterType` | Badge | Colour |
|---|---|---|
| `mock` | No badge rendered | — |
| `legacy-api` | "V1 API" badge | Amber |
| `databricks-api` | "Databricks" badge | Green |

The badge signals data provenance to operators. An amber badge means live V1 data (potentially stale). A green badge means native Databricks query. No badge means mock data — the operator may not realise the panel is not live.

---

## Panel State by Domain

### Process Order Review — POH Workspace

| Panel | Adapter method | Current source | Badge | Error state when FastAPI returns non-200 |
|---|---|---|---|---|
| Order Header | `getProcessOrderHeader` | `databricks-api` | Green (live) | Panel shows error; adapter returns `{ ok: false, displayState: 'error' }` |
| Order Operations | `getOrderOperations` | `databricks-api` | Green (live) | Panel shows error |
| Order Confirmations | `getOrderConfirmations` | `databricks-api` | Green (live) | Panel shows error — not yet browser-verified in UAT |
| Goods Movements | `getOrderGoodsMovements` | `databricks-api` | Green (live) | Panel shows error — not yet browser-verified in UAT |
| Order Progress Summary | `getOrderProgressSummary` | `mock` | None | Always renders mock data |
| Execution Timeline | `getExecutionTimeline` | `mock` | None | Always renders mock data |
| Order Quality Context | `getOrderQualityContext` | `mock` | None | Always renders mock data |
| Order Staging Context | `getOrderStagingContext` | `mock` | None | Always renders mock data |
| Related Batch Context | `getRelatedBatchContext` | `mock` | None | Always renders mock data |

**Observation:** The POH workspace currently mixes green-badge (live) and no-badge (mock) panels. Operators viewing the header and operations panels see live data but plan-risk and staging panels show mock. This is the expected Phase 1 state.

---

### Trace Investigation Workspace

| Panel | Adapter method | Current source | Badge | Error state |
|---|---|---|---|---|
| Batch Header | `getBatchHeaderSummary` | `legacy-api` (via V1 proxy) | Amber — BUT returns 503 while V1 STOPPED → panel shows error state | Error: V1 STOPPED |
| Trace Graph | `getTraceGraph` | `mock` | None | Always renders mock data |
| Mass Balance | `getMassBalanceSummary` | `mock` | None | Always renders mock data |
| Customer Exposure | `getCustomerExposureSummary` | `mock` | None | Always renders mock data |
| Supplier Exposure | `getSupplierExposureSummary` | `mock` | None | Always renders mock data |
| All others (6) | various | `mock` | None | Always renders mock data |

**Observation:** The Trace batch header panel is in a persistent error state because the V1 proxy returns 503. Operators attempting Trace Investigation see a broken primary panel. This is the consequence of V1 being STOPPED. Databricks-api route wiring (after DDL verification) would restore this panel.

---

### CQ Lab Workspace

| Panel | Adapter method | Current source | Badge | Error state |
|---|---|---|---|---|
| Lab Plants | `getLabPlants` | `databricks-api` | Green (live) | Panel shows error |
| Lab Fails | `getLabFailures` | `legacy-api` (V1 proxy) | Amber — BUT returns 503 while V1 STOPPED → error state | Error: V1 STOPPED |

**Observation:** The CQ lab workspace has a split state — the plant selector works (green badge, live data) but the fails panel is broken (V1 STOPPED). Any operator trying to use the lab fails panel sees an error.

---

### WH360 Workspace

| Panel | Adapter method | Current source | Badge | Error state |
|---|---|---|---|---|
| Warehouse Summary | `getWarehouse360Summary` | `legacy-api` (V1 proxy) | Amber — BUT returns 503 while V1 STOPPED → error state | Error: V1 STOPPED |
| All others (8) | various | `mock` | None | Always renders mock data |

**Observation:** The WH360 workspace entry point panel is in error state. All secondary panels show mock data. The workspace is not usable for live decision-making.

---

### SPC, EnvMon, Maintenance, Operations Plan Risk, Production Staging, Quality Batch Release

All panels in these workspaces consume mock-only adapters. No source badge is shown. Operators may not realise that all data is static.

| Workspace | Method count | Source | Badge |
|---|---|---|---|
| SPC | 9 | mock | None |
| EnvMon | 9 | mock | None |
| Maintenance | 7 | mock | None |
| Operations Plan Risk | 9 | mock | None |
| Production Staging | 9 | mock | None |
| Quality Batch Release | 7 | mock | None |

---

## Error States Requiring Attention

### Persistent error states (V1 STOPPED, not transient)

These panels are in a known broken state that will not self-resolve until V1 is restarted or a databricks-api route is wired:

| Panel | Cause | Resolution path |
|---|---|---|
| Trace Batch Header | V1 proxy returns 503 (V1 STOPPED) | Wire databricks-api gate after DDL verification |
| CQ Lab Fails | V1 proxy returns 503 (V1 STOPPED) + databricks-api blocked | V1 restart; or wait for `vw_gold_process_order_plan` creation |
| WH360 Warehouse Summary | V1 proxy returns 503 (V1 STOPPED) | V1 restart; or wire databricks-api (requires catalog_override) |

### Amber badge with no live data

The following routes are wired as legacy-api but have never been browser-verified in this deployment. If V1 restarts, they will show amber badges — but the data quality is unconfirmed:

- `POST /api/trace2/batch-header` — historically browser-verified, but not in this deployment
- `POST /api/wh360/warehouse-summary` — never browser-verified in V2 production

---

## Guardrails for Source Badge Correctness

1. **Do not claim databricks-api badge without browser verification.** The badge is set by `set_databricks_response_headers()` in the route — this only runs when the Databricks query succeeds. The badge is accurate by construction.

2. **Do not claim legacy-api parity if the V1 proxy returns 503.** A 503 response from FastAPI results in an error display state, not an amber badge — the badge only shows when data returns successfully.

3. **Mock data never gets a badge** — the mock adapter does not call FastAPI and does not set `sourceAdapterType` to `legacy-api` or `databricks-api`.

4. **Do not add a new amber-badge (legacy-api) route** unless the V1 endpoint has been browser-tested against a live V1 backend. Adding a wired-but-unverified route creates an amber badge that may never render (V1 STOPPED) and obscures whether the panel is mock or live.
