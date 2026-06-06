# Architecture Regression Check — ConnectIO-RAD V2

**Audit date:** 2026-05-16  
**Triggered by:** Phase 9 remediation — REM-004, REM-005, REM-009, REM-010, REM-012; Warehouse360 + Production Staging functional depth tranche

---

## Checklist

| # | Constraint | Status | Evidence |
|---|-----------|--------|----------|
| 1 | No direct shadcn/Radix imports outside design-system | **PASS** | All changed files use only `EvidencePanel`, `useEvidencePanel`, standard React, and SVG. No `@radix-ui/*` or `shadcn` imports introduced. |
| 2 | No new custom workspace shell | **PASS** | No new workspace, no new shell file, no new workspace registration created. |
| 3 | No panels rendering data outside EvidencePanel | **PASS** | All new panels (`ExceptionStockSummaryPanel`, `InboundOutboundSummaryPanel`) and modified panels wrap all data output in `<EvidencePanel>`. |
| 4 | No new adapter bypassing AdapterResult | **PASS** | No new adapters created. All new panels use existing `useStockOverview` and `useGoodsMovements` hooks which return `AdapterResult<T>`. |
| 5 | No new speculative proxy routes | **PASS** | No changes to `apps/api/main.py`, `apps/api/app.yaml`, or any FastAPI route file. |
| 6 | No broad phase/governance expansion | **PASS** | No new phases, governance dashboards, pilot tracking pages, or operational workspaces added. |
| 7 | No claims of live/browser-verified data unless true | **PASS** | All changed files use mock data. Date-normalised mock data uses 2026-05 dates. No adapter JSDoc changed to claim browser-verified status. |

---

## Files changed in this tranche

### Phase 9 remediation (REM-004, REM-005, REM-009, REM-010, REM-012)

| File | Change type | Regression surface |
|------|------------|-------------------|
| `domain-integrations/spc/src/adapters/spc-monitoring-mock-data.ts` | Date normalisation + 2 new mock series | Mock data only; `mockControlChartSeries` unchanged |
| `domain-integrations/spc/src/adapters/spc-signals-mock-data.ts` | Date normalisation | Mock data only |
| `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts` | Dispatch by `characteristicId` | Preserves default pH path; existing test unchanged |
| `domain-integrations/spc/src/views/chart-overview-view.tsx` | 3 explicit `ControlChartPanel` instances | No new registration; explicit characteristicIds passed |
| `domain-integrations/maintenance/src/adapters/maintenance-reliability-mock-data.ts` | Date normalisation | Mock data only; WO-/PM-/BL- ID strings unchanged |
| `domain-integrations/maintenance/src/panels/open-work-orders-panel.tsx` | Optional `onWorkOrderClick` prop + button wrapper | `registration` const unchanged; `EvidencePanel` wrapper unchanged |
| `domain-integrations/maintenance/src/views/maintenance-overview-view.tsx` | Optional `onNavigateToView` prop threaded | View composition unchanged |
| `domain-integrations/maintenance/src/maintenance-reliability-workspace.tsx` | Optional `onNavigateToView` prop added | `registration` const unchanged |
| `domain-integrations/warehouse/src/adapters/warehouse-360-mock-data.ts` | Date normalisation | Mock data only; HOLD-/GR-/GI-/TO-/ADJ- ID strings unchanged |
| `domain-integrations/warehouse/src/panels/open-holds-panel.tsx` | Optional `onHoldNavigate` prop + clickable workspace link | `registration` const unchanged; `EvidencePanel` wrapper unchanged |
| `domain-integrations/warehouse/src/views/warehouse-overview-view.tsx` | Optional `onHoldNavigate` prop threaded + 2 new panels added | View composition extended |
| `domain-integrations/warehouse/src/views/holds-management-view.tsx` | Optional `onHoldNavigate` prop threaded | View composition unchanged |
| `domain-integrations/warehouse/src/warehouse-360-workspace.tsx` | Optional `onNavigateToWorkspace` prop added | `registration` const unchanged |
| `domain-integrations/operations/src/panels/plan-risk-summary-panel.tsx` | `AdherenceSparkline` component + `ADHERENCE_TREND` const | `registration` const unchanged; hardcoded const, no contract change |
| `apps/web/src/pages/WorkspaceViews.tsx` | `setView`, `setWorkspace` passed to workspace components | No new workspace IDs; no new imports |
| `apps/web/src/pages/RoleAwareHome.test.tsx` | Remove unused `waitFor` import | Test file; no logic change |

### Warehouse360 + Production Staging functional depth tranche

| File | Change type | Regression surface |
|------|------------|-------------------|
| `domain-integrations/warehouse/src/adapters/production-staging-mock-data.ts` | Date normalisation (2024-03-xx → 2026-05-xx) | Mock data only; BATCH-2024-xxx/TASK-xxx/WAVE-xxx/MV-xxx/SA-ALT-xxx ID strings unchanged |
| `domain-integrations/warehouse/src/panels/exception-stock-summary-panel.tsx` | New panel — `useStockOverview`, blocked locations + zone hold% | New panelId `exception-stock-summary`; `registration` not shared; `source` passed |
| `domain-integrations/warehouse/src/panels/inbound-outbound-summary-panel.tsx` | New panel — `useGoodsMovements`, grouped by type | New panelId `inbound-outbound-summary`; `registration` not shared; `source` passed |
| `domain-integrations/warehouse/src/views/warehouse-overview-view.tsx` | Add `ExceptionStockSummaryPanel` + `InboundOutboundSummaryPanel` | 2 new panels in grid; existing panels unchanged |
| `domain-integrations/warehouse/src/panels/staging-shortfalls-panel.tsx` | Add `onProcessOrderClick?` prop; chip-per-order drill-through; add `source` | `registration` const unchanged; backward-compatible optional prop |
| `domain-integrations/warehouse/src/panels/staging-alerts-panel.tsx` | Add `onNavigateToWorkspace?` prop; WH360 link for blocked-order alert; add `source` | `registration` const unchanged; backward-compatible optional prop |
| `domain-integrations/warehouse/src/views/staging-overview-view.tsx` | Add `StagingShortfallsPanel`; add `onNavigateToWorkspace?` prop threading | View composition extended |
| `domain-integrations/warehouse/src/production-staging-workspace.tsx` | Add `onNavigateToWorkspace?` prop; thread to `StagingOverviewView` | `registration` const unchanged |
| `apps/web/src/pages/WorkspaceViews.tsx` | Pass `setWorkspace` to `ProductionStagingWorkspace` | No new workspace IDs |
| `docs/audit/warehouse-staging-depth-review.md` | New audit table | Documentation only |
| `domain-integrations/warehouse/src/panels/exception-stock-summary-panel.test.tsx` | New — 7 tests | New test file |
| `domain-integrations/warehouse/src/panels/inbound-outbound-summary-panel.test.tsx` | New — 7 tests | New test file |
| `domain-integrations/warehouse/src/panels/staging-shortfalls-panel.test.tsx` | New — 8 tests | New test file |
| `domain-integrations/warehouse/src/panels/staging-alerts-panel.test.tsx` | New — 8 tests | New test file |

---

## Detailed constraint checks

### SPC adapter dispatch (REM-004)

- `getControlChartSeries` now branches on `request.characteristicId`:
  - `CHAR-MOISTURE-001` → `mockMoistureChartSeries` (individuals chart, Moisture %)
  - `CHAR-FAT-001` → `mockFatChartSeries` (xbar-r chart, Fat %)
  - undefined or `CHAR-PH-001` → `mockControlChartSeries` (existing default, pH)
- Existing `control-chart-panel.test.tsx` uses request without `characteristicId` → defaults to pH → **passes unchanged**.
- `chart-overview-view.tsx` now passes explicit `characteristicId` to each of 3 `ControlChartPanel` instances.
- `registration` const on `ControlChartPanel`: **unchanged**.

### Maintenance navigation chain (REM-005)

- `onWorkOrderClick` is optional on `OpenWorkOrdersPanel` — backward compatible.
- Work order rows converted to `<button>` elements with `cursor: default` when no handler provided — preserves visual when callback absent.
- Callback propagates: `WorkspaceViews` (`setView`) → `MaintenanceReliabilityWorkspace` → `MaintenanceOverviewView` → `OpenWorkOrdersPanel`.
- Clicking navigates to the 'work-orders' view within the same workspace — no workspace change.

### WH360 hold drill-through (REM-010)

- `onHoldNavigate` is optional on `OpenHoldsPanel` — backward compatible; falls back to plain text when absent.
- Clickable button only shown when both `hold.linkedWorkspaceId` is set AND `onHoldNavigate` is provided.
- Callback propagates: `WorkspaceViews` (`setWorkspace`) → `Warehouse360Workspace` → `WarehouseOverviewView` / `HoldsManagementView` → `OpenHoldsPanel`.
- Clicking calls `setWorkspace(workspaceId)` which navigates to the linked workspace (e.g. `quality-batch-release`, `trace-investigation`).

### Plan Risk sparkline (REM-009)

- `ADHERENCE_TREND` is a hardcoded local const in `plan-risk-summary-panel.tsx` — no extension to `PlanRiskSummary` data contract.
- `AdherenceSparkline` is a private function component; no export added.
- Pure SVG with `polyline` + `circle` + `text` — no external charting library.
- `registration` const: **unchanged**.

### Date normalisation (REM-012 + staging tranche)

- All 2024-03-xx and 2024-02-xx ISO timestamp fields normalised to 2026 equivalents across 5 mock data files.
- `production-staging-mock-data.ts`: `planDate` fields and all timestamp fields normalised to 2026-05-13/14. ID strings (BATCH-2024-xxx, TASK-xxx, WAVE-xxx, MV-xxx, SA-ALT-xxx) left unchanged.
- ID strings containing "2024" as part of identifiers (WO-2024-xxxxx, HOLD-2024-xxxxx, GR-2024-xxxxx, etc.) left unchanged across all files.
- `spc-signals-adapter.test.ts` fixture `const fixedNow = () => '2024-03-08T15:00:00.000Z'` left unchanged — it is a test time fixture, not a display assertion.

### Production Staging drill-through

- `onProcessOrderClick` is optional on `StagingShortfallsPanel` — backward compatible; falls back to plain order count text when absent.
- When provided, each `affectedOrders` entry renders as a clickable chip calling `onProcessOrderClick(orderId)`.
- Callback propagates: `WorkspaceViews` (`setWorkspace`) → `ProductionStagingWorkspace` → `StagingOverviewView` → `StagingShortfallsPanel`.
- Clicking navigates to `process-order-review` workspace.

### Staging Alerts WH360 navigation

- `onNavigateToWorkspace` is optional on `StagingAlertsPanel` — backward compatible.
- "View WH360 Holds" button only shown for `alertType === 'blocked-order'` AND when callback is provided.
- Clicking calls `onNavigateToWorkspace('warehouse-360-overview')`.

### Source honesty

- All new panels (`ExceptionStockSummaryPanel`, `InboundOutboundSummaryPanel`) pass `source={result?.source}` to `EvidencePanel`.
- `StagingShortfallsPanel` and `StagingAlertsPanel` now pass `source={result?.source}` (previously missing).
- All existing panels with `source` prop are unchanged.

---

## Deployment file status

No Databricks deployment files changed. `apps/api/main.py`, `apps/api/app.yaml`, `apps/api/requirements.txt`, and `scripts/prepare-databricks-app.mjs` are **unchanged** from prior state.
