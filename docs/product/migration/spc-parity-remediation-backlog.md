# SPC Parity Remediation Backlog

**Date:** 2026-05-16
**Scope:** SPC Monitoring workspace (`di-spc`)
**Reference:** `docs/migration/spc-functional-parity-matrix.md`

---

## Group A — Must Fix for Functional Parity

### A1. Wire `getMonitoredCharacteristics()` to V1 endpoint

- **User impact:** Without a real MIC list, operators cannot see their actual monitored characteristics. The hardcoded mock (pH, Moisture, Fat, Salt, Texture) will not match the target plant's configuration.
- **Current problem:** `getMonitoredCharacteristics()` returns a fixed 5-characteristic mock. The view renders correctly but the list bears no relation to what is actually monitored at the plant.
- **Original behaviour to preserve:** `GET /api/spc/characteristics` queried `gold_batch_quality_result_v` to discover active MICs for the plant/work-centre. `chartType` was derived from subgroup size heuristic.
- **Proposed V2 fix:** Add `SPCLegacyApiAdapter.getMonitoredCharacteristics()` override that calls a FastAPI proxy route `GET /api/spc/characteristics`. Implement the FastAPI route. Browser-verify against V1.
- **Source/data dependency:** V1 `/api/spc/characteristics` endpoint + `gold_batch_quality_result_v`
- **Implementation risk:** Medium — the `MonitoredSPCCharacteristic` schema is in place; the main risk is field name mismatches between V1 and the V2 schema.
- **Effort:** 3–5 days (FastAPI route + adapter override + contract tests + browser verification)
- **Priority:** High

---

### A2. Wire `getControlChartSeries()` to V1 endpoint

- **User impact:** Without real chart data, the control chart shows fixed mock values that do not reflect actual production. A control chart showing the wrong limits and wrong points undermines operator trust.
- **Current problem:** `getControlChartSeries()` returns mock data. The chart routing by `characteristicId` is present but all values are static.
- **Original behaviour to preserve:** `GET /api/spc/chart` queried `spc_quality_metric_subgroup_v` + `spc_locked_limits`. Returned actual sample points with timestamps, subgroup means/ranges, UCL/CL/LCL computed or locked.
- **Proposed V2 fix:** Add `SPCLegacyApiAdapter.getControlChartSeries()` override calling `GET /api/spc/chart?characteristicId=...&plantId=...`. Implement FastAPI proxy route.
- **Source/data dependency:** V1 `GET /api/spc/chart` + `spc_quality_metric_subgroup_v` + `spc_locked_limits`
- **Implementation risk:** High — ECharts-specific response format in the original may require mapping to V2 `ControlChartSeries` schema.
- **Effort:** 5–8 days (includes mapping layer + contract tests + browser verification)
- **Priority:** High

---

### A3. Wire `getActiveSPCSignals()` to V1 endpoint

- **User impact:** Active signals panel shows mock pH and Moisture signals regardless of real production state. This is the most visible panel and will mislead operators.
- **Current problem:** `getActiveSPCSignals()` returns 2 hardcoded mock signals.
- **Original behaviour to preserve:** `GET /api/spc/chart-data` returned raw subgroup data and V1 computed rule violations client-side at runtime using `detectWECORules()` / `detectNelsonRules()`.
- **Proposed V2 fix:** Port V1's `calculations.runtime.ts` rule engine to V2 and apply it to chart data returned by the adapter.
- **Source/data dependency:** V1 `POST /api/spc/chart-data`
- **Implementation risk:** Low — signal schema is straightforward; risk is in rule code naming conventions.
- **Effort:** 2–3 days
- **Priority:** High

---

### A4. Add `ruleCode` field to `SPCSignal` schema

- **User impact:** Original app shows rule codes (e.g. `WE1`, `N2`) alongside rule names. Without `ruleCode`, the V2 signals cannot be cross-referenced with operator documentation or SPC software.
- **Current problem:** `SPCSignal` has `rule` (name) but no `ruleCode`. Original signals had both.
- **Original behaviour to preserve:** Each alarm had `ruleCode: 'WE1'` (or `N1`–`N8`) and `ruleName: 'Point beyond 3σ control limit (upper)'`.
- **Proposed V2 fix:** Add optional `ruleCode: z.string().optional()` to `SPCSignalSchema`. Populate in mock data and future V1 response mapping.
- **Source/data dependency:** None (schema change only; mock update is trivial)
- **Implementation risk:** Very low — additive schema change
- **Effort:** 0.5 days
- **Priority:** Medium

---

## Group B — Should Fix for Credible Pilot/Demo

### B1. Add locked limit indicator to ControlChartPanel

- **User impact:** Operators need to know whether limits shown are calculated or locked/frozen. Locked limits mean the chart is stable; calculated limits reflect current data volatility.
- **Current problem:** `ControlChartSeries` has no `lockedLimits` flag or effective date range. The panel cannot distinguish locked from calculated limits.
- **Original behaviour to preserve:** Chart displayed a "LOCKED" badge when limits came from `spc_locked_limits`. Effective date range was shown in a tooltip.
- **Proposed V2 fix:** Add `lockedLimits?: boolean` and `lockedFrom?: string`, `lockedTo?: string` to `ControlChartSeries` schema. Update mock data for pH chart (locked). Show badge in panel header when `lockedLimits: true`.
- **Source/data dependency:** Schema change only; lock data from `spc_locked_limits` when V1 wired.
- **Implementation risk:** Very low
- **Effort:** 1 day
- **Priority:** Medium

---

### B2. Add R sub-chart for xbar-r chart type

- **User impact:** X̄-R charts require both the X̄ (mean) chart and the R (range) chart. Showing only the mean chart gives an incomplete picture of process stability.
- **Current problem:** `ControlChartPanel` renders a single time-series for all chart types. For xbar-r, the range is not shown.
- **Original behaviour to preserve:** Two vertically stacked panels — X̄ chart above, R chart below. Each with own UCL/LCL.
- **Proposed V2 fix:** Add `rangePoints?: ControlChartPoint[]`, `rangeUpperControlLimit?: number`, `rangeLowerControlLimit?: number` to `ControlChartSeries`. Render second SVG below when `chartType === 'xbar-r'` and range data is present.
- **Source/data dependency:** V1 endpoint must return range data; schema is a V2-only change until then.
- **Implementation risk:** Medium — requires schema extension and conditional rendering logic.
- **Effort:** 2–3 days
- **Priority:** Medium

---

### B3. Wire drill-through to Quality Batch Release

- **User impact:** The most important cross-workspace link from SPC is batch → batch release. Operators who see a blocking signal need one click to the batch release workspace.
- **Current problem:** `SPCRelatedBatch.drillThroughTarget` is set to `'quality-batch-release'` in the schema but the panel does not fire navigation.
- **Original behaviour to preserve:** Clicking a batch row navigated to the batch release view for that batch.
- **Proposed V2 fix:** Add `onDrillThrough` callback to `SPCRelatedBatchesPanel`. Fire shell navigation with `{ workspace: 'quality-batch-release', batchId, plantId }` context.
- **Source/data dependency:** Shell navigation API (V2 internal — no V1 required)
- **Implementation risk:** Low
- **Effort:** 1 day
- **Priority:** Medium

---

### B4. Wire alarm acknowledgement action

- **User impact:** Operators acknowledged alarms in the original app to confirm they had reviewed a signal. Without this, the alarm history panel is read-only and provides no workflow.
- **Current problem:** `SPCAlarmHistoryPanel` has no acknowledge button. `SPCAlarmHistoryItem.acknowledgedBy`/`acknowledgedAt` are in the schema but never set.
- **Original behaviour to preserve:** "Acknowledge" button per alarm row; calls `POST /api/spc/acknowledge` with `alarmId` + operator identity; updates status → `acknowledged`.
- **Proposed V2 fix:** Add acknowledge button (disabled state until V1 write endpoint confirmed). Fire adapter method `acknowledgeAlarm(alarmId)` which calls V1 proxy when available. Update local state optimistically.
- **Source/data dependency:** V1 `POST /api/spc/acknowledge` endpoint
- **Implementation risk:** Medium — write endpoint; requires auth context for operator identity
- **Effort:** 3–4 days
- **Priority:** Medium

---

### B5. Add Cpk confidence interval to CharacteristicCapabilityPanel

- **User impact:** A Cpk of 1.18 with a narrow confidence interval (e.g. 1.05–1.31) is very different from the same value with a wide interval (0.80–1.56). Without CI, capability indices can be misleading.
- **Current problem:** `CharacteristicCapability` has a single `confidence` scalar (ratio of data completeness). No statistical CI bounds for Cpk or Ppk.
- **Original behaviour to preserve:** CI shown as `Cpk: 1.18 [1.05, 1.31]` using chi-squared approximation; CI narrowed as sample count increased.
- **Proposed V2 fix:** Add optional `cpkLower?: number`, `cpkUpper?: number`, `ppkLower?: number`, `ppkUpper?: number` to `CharacteristicCapabilitySchema`. Update panel to display bounds when present.
- **Source/data dependency:** Schema change only; CI values from V1 calculation when wired.
- **Implementation risk:** Very low
- **Effort:** 1 day
- **Priority:** Medium

---

## Group C — Backlog / Later

### C1. MIC Discovery dedicated view

- **User impact:** Quality engineers used the MIC Discovery tab to understand what characteristics were available and configure monitoring. This is a setup/configuration workflow, not a daily monitoring view.
- **Current problem:** `getMonitoredCharacteristics()` method exists but there is no dedicated discovery tab in V2.
- **Proposed V2 fix:** Add a new `mic-discovery` view to the SPC workspace. Wire to `getMonitoredCharacteristics()`.
- **Source/data dependency:** V1 `GET /api/spc/characteristics`
- **Effort:** 3 days
- **Priority:** Low

---

### C2. Attribute chart types (p, np, c, u)

- **User impact:** Plants using attribute inspection (pass/fail count data) cannot use V2 SPC charts. This affects lines with go/no-go measurements.
- **Current problem:** `ChartTypeSchema` includes `p | np | c | u` but `ControlChartPanel` renders the same SVG for all types. No proportion/count series logic.
- **Proposed V2 fix:** Add attribute chart variants to `ControlChartPanel` with appropriate denominator (n subgroup size) rendering.
- **Source/data dependency:** V1 `GET /api/spc/chart` must return proportion/count data; schema extension required.
- **Effort:** 5 days
- **Priority:** Low

---

### C3. MSA (Gauge R&R) panel

- **User impact:** Metrology engineers used MSA to validate measurement instruments. Without it, gauge qualification cannot be done in V2.
- **Current problem:** Not in V2 scope.
- **Proposed V2 fix:** Add MSA view + panel when `spc_msa_results_v` is available in V1/Databricks.
- **Source/data dependency:** V1 `GET /api/spc/msa` + `spc_msa_results_v`
- **Effort:** 5 days
- **Priority:** Low

---

### C4. Correlation heatmap

- **User impact:** Advanced users correlating, e.g., pH drift with temperature variation. Not required for basic SPC monitoring.
- **Effort:** 4 days (ECharts or D3 heatmap)
- **Priority:** Very low

---

### C5. Multivariate T² chart

- **User impact:** Specialist feature for multivariate process control. Required only when multiple characteristics must be monitored jointly.
- **Effort:** 5 days
- **Priority:** Very low

---

### C6. PDF export

- **User impact:** Reports are generated occasionally for audits and customer quality reviews. Not a daily workflow.
- **Current problem:** Not implemented.
- **Proposed V2 fix:** Add `window.print()` export button on Overview/Chart view.
- **Source/data dependency:** None
- **Effort:** 1 day
- **Priority:** Low

---

## Constraint Reminder

> Do not hardcode new characteristics. When the above fixes are implemented, the data source for characteristic lists must always be the adapter (`getMonitoredCharacteristics()`), never a static array in the view layer.
