# Placeholder and Mock Inventory — ConnectIO-RAD V2

**Audit date:** 2026-05-16

---

## Classification rubric

| Label | Test |
|-------|------|
| **Mock** | Returns hardcoded TypeScript object literal; adapter method signature uses `_request` (underscore = ignored) |
| **Placeholder** | Component renders a shape (SVG, CSS grid, text) standing in for a real chart/graph; upgrade path documented |
| **Console-only action** | Action form submits and emits `console.info`; no backend mutation |
| **Snapshot page** | Page renders hardcoded point-in-time data; no live query |

---

## Domain adapter mocks

### All adapters: universal mock pattern

Every adapter across all 8 domains follows this pattern:

```typescript
async getXyz(_request: XyzRequest): Promise<AdapterResult<XyzData>> {
  await this.delay();          // optional; Quality and Traceability only
  return ok(mockXyzData, this.now);
}
```

- `_request` is never read
- `ok()` wraps a hardcoded fixture with a timestamp
- No filtering, sorting, or computation is applied to request parameters

| Domain | Adapter File | Methods | Mock Data File | Mock Objects | Simulated Latency |
|--------|-------------|---------|---------------|-------------|-------------------|
| Traceability | `trace2-adapter.ts` | 10 | `trace2-mock-data.ts` | 10+ objects | Yes |
| Quality (release) | `quality-release-adapter.ts` | 7 | `quality-release-mock-data.ts` | 6 objects | Yes |
| Quality (blockers) | `quality-blockers-adapter.ts` | 2 | `quality-blockers-mock-data.ts` | 2 objects | No |
| Operations (evidence) | `operations-evidence-adapter.ts` | 1 | `operations-evidence-mock-data.ts` | 1 object | No |
| Operations (plan risk) | `operations-plan-risk-adapter.ts` | 9 | `operations-plan-risk-mock-data.ts` | 6+ objects | No |
| Operations (order review) | `process-order-review-adapter.ts` | 7 | `process-order-review-mock-data.ts` | 4+ objects | No |
| SPC (signals) | `spc-signals-adapter.ts` | 1 | `spc-signals-mock-data.ts` | 1 object | No |
| SPC (monitoring) | `spc-monitoring-adapter.ts` | 7 | `spc-monitoring-mock-data.ts` | 5+ objects | No |
| EnvMon | `envmon-adapter.ts` | 9 | `envmon-mock-data.ts` | 8 objects | No |
| Warehouse (evidence) | `warehouse-evidence-adapter.ts` | 1 | `warehouse-evidence-mock-data.ts` | 1 object | No |
| Warehouse (staging) | `warehouse-staging-adapter.ts` | 2 | `warehouse-staging-mock-data.ts` | 2 objects | No |
| Warehouse (staging prod) | `production-staging-adapter.ts` | 9 | (separate mock file) | 5+ objects | No |
| Warehouse (360) | `warehouse-360-adapter.ts` | 7 | (separate mock file) | 4+ objects | No |
| Maintenance (constraints) | `maintenance-constraints-adapter.ts` | 1 | `maintenance-constraints-mock-data.ts` | 1 object | No |
| Maintenance (reliability) | `maintenance-reliability-adapter.ts` | 7 | `maintenance-reliability-mock-data.ts` | 7 objects | No |
| **Totals** | **15 adapter files** | **79 methods** | **15 mock data files** | **~70 exported objects** | **2 domains** |

**Selected mock literal citations:**

- `envmon-mock-data.ts`: `plant: 'IE10'`, `plantName: 'Kerry Listowel'`, 5 hardcoded zones, 3 hardcoded alerts, 4 swab results
- `trace2-mock-data.ts` line 22–25: `MOCK_INVESTIGATION_ID = 'INV-2024-003847'`, `MOCK_BATCH_ID = 'CH-240308-0047'`, `MOCK_PLANT_ID = 'IE10'`
- `quality-release-mock-data.ts`: `releaseCaseId: 'RC-2024-001847'`, `blockers: ['MIC failure: Listeria spp.', 'CoA incomplete']`
- `operations-plan-risk-mock-data.ts`: `topRiskReason: 'Block press breakdown on L-04 and CHIP-VAR-001 material shortage affecting 3 process orders'`
- `maintenance-constraints-mock-data.ts`: `constraintId: 'MC-20260515-001'`, `affectedOrders: ['4500837291', '4500837299']`
- `warehouse-evidence-mock-data.ts` line 19–20: `reason: 'MIC failure — Listeria monocytogenes detected above limit. Batch quarantined pending investigation.'`

---

## Placeholder panels

| Panel | File | Lines | What renders | What's missing | Upgrade note |
|-------|------|-------|---|---|---|
| TraceGraphPanel | `traceability/src/panels/trace-graph-panel.tsx` | 141 | Risk badge list, upstream/downstream/depth counts | Interactive node graph | "Graph visualisation (React Flow) will be added in Phase 2." (line 125) |
| BatchLineagePanel | `traceability/src/panels/BatchLineagePanel.tsx` | 101 | Text summary: batch ID, material ID, parent/child counts, depth | Interactive lineage graph | "A full interactive graph is out of scope for Phase 1." (lines 49–52) |
| ControlChartPanel | `spc/src/panels/control-chart-panel.tsx` | 157 | Hand-rolled SVG: UCL/CL/LCL lines, polyline, status-coloured circles | recharts or nivo chart with tooltips, zoom, rule annotations | "Production-shaped ASCII chart placeholder — upgrade path: replace with recharts/nivo" (line 69) |
| EnvMonHeatmapPanel | `envmon/src/panels/envmon-heatmap-panel.tsx` | 83 | CSS `auto-fill minmax(140px)` grid of coloured risk-score cards | Floor-plan spatial layout, zone click-through, alert drill-down | No comment; implied by name ("heatmap" implies spatial) |

**Colour literal violations in placeholder panels** (should use CSS tokens instead of hex):

| Panel | Literal | Should be |
|-------|---------|-----------|
| `control-chart-panel.tsx` | `#D32F2F`, `#D97706`, `#388E3C` | `var(--status-bad)`, `var(--status-warn)`, `var(--status-good)` |
| `trace-graph-panel.tsx` | `#D97706`, `#D4A017` | `var(--status-warn)` |
| `envmon-heatmap-panel.tsx` | `#D32F2F`, `#F57C00`, `#D97706`, `#2E7D32` | CSS token equivalents |

---

## Console-only action flows

| Action | File | Submit handler | Mock success message |
|--------|------|---------------|---------------------|
| Release Batch | `quality/src/actions/release-batch-action.tsx` line 64 | `console.info('[quality-batch-release] release-batch submitted', { releaseCaseId, form })` | "Batch released successfully (mock)." |
| Place on Hold | `quality/src/actions/place-on-hold-action.tsx` line 56 | `console.info('[quality-batch-release] place-on-hold submitted', { releaseCaseId, form })` | "Batch placed on hold (mock)." |
| Request Retest | `quality/src/actions/request-retest-action.tsx` | Console emit (assumed same pattern) | — |
| Escalate Deviation | `quality/src/actions/escalate-deviation-action.tsx` | Console emit (assumed same pattern) | — |
| Open Trace Investigation | `quality/src/actions/open-trace-investigation-action.tsx` | Console emit (assumed same pattern) | — |

All action flows display a validation-backed form. Form validation is real. The submit handler is console-only. `release-actions-panel.tsx` line 328: *"No real backend mutation is performed in Phase 1 — mock submit handlers emit console telemetry only."*

---

## Snapshot pages (hardcoded point-in-time data)

| Page | Hardcoded data | Item count |
|------|---------------|-----------|
| `RoleAwareHome` | 8 arrays: plan risk, priority releases, EM alerts, staging summary, SPC signals, warehouse holds, work orders | ~18 items total |
| `ProductionReadinessPage` | `FINDINGS` constant | 14 findings |
| `WorkspaceParityPage` | `PARITY_ASSESSMENTS` constant | 9 workspace assessments |
| `TelemetryDashboardPage` | `MOCK_EVENTS` constant | 25 events, 7 users |
| `CutoverSimulationPage` | `SIMULATION_PAIRS` + `SIMULATION_RESULTS` | 6 pairs + 3 results |
| `CutoverRecommendationPage` | `CUTOVER_RECOMMENDATION` constant | 1 object, 14 fields |
| `LegacyRetirementPage` | `LEGACY_SYSTEMS` constant | 6 systems |
| `ReleaseGatePage` | `RELEASE_GATES` constant | 10 gates |
| `RolloutWavePlanPage` | `ROLLOUT_WAVES` constant | 4 waves |
| `GoNoGoAssessmentPage` | `GO_NO_GO_DIMENSIONS` constant | 12 dimensions |
| `StakeholderSignoffPage` | `SIGNOFFS` constant | 8 signoffs |
| `PilotExecutionDashboardPage` | Various snapshot constants | ~20 items |
| `PilotIssueRegisterPage` | Hardcoded issue list | — |
| `ScenarioValidationPage` | Hardcoded scenario list | — |

---

## What is NOT mocked (genuinely real)

| Item | Location | Real behaviour |
|------|----------|----------------|
| `usePinnedWorkspaces` | `personalization/src/usePinnedWorkspaces.ts` | Reads/writes localStorage |
| `useRecentWorkspaces` | `personalization/src/useRecentWorkspaces.ts` | Reads/writes localStorage |
| `usePanelOrder` | `personalization/src/usePanelOrder.ts` | Reads/writes localStorage |
| `workspaceRegistry` | `apps/web/src/registry/workspace-registry.ts` | Static runtime registry; derives real workspace list |
| `AdminGovernancePage` tab views | `apps/web/src/pages/AdminGovernancePage.tsx` | Derives all data from live registry |
| `FeedbackDrawer` | `apps/web/src/feedback/FeedbackDrawer.tsx` | Real form; submit is console-only but UX is complete |
| All design-system components | `packages/design-system/src/` | Real, production-ready UI primitives |
| All product-model types and helpers | `packages/product-model/src/` | Real domain model; no mocks |
| All data-contracts schemas | `packages/data-contracts/src/` | Real Zod schemas; not yet called by adapters |
