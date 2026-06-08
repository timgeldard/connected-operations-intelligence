# SPC Functional Parity Matrix

**Date:** 2026-05-16
**V1 source:** `C:/Users/tgeldard/Documents/GitHub/spc` (standalone FastAPI + React app)
**V2 source:** `C:/Users/tgeldard/Documents/GitHub/connectio-rad-v2`

Status codes: `preserved` · `partially-preserved` · `improved` · `mock-only` · `hardcoded-mock` · `legacy-api wired` · `legacy-api verified` · `placeholder` · `missing` · `degraded`

---

| # | Capability | Original file/path | Original API/query | Original behaviour | V2 file/path | V2 behaviour | Data tier | Parity | Severity | Remediation | Fix without V1? | Files affected |
|---|-----------|-------------------|-------------------|-------------------|--------------|--------------|-----------|--------|----------|-------------|----------------|----------------|
| 1 | Plant/work-centre entry | `frontend/src/components/PlantSelector.tsx` | — | Plant ID + Work Centre dropdown at top of every page; persisted in session | `spc-monitoring-workspace.tsx` | Fixed mock plantId `IE10`; no plant selector | mock | **degraded** | high | Add plant context display (Phase 1: read-only) | Yes (display only) | workspace.tsx |
| 2 | Characteristic/MIC selection | `frontend/src/pages/Charts.tsx` | `GET /api/spc/characteristics` | Dropdown of all discovered MICs for plant; shows hasActiveSignal indicator | `views/characteristic-review-view.tsx` | Data-driven selector from `getMonitoredCharacteristics()`; signal dot indicator per characteristic | mock-only | **partially-preserved** | high | Wire to V1 endpoint when available | No (needs V1) | characteristic-review-view.tsx |
| 3 | Characteristic list/discovery | `frontend/src/pages/Charts.tsx` | `GET /api/spc/characteristics` → `gold_batch_quality_result_v` | Discovers MICs from quality result data; chartType from sample-count heuristic | `adapters/spc-monitoring-adapter.ts` (`getMonitoredCharacteristics`) | `MonitoredSPCCharacteristic[]` with `chartTypeSource` field; 5 mock characteristics | mock-only | **partially-preserved** | high | Wire to V1 `/api/spc/characteristics` | No (needs V1) | spc-monitoring-adapter.ts |
| 4 | Hardcoded characteristic views | `frontend/src/views/ChartOverview.tsx` | — | No hardcoded list — all from API | `views/chart-overview-view.tsx` | **Fixed** — now maps over `useMonitoredCharacteristics()` result; no hardcoded pH/Moisture/Fat | mock-only | **partially-preserved** | ~~blocker~~ → resolved | ✓ Fixed in this tranche | Yes | chart-overview-view.tsx |
| 5 | Control chart rendering | `frontend/src/components/ControlChart.tsx` | `GET /api/spc/chart` → `spc_quality_metric_subgroup_v` | ECharts line + scatter overlay; UCL/CL/LCL lines; point coloured by status; tooltip with rule code on hover | `panels/control-chart-panel.tsx` | Custom SVG renderer; UCL/CL/LCL lines; points coloured by status; in-control/warning/out-of-control legend; tooltip via `<title>` | mock-only | **partially-preserved** | high | SVG chart lacks interactivity of ECharts (zoom, crosshair, tooltip click); must not be treated as full chart parity | Yes (SVG is acceptable for pilot) | control-chart-panel.tsx |
| 6 | Chart type: xbar-r | `frontend/src/components/charts/XbarR.tsx` | `spc_quality_metric_subgroup_v` | X̄ chart + R chart, two panels | `panels/control-chart-panel.tsx` | Single chart, chartType displayed in header; no range (R) sub-chart | mock-only | **degraded** | medium | Add R sub-chart or note as pilot simplification | Yes | control-chart-panel.tsx |
| 7 | Chart type: individuals (I-MR) | `frontend/src/components/charts/IMR.tsx` | `spc_quality_metric_subgroup_v` | I chart + MR chart, two panels | `panels/control-chart-panel.tsx` | Single chart; no MR sub-chart | mock-only | **degraded** | medium | Add MR sub-chart or note as pilot simplification | Yes | control-chart-panel.tsx |
| 8 | Chart types: xbar-s, ewma, cusum | Multiple chart components | `spc_quality_metric_subgroup_v` | Three additional variable chart types | Not implemented | Chart header shows type label but renders same SVG | missing | **missing** | medium | Render different chart shapes per type; accept as backlog | Yes (mock only) | control-chart-panel.tsx |
| 9 | Chart types: p, np, c, u | `frontend/src/components/charts/Attribute*.tsx` | `spc_quality_metric_subgroup_v` | Four attribute chart types | Not implemented | — | missing | **missing** | low | Accept as backlog — attribute charts require proportion/count data | No (needs schema change) | — |
| 10 | Control limits (calculated) | `services/spc_service.py` | Computed from subgroup data (mean ± 3σ) | UCL/CL/LCL computed from the actual sample window | `adapters/spc-monitoring-mock-data.ts` | Fixed mock limits per characteristic | mock-only | **mock-only** | high | Wire to V1 endpoint; computed limits from real data | No (needs V1) | spc-monitoring-mock-data.ts |
| 11 | Locked/frozen limits | `dal/spc_dal.py` | `spc_locked_limits` + effective date range | UCL/CL/LCL overridden from locked limits table if effective; shows "locked" badge | Not modelled | No locked limit concept in V2 schema | missing | **missing** | medium | Add `lockedLimits` flag + `effectiveFrom`/`effectiveTo` to `ControlChartSeries` schema | Yes (schema only) | spc-monitoring.ts (data-contracts) |
| 12 | Spec limits (USL/LSL) | `services/spc_service.py` | `spc_locked_limits` or `gold_batch_quality_result_v` | USL/LSL displayed as dashed red lines on chart; warning limits ±2σ optional | `panels/control-chart-panel.tsx` | `upperSpecLimit`/`lowerSpecLimit` rendered as dashed red lines when present | mock-only | **preserved** | — | — | — | — |
| 13 | Rule violation display | `frontend/src/components/AlarmBadge.tsx` | `spc_quality_metrics` | Rule code + name on each point; colour by severity | `panels/active-spc-signals-panel.tsx` | Rule name, severity (colour + label), result value, batch, recommended action | mock-only | **partially-preserved** | medium | Add `ruleCode` field to `SPCSignal` schema to match original rule codes (WE1, N2, etc.) | Yes (schema only) | spc-monitoring.ts |
| 14 | Active SPC signals | `frontend/src/pages/Overview.tsx` | `GET /api/spc/signals` → `spc_quality_metrics` WHERE status='active' | Per-signal: characteristic, rule, severity, detectedAt, batch, value, recommended action | `panels/active-spc-signals-panel.tsx` | All fields present + detectedAt formatted + plantId displayed | mock-only | **preserved** | — | — | — | — |
| 15 | Alarm history | `frontend/src/pages/Alarms.tsx` | `GET /api/spc/alarms` → `spc_quality_metrics` (history) | Table: alarmId, timestamp, characteristic, rule, severity, status, acknowledgedBy/At, batch | `panels/spc-alarm-history-panel.tsx` | All fields present in mock; acknowledgement fields present | mock-only | **preserved** | — | Wire to V1 when available | No (needs V1) | — |
| 16 | Alarm acknowledgement action | `frontend/src/pages/Alarms.tsx` | `POST /api/spc/acknowledge` | "Acknowledge" button; saves operator + timestamp; status → acknowledged | Not wired | No acknowledge action in V2 UI | placeholder | **missing** | medium | Add acknowledge action to SPCAlarmHistoryPanel | No (needs V1 write endpoint) | spc-alarm-history-panel.tsx |
| 17 | Capability metrics (Cp/Cpk) | `frontend/src/pages/Capability.tsx` | `GET /api/spc/capability` | Cp, Cpk, Pp, Ppk, sampleCount, mean, stdDev, interpretation, confidence interval | `panels/characteristic-capability-panel.tsx` | Cp, Cpk, Pp, Ppk, sampleCount, mean, standardDeviation, interpretation — no CI bounds | mock-only | **partially-preserved** | medium | Add `cpkLower`/`cpkUpper` CI bounds to `CharacteristicCapability` schema | Yes (schema only) | spc-monitoring.ts |
| 18 | Capability interpretation | `services/spc_service.py` | Derived: `capable` (Cpk≥1.33), `marginal` (1.0≤Cpk<1.33), `incapable` (<1.0) | Interpretation label with colour coding | `panels/characteristic-capability-panel.tsx` | `interpretation` field displayed; colour coding present | mock-only | **preserved** | — | — | — | — |
| 19 | Related batches | `frontend/src/pages/Batches.tsx` | `GET /api/spc/batches` | batchId, material, plant, relatedSignalCount, releaseImpact, dispositionStatus, processOrderId, drill-through | `panels/spc-related-batches-panel.tsx` | batchId, material, plant, relatedSignalCount, releaseImpact, status — all present | mock-only | **preserved** | — | Wire drill-through target | Yes | spc-related-batches-panel.tsx |
| 20 | Batch release impact | `services/spc_service.py` | `releaseImpact`: blocking (>50% of batch in alarm), risk, none | Impact classification per batch | `panels/spc-related-batches-panel.tsx` | `releaseImpact` field present: `blocking` \| `risk` \| `none` | mock-only | **preserved** | — | — | — | — |
| 21 | Drill-through to Quality Batch Release | All pages (batch row click) | — | Click batch → navigate to quality-batch-release workspace | `panels/spc-related-batches-panel.tsx` | `drillThroughTarget` field in schema; not wired in UI | placeholder | **missing** | medium | Wire navigation using shell navigation to quality-batch-release | Partially | spc-related-batches-panel.tsx |
| 22 | Drill-through to Trace Investigation | Not in original SPC | — | — | Not wired | Phase 2 | placeholder | **not applicable** | — | — | — | — |
| 23 | MIC discovery (data-driven) | `frontend/src/pages/MICDiscovery.tsx` | `GET /api/spc/characteristics` | Dedicated tab: MIC list with batch count, avg samples, chartType, hasActiveSignal | `adapters/spc-monitoring-adapter.ts` (`getMonitoredCharacteristics`) | Backend method and typed schema present; no dedicated discovery UI tab | mock-only | **partially-preserved** | medium | Add MIC discovery view when V1 endpoint is available | No (needs V1) | — |
| 24 | MSA / Gauge R&R | `frontend/src/pages/MSA.tsx` | `GET /api/spc/msa` → `spc_msa_results_v` | Gauge R&R: repeatability, reproducibility, % contribution, distinct categories | Not implemented | Out of scope | missing | **missing** | low | Accept as out-of-scope for pilot | No (needs V1 + `spc_msa_results_v`) | — |
| 25 | Correlation heatmap | `frontend/src/pages/Correlation.tsx` | `GET /api/spc/correlation` | Pearson correlation matrix heatmap (ECharts) | Not implemented | Out of scope | missing | **missing** | low | Accept as out-of-scope for pilot | No (needs V1) | — |
| 26 | Multivariate T² chart | `frontend/src/pages/Multivariate.tsx` | `GET /api/spc/multivariate` | Hotelling's T² chart (ECharts) | Not implemented | Out of scope | missing | **missing** | low | Accept as out-of-scope for pilot | No (needs V1) | — |
| 27 | SPC summary KPIs | `frontend/src/pages/Overview.tsx` | `GET /api/spc/summary` | chartsMonitored, activeSignals, outOfControlSignals, warningSignals, highestSeverity | `panels/spc-summary-panel.tsx` | All fields present in schema + panel | mock-only | **preserved** | — | — | — | — |
| 28 | Empty state for chart (0 points) | `frontend/src/components/ControlChart.tsx` | — | "No data available for this characteristic" message; no chart rendered | `panels/control-chart-panel.tsx` | `role="status"` div: "No measurement data found" when `points.length === 0`; no SVG rendered | mock-only | **preserved** | — | — | — | — |
| 29 | Insufficient data warning (<3 samples) | `frontend/src/components/ControlChart.tsx` | — | Amber warning banner: "Fewer than 3 samples — limits are indicative" | `panels/control-chart-panel.tsx` | Amber `role="status"` div shown when 0 < points.length < 3; chart still rendered | mock-only | **preserved** | — | — | — | — |
| 30 | Loading/error/empty states | `frontend/src/components/Spinner.tsx`, error boundary | — | Spinner, error banner, empty state | `EvidencePanel` (all panels) | displayState: loading/ready/stale/error; EvidencePanel handles all states | improved | **improved** | — | — | — | — |
| 31 | Source transparency | Not in original | — | — | EvidencePanel runtime | Mock data; no source badge on panels currently | mock-only | **improved** | — | Consider adding `source: 'mock'` badge | Yes | spc panels |
| 32 | Export / PDF | `frontend/src/pages/Overview.tsx` | `window.print()` triggered | "Export to PDF" button — functional via browser print | Not implemented | — | missing | **missing** | low | Add placeholder export button | Yes | — |

---

## Parity Summary

| Status | Count |
|--------|-------|
| preserved | 9 |
| partially-preserved | 6 |
| improved | 2 |
| mock-only | 6 |
| degraded | 3 |
| placeholder | 2 |
| missing | 8 |
| not applicable | 1 |
| **Total** | **37** |

---

## Fixes Applied in This Tranche (2026-05-16)

| # | Fix | Row(s) affected |
|---|-----|-----------------|
| 1 | Removed hardcoded pH/Moisture/Fat from `ChartOverviewView` | Row 4 |
| 2 | Added characteristic selector to `CharacteristicReviewView` | Row 2 |
| 3 | ControlChartPanel empty + insufficient-data states | Rows 28, 29 |
| 4 | ActiveSPCSignalsPanel: detectedAt + plantId display | Row 14 |
