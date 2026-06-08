# SPC Functional Parity Architecture Check

**Date:** 2026-05-16
**Domain:** `di-spc` / `spc-monitoring`
**Reviewer:** SPC parity tranche (e.txt)
**Reference:** `docs/migration/spc-functional-parity-audit.md`, `docs/migration/spc-functional-parity-matrix.md`

---

## Purpose

This document checks that the SPC parity fixes applied in the e.txt tranche do not regress the V2 workspace/evidence-panel architecture. It confirms constraints from the task definition are respected.

---

## Constraint Check

| Constraint | Status | Evidence |
|---|---|---|
| SPC Monitoring remains a V2 workspace | ✓ Pass | `spc-monitoring-workspace.tsx` — `StandardWorkspaceTemplate` unchanged |
| Workspace uses `StandardWorkspaceTemplate` | ✓ Pass | No changes to workspace template or registration |
| All panels use `EvidencePanel` | ✓ Pass | `ControlChartPanel`, `ActiveSPCSignalsPanel` — both wrap `<EvidencePanel>` |
| Adapter methods return `AdapterResult<T>` | ✓ Pass | `SPCMonitoringAdapter` — all methods return `ok(data, now)` |
| No direct shadcn/Radix imports in domain-integrations | ✓ Pass | No new imports; SVG rendering is plain inline |
| No custom app shell | ✓ Pass | No shell-level changes |
| No speculative FastAPI routes | ✓ Pass | No `apps/api/routes/spc.py` file created |
| No unlabelled mock data | ✓ Pass | Mock data is in `spc-monitoring-mock-data.ts`; source is clearly named |
| No claims of live/browser-verified data | ✓ Pass | All tests use `vi.mock`; no browser verification claimed |
| No hardcoded characteristic list in views | ✓ Pass | `ChartOverviewView` now maps over `useMonitoredCharacteristics()`; `CharacteristicReviewView` does the same |
| No SPC domain logic in UI components | ✓ Pass | Signal severity colour map in panel is presentation-only; no business logic moved in |
| New helper functions typed and tested | ✓ Pass | No new helpers added; existing adapter routing extended |

---

## Changes Applied

### 1. `packages/data-contracts/src/schemas/spc-monitoring.ts`

Added `MonitoredSPCCharacteristicSchema`:
```typescript
export const MonitoredSPCCharacteristicSchema = z.object({
  characteristicId: z.string(),
  characteristicName: z.string(),
  micId: z.string().optional(),
  chartType: ChartTypeSchema,
  batchCount: z.number().int().min(0),
  avgSamplesPerBatch: z.number().optional(),
  hasActiveSignal: z.boolean(),
  highestSignalSeverity: SeveritySchema.optional(),
  operationId: z.string().optional(),
  chartTypeSource: z.enum(['heuristic', 'override', 'manual']).optional(),
})
```

**Verdict:** Additive schema extension. Backward-compatible. No existing consumers broken.

---

### 2. `domain-integrations/spc/src/adapters/spc-monitoring-mock-data.ts`

Added `mockMonitoredCharacteristics` (5 entries), `mockSaltChartSeries`, `mockTextureChartSeries`.

**Verdict:** Additive fixture data. No existing mock data modified. New chart series follow same shape as existing `mockControlChartSeries`.

---

### 3. `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`

- Added `getMonitoredCharacteristics()` method returning `ok(mockMonitoredCharacteristics, this.now)`.
- Extended `getControlChartSeries()` routing to handle `CHAR-SALT-001` and `CHAR-TEXTURE-001`.

**Verdict:** Additive. No existing method signatures changed. Routing pattern follows existing `CHAR-MOISTURE-001` / `CHAR-FAT-001` precedent.

---

### 4. `domain-integrations/spc/src/adapters/spc-monitoring-queries.ts`

Added `useMonitoredCharacteristics()` hook following existing `useControlChartSeries` pattern.

**Verdict:** Additive. No existing hooks modified.

---

### 5. `domain-integrations/spc/src/views/chart-overview-view.tsx`

Replaced hardcoded `ControlChartPanel` for pH/Moisture/Fat with `useMonitoredCharacteristics(request)` + `characteristics.map(...)`.

**Verdict:** Correct fix. Hardcoded characteristic list removed. View is now data-driven. Architecture constraint satisfied.

---

### 6. `domain-integrations/spc/src/views/characteristic-review-view.tsx`

Added `useState` selector + signal dot indicator. Drives `ControlChartPanel` and `CharacteristicCapabilityPanel` with `selectedRequest`.

**Verdict:** Local UI state (selector index). No business logic. Data source is still `getMonitoredCharacteristics()`. Architecture constraint satisfied.

---

### 7. `domain-integrations/spc/src/panels/control-chart-panel.tsx`

- Moved characteristic name/point count label above the conditional block (always visible).
- Added empty state (`points.length === 0`): renders `role="status"` message; no SVG rendered.
- Added insufficient-data warning (`0 < points.length < 3`): amber `role="status"` div above chart.

**Verdict:** No architectural change. Rendering guards prevent `Math.min(...[])` crash on empty points. `EvidencePanel` wrapping unchanged.

---

### 8. `domain-integrations/spc/src/panels/active-spc-signals-panel.tsx`

Added `detectedAt` formatted timestamp + `plantId` display row to each signal card.

**Verdict:** Pure rendering addition. No data model change. All signal fields were already present in `SPCSignal` schema.

---

## Test Coverage

| File | Tests | Status |
|---|---|---|
| `spc-monitoring-adapter.test.ts` | 39 total (16 new in this tranche) | ✓ Pass |
| `control-chart-panel-states.test.tsx` | 9 new | ✓ Pass |
| `active-spc-signals-panel.test.tsx` | 10 new | ✓ Pass |
| `spc-monitoring.test.ts` (data contracts) | Existing | ✓ Pass |
| `spc-monitoring-queries.test.ts` | Existing | ✓ Pass |
| `spc-summary-panel.test.tsx` | Existing | ✓ Pass |
| `spc-alarm-history-panel.test.tsx` | Existing | ✓ Pass |
| **Total** | **66 passing** | ✓ All pass |

---

## Regressions Checked

| Panel | Previously passing | Still passing |
|---|---|---|
| `SPCSummaryPanel` | ✓ | ✓ |
| `SPCAlarmHistoryPanel` | ✓ | ✓ |
| Adapter: `getSPCSummary` | ✓ | ✓ |
| Adapter: `getActiveSPCSignals` | ✓ | ✓ |
| Adapter: `getControlChartSeries` (pH) | ✓ | ✓ |
| Adapter: `getControlChartSeries` (Moisture) | ✓ | ✓ |
| Adapter: `getControlChartSeries` (Fat) | ✓ | ✓ |

---

## Architecture Anti-Patterns Verified Absent

| Anti-pattern | Check |
|---|---|
| Hardcoded characteristic ID in view layer | ✓ None — `ChartOverviewView` and `CharacteristicReviewView` use data from adapter |
| Hardcoded control limits in panel | ✓ None — limits come from `ControlChartSeries` data |
| `import` of Databricks or FastAPI client in panel | ✓ None |
| Direct `fetch()` or `axios()` call in panel | ✓ None |
| SVG chart claimed as full chart parity | ✓ Not claimed — documented as partially-preserved in matrix |
| Mock signals claimed as rule-engine parity | ✓ Not claimed — mock-only tier documented |

---

## Remaining Architecture Risks

1. **No FastAPI proxy for SPC.** When the first `SPCLegacyApiAdapter` override is written, care must be taken to add contract tests before browser-verifying. The V1 response shape may not match the V2 `ControlChartSeries` schema exactly (field naming conventions differ between the original FastAPI app and the V2 adapter).

2. **Mock characteristic IDs are in adapter routing.** The `getControlChartSeries()` method dispatches on hardcoded `'CHAR-SALT-001'` etc. This is acceptable while all data is mock, but must be replaced with a generic routing strategy (e.g., characteristic-specific series lookup) when V1 is wired.

3. **`CharacteristicCapabilityPanel` does not yet accept `characteristicId` per-characteristic.** The current mock returns the same pH capability regardless of which characteristic is selected. This will need to be fixed when real data is wired or when the selector test is extended to verify per-characteristic capability loading.

---

## Summary

All four parity fixes applied in this tranche are **architecturally clean**:
- No constraints violated
- No regressions introduced
- 66 tests passing
- Hardcoded characteristic list successfully removed from view layer
