# Connected Quality Lab Board — V2 Preservation Record

**Date:** 2026-05-16  
**Task:** Preserve the V1 Connected Quality Lab Board (`/cq/?module=lab`) in V2 architecture

---

## Original V1 location

| Item | V1 value |
|------|----------|
| Route | `/cq/?module=lab` |
| Frontend | `apps/connectedquality/frontend/src/pages/lab/LabBoard.tsx` |
| Backend | `apps/connectedquality/backend/connectedquality_backend/routers/lab.py` |
| Application logic | `…/application/lab.py` — `fetch_lab_failures()`, `fetch_lab_plants()`, `_coerce_fail(row)` |
| CSS | `apps/connectedquality/frontend/src/styles/app.css` (`.lab-board`, `.fail-card`, `.spec-bar`, etc.) |
| Data source | Databricks inspection-result gold views via V1 CQ backend |

## V1 API endpoints

| Endpoint | Method | Query params | Notes |
|----------|--------|-------------|-------|
| `/api/cq/lab/fails` | GET | `plant_id`, `lot_type` | Returns `FailSpec[]` (short field names) |
| `/api/cq/lab/plants` | GET | — | Returns plant list |

## V1 FailSpec field names (preserved verbatim in V2 contract)

`mat`, `matNo`, `lot`, `batch`, `line`, `char`, `text`, `res`, `lo`, `hi`, `units`, `sev`, `ts`, `lotType`

---

## V2 destination

| Item | V2 value |
|------|----------|
| Workspace | `quality-batch-release` |
| View | `lab-board` (sortOrder 6, lifecycle: pilot) |
| URL | `?workspace=quality-batch-release&view=lab-board` |
| Panel | `connected-quality-lab-board` |

---

## V2 files created

| File | Purpose |
|------|---------|
| `packages/data-contracts/src/schemas/connected-quality-lab.ts` | Zod schemas for FailSpec, response, plant |
| `packages/data-contracts/src/schemas/connected-quality-lab.test.ts` | 6 schema tests |
| `packages/data-contracts/src/index.ts` | Re-exports |
| `domain-integrations/quality/src/adapters/connected-quality-lab-mock-data.ts` | 8 realistic mock failures, 3 plants |
| `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.ts` | Mock adapter (source='mock') |
| `domain-integrations/quality/src/adapters/connected-quality-lab-legacy-api-adapter.ts` | Legacy API adapter (source='legacy-api') |
| `domain-integrations/quality/src/adapters/connected-quality-lab-adapter-factory.ts` | VITE_ADAPTER_MODE factory |
| `domain-integrations/quality/src/adapters/connected-quality-lab-queries.ts` | React Query hooks |
| `domain-integrations/quality/src/panels/connected-quality-lab-board-panel.tsx` | Lab board panel UI |
| `domain-integrations/quality/src/views/lab-board-view.tsx` | View wrapper |
| `domain-integrations/quality/src/adapters/connected-quality-lab-adapter.test.ts` | 7 adapter tests |
| `domain-integrations/quality/src/panels/connected-quality-lab-board-panel.test.tsx` | 11 panel tests |
| `apps/api/routes/connected_quality_lab.py` | FastAPI proxy for `/api/cq/lab/*` |
| `apps/api/main.py` | Include new router |

## V2 files modified

| File | Change |
|------|--------|
| `domain-integrations/quality/src/batch-release-workspace.tsx` | Add `lab-board` to `BatchReleaseViewId`, import `LabBoardView`, add `case 'lab-board'` |
| `domain-integrations/quality/src/batch-release-registration.ts` | Add `lab-board` view definition (sortOrder 6, pilot), add panel to defaultPanels |
| `domain-integrations/quality/src/index.ts` | Export adapter, queries, panel, view |

---

## Preserved V1 behaviours

| Behaviour | V2 implementation |
|-----------|-----------------|
| Failed SAP QM result cards | `FailCard` component with border coloured by severity |
| 6-card grid (3×2) | CSS `grid-template-columns: repeat(3, 1fr)` inside `EvidencePanel` |
| Auto-rotation every 30s | `setInterval` countdown in `useEffect`, resets on manual nav or filter change |
| Page indicator + countdown | Context strip: "Page N/M · Next in Xs" |
| Plant context | `plantId` from `scope.plantId` in `BatchReleaseWorkspace`, passed through to adapter request |
| Lot-type filter (FP/RM) | Internal toggle buttons (All / FP (89) / RM (04)), bound to `selectedLotType` state |
| Fail/warn severity | `sev` field drives badge colour (#D32F2F fail, #D97706 warn) and card border |
| Result-vs-spec bar | `SpecBar` component: pure CSS with calculated percentage offsets; green window = [lo, hi], marker = res |
| "Live from SAP QM" concept | `source` field propagated from adapter; EvidencePanel shows "Mock" or "Live" label accordingly |
| No-data state | `dataAvailable: false` renders reason string; adapter sets `dataAvailable: true` always for mock |
| Empty state | "No failures or warnings." when `fails.length === 0` |
| Loading state | EvidencePanel handles via `displayState` / `useEvidencePanel` hook |

---

## Gaps (not implementable without contract or data extension)

| Gap | Reason |
|-----|--------|
| Full-screen wallboard mode | V2 workspace shell is always framed; no full-screen mode in `StandardWorkspaceTemplate` |
| Per-plant data-available detection in mock | Mock always returns `dataAvailable: true`; V1 backend checks Databricks publish status |
| Sound/alert on new failure | V1 did not have this; not added in V2 |

---

## Adapter wiring status

| Method | Mock | Legacy API |
|--------|------|-----------|
| `getLabFailures` | Returns 8 mock failures; filtered by `lotType` | Wired to `/api/cq/lab/fails` via V2 proxy; **not browser-verified** |
| `getLabPlants` | Returns 3 mock plants | Wired to `/api/cq/lab/plants` via V2 proxy; **not browser-verified** |

To activate legacy-api mode: set `VITE_ADAPTER_MODE=legacy-api` and `VITE_CQ_API_BASE_URL=<origin>` (empty = same origin on Databricks Apps).  
Backend requires `V1_CQ_API_BASE_URL` env var pointing to the V1 CQ backend.

---

## Hardening pass (2026-05-16)

Changes applied after the initial preservation commit.

### Deployment / env alignment

| Variable | Where added |
|----------|-------------|
| `VITE_CQ_API_BASE_URL` | `scripts/prepare-databricks-app.mjs` `buildEnv` |
| `V1_CQ_API_BASE_URL` | `apps/api/app.yaml` env block (reads from secret scope key `v1-cq-api-base-url`) |

Both variables were missing from the deployment artifact before this pass.

### Source wording

- Registration `description` changed from `"Live SAP QM inspection failures and warnings…"` to `"SAP QM inspection failures and warnings…"` (removed "Live" — misleading when source is mock).
- Source-aware subtitle added inside the panel body: mock → `"Mock SAP QM lab failures"`, legacy-api → `"SAP QM via legacy API"`.

### Layout cues

Added inside the panel body without breaking `EvidencePanel` or `StandardWorkspaceTemplate`:

| Cue | Implementation |
|-----|---------------|
| `ConnectedQuality · Lab Board` heading | Board header row at top of panel body |
| Plant context | `Plant: {plantId}` shown in board header when `request.plantId` is set |
| Fail / Warn legend | Colored chips + "Outside spec" / "Warning threshold" labels below board header |
| Auto-rotate note | Page indicator updated: `Page N/M · Auto-rotates · Next in Xs` |

### Tests added

| File | Tests added |
|------|------------|
| `panels/connected-quality-lab-board-panel.test.tsx` | no "Live" when mock; legend renders; board header; plant context; source label; auto-rotate note |
| `adapters/connected-quality-lab-legacy-api-adapter.test.ts` | same-origin URL; baseUrl prepend; source field; fallback to mock; error result; trailing-slash strip; prepare script VITE_CQ_API_BASE_URL check |
