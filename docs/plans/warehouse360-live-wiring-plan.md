# Warehouse 360 — Full Live-Data Wiring Plan (remove legacy + mock layers)

**Status:** approved for execution · **Owner:** warehouse-operations · **Date:** 2026-06-09
**Executor:** coding agent (this document is the work order — follow phases in order)

## 1. Objective

Wire the Warehouse 360 frontend (and its sibling staging workspaces in
`domain-integrations/warehouse/`) **exclusively** to the governed data layer
(`vw_consumption_warehouse360_*` views in `<catalog>.gold_io_reporting`, RLS-secured,
served via the FastAPI backend in `apps/api/`), and **delete the legacy-API and mock
layers** for these apps. After this change there is exactly one data path:

```
React panel → tanstack-query hook → Warehouse360DatabricksAdapter (fetch /api/warehouse360/*)
  → FastAPI route → contract resolver → vw_consumption_warehouse360_<dataset>
  → gold_*_live → gold_*_secured (RLS via current_user()) → gold MV
```

No `VITE_ADAPTER_MODE`, no mock fixtures, no V1 proxy, no silent fallbacks: a failed
request renders an explicit error/empty state, never fixture data.

## 2. Hard constraints (do not violate)

1. **Data-layer freeze.** Do NOT create/modify gold tables, silver tables, `_secured`/
   `_live` views, or consumption-view SQL in `data-products/io-reporting/`. The
   hardening-sprint scope freeze applies: new Gold scope requires silver dependency,
   documented grain, unit tests, a contract entry, and a freshness assessment. This plan
   deliberately uses only datasets whose contracts and views ALREADY exist.
2. **RLS chain stays intact.** All reads go through the consumption views (which read
   `_live`/`_secured`). Never point a route at a gold table or `_secured` view directly.
3. **Fail loud.** Where a panel's dataset has no governed source, the panel is REMOVED
   (section 5.3) — not stubbed with fixtures, not fed by a new gold table.
4. **Other domains untouched.** trace2/poh/cq/spc/envmon adapters, routes, and the
   shared `legacy-api` plumbing they still use are out of scope. Only delete shared code
   when no remaining domain uses it.
5. Keep every CI guard green: `check_warehouse360_adapter_contract_columns`,
   `check_warehouse360_consumption_columns`, `check_warehouse360_migration_static`,
   `check_contract_coverage`, `check_app_migration_registry_guard`, plus the full
   `apps/api` pytest suite and the frontend vitest suites.

## 3. Current state (verified 2026-06-09)

### Backend (`apps/api`)
- `routes/warehouse360.py` exposes 5 governed routes: `GET /api/warehouse360/{overview,
  inbound,outbound,staging,exceptions}` plus a V1 proxy `POST /api/wh360/warehouse-summary`.
- `adapters/warehouse360/warehouse360_databricks_adapter.py` has a dual
  `WAREHOUSE360_SOURCE_MODE` switch: `governed_contracts` (contract-resolved consumption
  views) vs `legacy_wh360` (UAT prototype views `imwm_exceptions_v` etc.).
- Deployed `app.yaml` already runs `governed_contracts` + `BACKEND_ADAPTER_MODE=databricks-api`.

### Contracts (`data-products/io-reporting/contracts/app_contract_manifest.yml`)
8 contracts; routes exist for 5. **Two contracts have deployed views but NO route yet**
(`runtime_route_exists: false` in `warehouse360_view_expectations.yml`):
- `warehouse360.stock_exceptions` → `vw_consumption_warehouse360_stock_exceptions`
  (expiry-risk buckets from `gold_stock_expiry_risk_live`)
- `warehouse360.shortfalls` → `vw_consumption_warehouse360_shortfalls`
  (material backlog from `gold_transfer_requirement_material_backlog_secured`)
`warehouse360.dispensary_queue` is draft / NOT deployed — leave untouched.

### Frontend (`domain-integrations/warehouse/src`)
- `adapters/warehouse-360-adapter.ts` — the MOCK base class (14 datasets).
- `adapters/warehouse-360-legacy-api-adapter.ts` — extends the mock class; overrides the
  5 cockpit datasets (live fetches to `/api/warehouse360/*`, tagged `databricks-api`) and
  `getWarehouse360Summary` (V1 proxy, mock fallback). All other methods inherit MOCK.
- `adapters/warehouse-360-adapter-factory.ts` — `VITE_ADAPTER_MODE ?? 'mock'` build-time
  switch; `databricks-api` mode falls through to the mock adapter (known trap).
- Pure-mock sibling adapters: `production-staging-adapter.ts` (9 datasets),
  `warehouse-staging-adapter.ts` (2 datasets), `warehouse-evidence-adapter.ts`.
- The deployed bundle (`apps/api/static/`) was built with `VITE_ADAPTER_MODE=legacy-api`.

## 4. Dataset disposition table

| Adapter method / dataset | Governed source | Disposition |
|---|---|---|
| `getWarehouseOverview` | route exists → `warehouse360.overview` | keep — port to new adapter |
| `getWarehouseInbound` | route exists → `warehouse360.inbound_backlog` | keep — port |
| `getWarehouseOutbound` | route exists → `warehouse360.outbound_backlog` | keep — port |
| `getWarehouseStaging` | route exists → `warehouse360.staging_workload` | keep — port |
| `getWarehouseExceptionItems` | route exists → `warehouse360.im_wm_reconciliation` | keep — port |
| `getNearExpiryStock` | **NEW route** → `warehouse360.stock_exceptions` | REWIRE (Phase 1+2) |
| `getWarehouseExceptions` (reconciliation panel) | same data as exception items | REWIRE to `/api/warehouse360/exceptions` (reuse mapper, reshape in panel) |
| `getWarehouse360Summary` | no source for stock-line counts | REPLACE: summary panel rebuilt on overview KPIs (orders/TRs/TOs/deliveries/inbound/bins); V1 proxy deleted |
| `getWarehouse360Context` | none | REMOVE (panel shows plant/warehouse from request/filters only) |
| `getStockOverview` | none (bin-level stock not contracted) | REMOVE view + panel |
| `getOpenHolds` | none | REMOVE view + panel |
| `getGoodsMovements` | none | REMOVE view + panel |
| `getReplenishmentNeeds` | none | REMOVE view + panel |
| `getLocationCapacities` | none | REMOVE view + panel |
| production-staging: `getStagingOrders`, `getStagingReadiness` | `warehouse360.staging_workload` (order grain) | REWIRE to `/api/warehouse360/staging` |
| production-staging: `getShortfalls` | **NEW route** → `warehouse360.shortfalls` | REWIRE |
| production-staging: pick tasks, picking waves, move requests, zone capacity, alerts, context | none (component/task grain not contracted — ADR-0004 D3) | REMOVE panels + views |
| warehouse-staging: `getWarehouseStagingStatus` | `warehouse360.staging_workload` | REWIRE |
| warehouse-staging: `getMaterialShortagesForPlan` | `warehouse360.shortfalls` | REWIRE |
| warehouse-evidence: hold-status | no route, no view | REMOVE adapter + mock (evidence capture for live datasets stays) |

## 5. Execution phases

### Phase 1 — Backend: governed-only + two new routes

1. **Delete `legacy_wh360` mode** in
   `apps/api/adapters/warehouse360/warehouse360_databricks_adapter.py`:
   remove `_get_source_mode()` branching, every `if source_mode == ...` block, the
   `resolve_domain_object("wh360", "imwm_*_v")` calls, and the `date_col` switch (keep
   `latest_detected_date`). Keep requiring `WAREHOUSE360_SOURCE_MODE=governed_contracts`
   at startup (clear error otherwise) so a stale deployment config fails loud, or drop
   the env var entirely and hardcode governed — choose dropping it, and remove it from
   `app.yaml` (also remove `V1_WH360_API_BASE_URL`).
2. **Add 2 spec factories + routes** (same pattern as `get_warehouse_staging_spec`):
   - `get_warehouse_stock_exceptions_spec` → contract `warehouse360.stock_exceptions`,
     route `GET /api/warehouse360/stock-exceptions`. Columns/grain: see contract entry
     (`contracts/app_contract_manifest.yml:313`) — plant/material/batch grain with expiry
     bucket fields. Filters: `plant_id`, optional bucket, `limit`.
   - `get_warehouse_shortfalls_spec` → contract `warehouse360.shortfalls`, route
     `GET /api/warehouse360/shortfalls`. Filters: `plant_id`, `limit`.
   Wire both through the existing `QuerySpec`/repository/identity machinery
   (`routes/_databricks.py`), `contract_id` set, `CacheTier.PER_USER_60S`.
3. **Delete the V1 proxy** `POST /api/wh360/warehouse-summary` from
   `routes/warehouse360.py` (and `_forward_post` if then unused **within this module**).
4. **Response models:** generated contract models for the two new datasets may not exist
   in `apps/api/contracts/generated.py` (codegen'd from `packages` contracts.json). If
   absent, add explicit pydantic response models in the route module (mirroring contract
   fields) rather than re-running codegen, and leave a TODO referencing the codegen
   pipeline.
5. **Contract bookkeeping:** set `runtime_route_exists: true` for `stock_exceptions` and
   `shortfalls` in `data-products/io-reporting/contracts/warehouse360_view_expectations.yml`.
   Update `scripts/ci/check_contract_coverage.py` route↔contract sets if it enumerates
   adapter spec functions (it imports them — add the two new spec factories to its
   import list and assertions).
6. **Tests** (mirror `apps/api/tests/adapters/warehouse360/test_warehouse360_adapter.py`):
   spec-SQL assertions (correct view, params, no f-string injection), mapper null-safety,
   route tests via FastAPI TestClient incl. 401-no-token and 503-no-config paths,
   removal tests asserting `legacy_wh360` is gone (the existing legacy-mode tests must be
   deleted/rewritten, including fixtures in `tests/fixtures/warehouse360_contract_fixtures.py`).

### Phase 2 — Frontend: single live adapter

1. **Create `adapters/warehouse-360-databricks-adapter.ts`** implementing exactly the
   keep/rewire datasets of §4 (port the fetch logic of the 5 cockpit methods from
   `warehouse-360-legacy-api-adapter.ts` verbatim — it is already correct: same-origin
   fetch, `credentials: 'include'`, snake_case→camelCase mapping, `source: 'databricks-api'`).
   Add `getNearExpiryStock` → `/api/warehouse360/stock-exceptions` (map buckets to the
   `NearExpiryBatch` shape; if shapes diverge, change the panel to consume the contract
   shape — do NOT invent fields), `getShortfalls`-family and staging-status methods per §4.
   **No mock fallback anywhere**: error → `{ ok: false, error, displayState }`.
2. **Delete:** `warehouse-360-adapter-factory.ts` (export the singleton directly from the
   new adapter module), `warehouse-360-legacy-api-adapter.ts`, the mock implementations
   inside `warehouse-360-adapter.ts` (keep only the TypeScript interface — convert the
   class to an `interface Warehouse360Adapter`), `warehouse-360-mock-data.ts`,
   `production-staging-mock-data.ts`, `warehouse-staging-mock-data.ts`,
   `warehouse-evidence-mock-data.ts`, `warehouse-evidence-adapter.ts`, and all their
   `.test.ts` files that test mock/factory behaviour.
3. **Rewire `production-staging-adapter.ts` / `warehouse-staging-adapter.ts`** to fetch
   the staging + shortfalls routes (same fetch pattern); delete the removed datasets'
   methods entirely so TypeScript surfaces every dead consumer.
4. **Workspace/view/panel removal** (`warehouse-360-workspace.tsx`,
   `Warehouse360ViewId`): drop `stock-status`, `holds-management`, `goods-movements`,
   `replenishment` view ids and their view/panel files (`stock-status-view.tsx`,
   `holds-management-view.tsx`, `goods-movements-view.tsx`, `replenishment-view.tsx`,
   `stock-overview-panel.tsx`, `open-holds-panel.tsx`, `goods-movement-activity-panel.tsx`,
   `replenishment-needs-panel.tsx`, `location-capacity-panel.tsx`,
   `near-expiry-stock-panel.tsx` → replaced by a stock-exceptions-backed panel,
   `warehouse-hold-status-panel.tsx`). In the staging workspace remove
   `picking-waves-view.tsx`, `move-requests-view.tsx`, `zone-capacity-view.tsx` and their
   panels. Keep `warehouse-cockpit` (default), `warehouse-overview`, staging overview +
   order list + readiness + shortfalls + alerts-only-if-derivable-from-staging-route.
5. **Summary panel** (`warehouse-360-summary-panel.tsx`): rebuild on
   `useWarehouseOverview` KPIs; delete the hardcoded `status:"mock"` capability-tile list
   or re-derive it from the live dataset registry (every remaining tile is `live`).
6. **Queries** (`warehouse-360-queries.ts`, staging equivalents): delete hooks for removed
   datasets; add `useNearExpiryStock`→stock-exceptions and `useShortfalls` hooks.
7. **Flags/badge:** remove `warehouse.databricksApi` feature-flag gating and all
   `VITE_ADAPTER_MODE` reads in this domain (other domains keep theirs). The
   source-mode badge will now always report `databricks-api` — keep the badge (it is
   evidence of liveness), and update `warehouse-360-actions-panel.tsx` evidence capture
   to stop emitting `adapterMode:"legacy-api"`.
8. **Tests:** new adapter unit tests (fetch mocking: ok path, 401, 500, malformed JSON —
   assert NO mock data is ever returned), updated view tests
   (`warehouse-cockpit-view.test.tsx`, panel tests) against the live adapter with mocked
   fetch, workspace routing tests for the reduced view-id set. Search-and-destroy: after
   deletion, `grep -r "mock" domain-integrations/warehouse/src --include='*.ts*' | grep -v test`
   must return zero data-bearing hits.

### Phase 3 — Build, deploy config, bundle

1. Remove `VITE_ADAPTER_MODE` / `VITE_WH360_API_BASE_URL` from any build scripts/docs for
   the warehouse domain; update `docs/deployment/databricks-apps.md` and `app.yaml`
   comments (`ADAPTER_MODE` informational var: delete).
2. Rebuild the static bundle (`npm run prepare:databricks` from repo root) and commit the
   regenerated `apps/api/static/` assets. Verify the compiled `di-warehouse-*.js` contains
   no `"mock"`-sourced adapter results: `grep -c 'source:"mock"' apps/api/static/assets/di-warehouse-*.js` → 0.
3. `app.yaml`: remove `V1_WH360_API_BASE_URL` and `WAREHOUSE360_SOURCE_MODE` (per Phase 1
   choice); keep `WH360_CATALOG`/`WH360_SCHEMA` (still required by the object resolver).

### Phase 4 — Verification gates (all must pass)

```bash
# Backend
cd apps/api && python -m pytest tests/ -q                      # full suite, incl. new routes
python scripts/ci/check_warehouse360_adapter_contract_columns.py
python scripts/ci/check_warehouse360_consumption_columns.py
python scripts/ci/check_warehouse360_migration_static.py
python scripts/ci/check_contract_coverage.py
python scripts/ci/check_app_migration_registry_guard.py
# Frontend
pnpm --filter @connectio/di-warehouse test                     # vitest
pnpm --filter @connectio/di-warehouse typecheck && pnpm lint
# Bundle
npm run prepare:databricks && git diff --stat apps/api/static  # rebuilt, committed
```

Acceptance criteria:
1. Zero imports of `*-mock-data` and zero `source: 'mock'` results in
   `domain-integrations/warehouse/`; factory and legacy adapter files deleted.
2. `apps/api` has no `legacy_wh360` / `imwm_*_v` / V1-WH360-proxy code paths (the
   `imwm_exceptions_v` allowlist entries in `scripts/ci/check_warehouse360_migration_static.py`
   and `check_contract_coverage.py` are removed and the guards still pass).
3. `GET /api/warehouse360/stock-exceptions` and `/shortfalls` return contract-shaped rows
   in UAT; `warehouse360_view_expectations.yml` shows `runtime_route_exists: true` for 7
   contracts (dispensary_queue stays false/draft).
4. Every rendered Warehouse 360 / staging panel either displays live governed data or an
   explicit error/empty state; the API-mode badge reads `databricks-api` everywhere.
5. UAT browser check (manual or `verify` run): cockpit, overview, staging, shortfalls and
   stock-exceptions panels populate with RLS-scoped data for a `filter`-access user.

## 6. Risks & notes for the executor

- **`NearExpiryBatch` shape mismatch:** `stock_exceptions` is bucket-aggregate grain
  (plant×material×batch with qty buckets), not per-batch expiry dates. Prefer adapting
  the panel to the contract shape; do not fabricate `expiryDate` per row from buckets.
- **`detected_date` semantics:** the exceptions dataset's `oldest_/latest_detected_date`
  equal the query-time evaluation date (documented in the contract manifest) — don't
  build "exception age trend" UI on them.
- **Shared deletions:** `createDisabledAdapter` and `legacy-api` helpers in
  `packages/source-adapters` are used by other domains — leave them.
- **`shared_db` test module** (`apps/api/tests/shared/test_query_builder.py`) needs the uv
  workspace env; don't mistake its ImportError in a bare venv for a regression.
- **Dispensary queue** remains contract-draft: no route, no panel.
- The five existing cockpit fetches are verified working against the refactored views
  (123 adapter/route tests + 1,579-test suite green on 2026-06-09) — port, don't rewrite.
