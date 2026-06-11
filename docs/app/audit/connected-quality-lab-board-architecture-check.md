# Architecture Regression Check — Connected Quality Lab Board

**Audit date:** 2026-05-16  
**Triggered by:** Lab board preservation tranche (c.txt)

---

## Checklist

| # | Constraint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No direct shadcn/Radix imports outside design-system | **PASS** | No `@radix-ui/*` or shadcn imports in any new file. Only `@connectio/evidence-panel-runtime`, `@connectio/product-model`, `@connectio/data-contracts`, `@connectio/source-adapters`, React, and `@tanstack/react-query`. |
| 2 | No new custom workspace shell | **PASS** | No new workspace created. Lab board is a view (`lab-board`) within the existing `quality-batch-release` workspace. |
| 3 | No panels rendering data outside EvidencePanel | **PASS** | `ConnectedQualityLabBoardPanel` wraps all output in `<EvidencePanel registration={registration} displayState={displayState} source={result?.source}>`. |
| 4 | No new adapter bypassing AdapterResult | **PASS** | `ConnectedQualityLabAdapter.getLabFailures()` and `.getLabPlants()` both return `AdapterResult<T>` via the `ok()` helper. Legacy API adapter returns `{ ok: true/false, source: 'legacy-api' }`. |
| 5 | No new speculative proxy routes | **PASS** | `apps/api/routes/connected_quality_lab.py` is a thin GET proxy to the V1 CQ backend — same pattern as `warehouse360.py`. Routes are `/api/cq/lab/fails` and `/api/cq/lab/plants`, both mapped to documented V1 endpoints. |
| 6 | No broad phase/governance expansion | **PASS** | No new phases, governance dashboards, pilot tracking pages, or operational workspaces. Lab board is a single view in an existing workspace. |
| 7 | No claims of live/browser-verified data unless true | **PASS** | All files use mock data by default (`source: 'mock'`). Legacy API adapter JSDoc states "wired but not browser-verified". No JSDoc claims browser verification. |

---

## Files changed in this tranche

### Data contracts

| File | Change type | Regression surface |
|------|------------|-------------------|
| `packages/data-contracts/src/schemas/connected-quality-lab.ts` | New — 4 Zod schemas | Schema only; no existing schema modified |
| `packages/data-contracts/src/schemas/connected-quality-lab.test.ts` | New — 6 tests | Test file |
| `packages/data-contracts/src/index.ts` | Re-exports added | Additive; existing exports unchanged |

### Quality domain integration

| File | Change type | Regression surface |
|------|------------|-------------------|
| `domain-integrations/quality/src/adapters/connected-quality-lab-mock-data.ts` | New — 8 failures, 3 plants | Mock data only |
| `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.ts` | New — mock adapter | No modification to QualityReleaseAdapter |
| `domain-integrations/quality/src/adapters/connected-quality-lab-legacy-api-adapter.ts` | New — legacy API adapter | No modification to existing adapters |
| `domain-integrations/quality/src/adapters/connected-quality-lab-adapter-factory.ts` | New — factory | `VITE_ADAPTER_MODE` env check; isolated module |
| `domain-integrations/quality/src/adapters/connected-quality-lab-queries.ts` | New — React Query hooks | No modification to existing queries |
| `domain-integrations/quality/src/panels/connected-quality-lab-board-panel.tsx` | New panel | `registration.panelId = 'connected-quality-lab-board'`; `allowedConsumerWorkspaces: ['quality-batch-release']` |
| `domain-integrations/quality/src/views/lab-board-view.tsx` | New view wrapper | Thin passthrough; no new workspace shell |
| `domain-integrations/quality/src/batch-release-workspace.tsx` | Add `lab-board` view | `BatchReleaseViewId` union extended; `resolveView` case added; `isValidViewId` array extended; import added |
| `domain-integrations/quality/src/batch-release-registration.ts` | Add `lab-board` view definition | `defaultViews` extended with sortOrder 6, lifecycle 'pilot'; `defaultPanels` extended with `connected-quality-lab-board` at order 14 |
| `domain-integrations/quality/src/index.ts` | New exports added | Additive; no existing exports removed or modified |
| `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.test.ts` | New — 7 tests | Test file |
| `domain-integrations/quality/src/panels/connected-quality-lab-board-panel.test.tsx` | New — 11 tests | Test file |

### API

| File | Change type | Regression surface |
|------|------------|-------------------|
| `apps/api/routes/connected_quality_lab.py` | New proxy module | GET-only; isolated router; env `V1_CQ_API_BASE_URL` required for live mode |
| `apps/api/main.py` | Include new router | One import + one `include_router` line; existing routers unchanged |

### Documentation

| File | Change type |
|------|------------|
| `docs/migration/connected-quality-lab-board-preservation.md` | New migration record |
| `docs/domains/quality-lab-board.md` | New domain reference |
| `docs/audit/connected-quality-lab-board-architecture-check.md` | This file |

---

## Detailed constraint checks

### Panel registration (constraint 3)

- `ConnectedQualityLabBoardPanel` has a single `registration` const: `panelId: 'connected-quality-lab-board'`.
- `registration` is declared as `const` at module scope — it cannot change after creation.
- `source={result?.source}` is passed to `EvidencePanel` — source transparency is preserved.
- `allowedConsumerWorkspaces: ['quality-batch-release']` — panel is not shared across workspaces.

### AdapterResult compliance (constraint 4)

- Mock adapter `ok()` helper returns `{ ok: true, data, fetchedAt, source: 'mock' }` — matches `AdapterResult<T>`.
- Mock adapter `err()` helper returns `{ ok: false, error: { code, message, retryable }, displayState: 'error' }` — matches `AdapterResult<T>`.
- Legacy API adapter success path returns `{ ok: true, data, fetchedAt, source: 'legacy-api' }`.
- Legacy API adapter error paths return `{ ok: false, error, displayState, source: 'legacy-api' }`.

### Proxy route safety (constraint 5)

- Only GET endpoints proxied — no write operations exposed.
- `V1_CQ_API_BASE_URL` env var required; 503 returned if missing.
- Same `_forward_get` + httpx pattern as `warehouse360.py`.
- No new Databricks deployment files changed.

### No new LIMS workspace (constraint 6)

- `lab-board` is a **view** within `quality-batch-release`, not a new workspace.
- `batchReleaseRegistration.workspaceId` remains `'quality-batch-release'` — unchanged.
- No LIMS-specific types invented (sample receipt, analyst workload, instrument queues, result entry, approvals, lab scheduling).

---

## Deployment file status

`apps/api/main.py` modified (router import + include). All other deployment files — `apps/api/app.yaml`, `apps/api/requirements.txt`, `scripts/prepare-databricks-app.mjs` — are **unchanged**.

---

## Hardening pass addendum (2026-05-16)

A targeted hardening pass was applied after the initial preservation commit. Architecture constraints remain satisfied.

### Deployment/env alignment

| File | Change |
|------|--------|
| `scripts/prepare-databricks-app.mjs` | Added `VITE_CQ_API_BASE_URL` to `buildEnv` and console.log output |
| `apps/api/app.yaml` | Added `V1_CQ_API_BASE_URL` env entry reading from secret scope key `v1-cq-api-base-url` |
| `docs/deployment/databricks-apps.md` | Added CQ secret setup, build equivalent, smoke-test command, what-to-check rows, env var table rows, readiness table row |
| `README.md` | Added CQ proxy route rows to FastAPI routes table |

### Source wording (constraint 7 — honesty)

- `registration.description` no longer contains "Live" — changed to `"SAP QM inspection failures and warnings…"`
- Source-aware subtitle added inside panel body: mock → `"Mock SAP QM lab failures"`, legacy-api → `"SAP QM via legacy API"`
- EvidencePanelHeader already renders "Legacy API" amber badge for `legacy-api` source and nothing for `mock` — no change to runtime

### Layout cues (constraint 3 — no data outside EvidencePanel)

Board header, legend, and auto-rotate note were added **inside** `<EvidencePanel>` body. No data rendered outside EvidencePanel. No new components outside the existing file.

### Tests added

| File | Count |
|------|-------|
| `panels/connected-quality-lab-board-panel.test.tsx` | +7 tests |
| `adapters/connected-quality-lab-legacy-api-adapter.test.ts` | 7 tests (new file) |

All constraints from the original checklist remain **PASS**.
