# SPC Functional Parity Audit

**Date:** 2026-05-16
**Source repos inspected:**
- `C:/Users/tgeldard/Documents/GitHub/spc` — original standalone SPC app (FastAPI + React)
- `C:/Users/tgeldard/Documents/GitHub/connectio-rad-v2` — current V2 workspace

---

## 1. Original SPC — Architecture Overview

The original SPC app is a standalone FastAPI + React application. It is **not** part of the ConnectIO-RAD monorepo. It has a dedicated backend (`main.py`, `routers/`, `services/`, `dal/`) and a dedicated React frontend (`frontend/src/`). The frontend uses **ECharts** for all charting.

### Backend stack
- FastAPI (Python)
- Databricks SQL connector — queries gold views directly from the backend
- No mock fallback — the app requires a live Databricks connection

### Frontend stack
- React + TypeScript
- ECharts (echarts-for-react)
- React Query for data fetching
- shadcn/ui for UI components
- Tailwind CSS

---

## 2. Original SPC — Routes and Entry Points

| # | Tab | Route/hash | Description |
|---|-----|-----------|-------------|
| 01 | Overview | `/` (default) | KPI tiles: active alarms, charts monitored, Cpk trend, out-of-control summary |
| 02 | Control Charts | `/charts` | Per-characteristic chart selector + control chart |
| 03 | Alarm History | `/alarms` | Historical alarms table with acknowledgement |
| 04 | Capability Analysis | `/capability` | Cp/Cpk/Pp/Ppk per characteristic with trend sparkline |
| 05 | Related Batches | `/batches` | Batches affected during alarm windows |
| 06 | MIC Discovery | `/mic-discovery` | Discover monitored characteristics from gold views |
| 07 | MSA | `/msa` | Measurement system analysis (gauge R&R) |
| 08 | Correlation | `/correlation` | Cross-characteristic correlation heatmap |
| 09 | Multivariate | `/multivariate` | Hotelling's T² multivariate chart |

**Plant/line selector:** Plant ID and work centre ID dropdowns at top of every page.

---

## 3. Original SPC — Backend API Routes

All routes are `GET` (query-string params), return `{ data, fetchedAt }`:

| Endpoint | Input params | Gold views / source |
|----------|-------------|---------------------|
| `GET /api/spc/context` | material_id, plant_id | `spc_characteristic_dim_mv`, `gold_plant` |
| `GET /api/spc/summary` | material_id, plant_id | `spc_nelson_rule_flags_mv`, `spc_characteristic_dim_mv` |
| `GET /api/spc/signals` | material_id, plant_id | Computed from `spc_quality_metric_subgroup_v` |
| `GET /api/spc/chart` | material_id, plant_id, mic_id | `spc_quality_metric_subgroup_v`, `spc_locked_limits` |
| `GET /api/spc/capability` | material_id, plant_id, mic_id | `spc_capability_detail_mv` |
| `GET /api/spc/alarms` | material_id, plant_id, dateFrom, dateTo | Computed from `spc_quality_metric_subgroup_v` |
| `GET /api/spc/batches` | material_id, plant_id | `spc_nelson_rule_flags_mv` |
| `GET /api/spc/characteristics` | plantId, workCentreId | `gold_batch_quality_result_v` (discovery) |
| `GET /api/spc/msa` | plantId, characteristicId | `spc_msa_results_v` |
| `GET /api/spc/correlation` | plantId, workCentreId | `spc_quality_metric_subgroup_v` (pivot) |
| `GET /api/spc/multivariate` | plantId, workCentreId | `spc_quality_metric_subgroup_v` (T² calculation) |

---

## 4. Original SPC — Databricks Gold Views

| View | Key columns | Used by |
|------|------------|---------|
| `spc_quality_metrics` | Databricks AI/BI Metric View (WITH METRICS LANGUAGE YAML) | AI/BI Governance only (not a signal table) |
| `spc_quality_metric_subgroup_v` | material_id, plant_id, mic_id, batch_id, sample_id, subgroup_mean, subgroup_range | chart series, correlation, multivariate |
| `spc_locked_limits` | material_id, mic_id, plant_id, operation_id, chart_type, UCL, LCL, CL, USL, LSL, EFFECTIVE_FROM, EFFECTIVE_TO, LOCKED_BY | control limit override |
| `gold_batch_quality_result_v` | material_id, mic_id, batch_id, plant_id, result_value, inspection_lot_id | capability, batches, MIC discovery |
| `spc_msa_results_v` | MIC_ID, PLANT_ID, GAUGE_RR_PERCENT, REPRODUCIBILITY, REPEATABILITY, DISTINCT_CATEGORIES | MSA |

---

## 5. Original SPC — Input Parameters

| Parameter | Scope | Used by |
|-----------|-------|---------|
| `plantId` | Required for all queries | Plant selector dropdown |
| `workCentreId` | Optional filter | Work centre selector dropdown |
| `characteristicId` / `micId` | Required for chart/capability | Characteristic dropdown in Charts tab |
| `dateFrom` / `dateTo` | Optional, defaults to rolling 30 days | Alarm history date range |

---

## 6. Original SPC — Characteristic/MIC Discovery

The original SPC app discovers monitored characteristics from gold views rather than maintaining a hardcoded list.

**`GET /api/spc/characteristics`** queries `gold_batch_quality_result_v` to find distinct `(MIC_ID, MIC_NAME, PLANT_ID, WORK_CENTRE_ID)` combinations with result rows in the target date window. The response includes:
- `micId`, `micName`, `chartType` (derived from sample count heuristic: n≥2 → xbar-r, n=1 → individuals)
- `batchCount`, `sampleCount`, `hasActiveSignal`
- `chartTypeSource`: `'heuristic'` (auto-derived) | `'override'` (from `spc_locked_limits`) | `'manual'` (user-set)

This is the origin of the V2 `MonitoredSPCCharacteristic` concept.

---

## 7. Original SPC — Control Chart Behaviour

**Chart types supported:**
- `xbar-r` — X̄-R chart (subgroup mean + range)
- `individuals` — Individuals / Moving Range (I-MR)
- `xbar-s` — X̄-S chart (subgroup mean + standard deviation)
- `ewma` — Exponentially Weighted Moving Average
- `cusum` — Cumulative Sum
- `p` — p-chart (proportion nonconforming, variable n)
- `np` — np-chart (number nonconforming, constant n)
- `c` — c-chart (count of defects, constant opportunity)
- `u` — u-chart (defects per unit, variable opportunity)

**Control limit logic:**
- Calculated limits: computed from subgroup data (mean ± 3σ)
- Locked/frozen limits: override from `spc_locked_limits`; effective date range
- If a locked limit exists for the characteristic + plant + effective period → use locked limit
- Otherwise → calculate from the available data window

**Spec limit display:**
- USL / LSL from `spc_locked_limits` or `gold_batch_quality_result_v`
- Warning limits: ±2σ (configurable)
- Target / nominal value (optional)

**Point display:**
- Point coloured by status: in-control (green), warning (amber), out-of-control (red)
- Out-of-control points show rule code on hover tooltip
- ECharts used for rendering (line series + scatter overlay)

---

## 8. Original SPC — Rule Violation Logic

**Western Electric rules (4):**
1. One point beyond ±3σ
2. Two of three consecutive points beyond ±2σ on the same side
3. Four of five consecutive points beyond ±1σ on the same side
4. Eight consecutive points on the same side of the centreline

**Nelson rules (8 total, all implemented):**
1. One point beyond ±3σ
2. Nine consecutive points same side of centreline
3. Six consecutive points monotonically increasing or decreasing
4. Fourteen alternating points (up-down-up pattern)
5. Two of three consecutive points beyond ±2σ on same side
6. Four of five consecutive points beyond ±1σ on same side
7. Fifteen consecutive points within ±1σ
8. Eight consecutive points beyond ±1σ on either side

**Alarm fields:**
- `ruleCode` (e.g. `WE1`, `N2`)
- `ruleName` (human-readable)
- `severity`: `critical` | `high` | `medium` | `low`
- `status`: `active` | `resolved` | `acknowledged` | `false-positive`
- `acknowledgedBy`, `acknowledgedAt` (operator email + timestamp)

---

## 9. Original SPC — Capability Metrics

Returned by `GET /api/spc/capability`:

| Metric | Description |
|--------|-------------|
| `Cp` | Process capability (specification width / process width) |
| `Cpk` | Minimum of Cpl and Cpu — accounts for process centering |
| `Pp` | Performance index (uses overall standard deviation) |
| `Ppk` | Minimum of Ppl and Ppu — overall, not short-term |
| `sampleCount` | Total samples in the analysis window |
| `mean` | Process mean |
| `standardDeviation` | Short-term (within-subgroup) σ |
| `overallStdDev` | Long-term (total) σ |
| `interpretation` | `'capable'` \| `'marginal'` \| `'incapable'` |
| confidence | Confidence score (ratio of samples to expected) |

Confidence intervals for Cpk and Ppk are calculated using the chi-squared approximation.

---

## 10. Original SPC — Related Batches

`GET /api/spc/batches` returns batches produced during active alarm windows:
- Per batch: `batchId`, `materialId`, `plantId`, `processOrderId`, `startTime`, `endTime`
- `signalCount` — number of signals during production window
- `releaseImpact`: `'blocking'` (batch in alarm for >50% of production) | `'risk'` | `'none'`
- `dispositionStatus`: batch release status from quality system
- Drill-through link to Quality Batch Release workspace

---

## 11. Original SPC — Advanced Features (MSA, Correlation, Multivariate)

These three tabs are present in the original app but are not included in the V2 scope:

| Feature | Description | V2 status |
|---------|-------------|-----------|
| MSA (Gauge R&R) | Repeatability/reproducibility analysis per gauge/MIC | Not in V2 scope |
| Correlation | Cross-characteristic Pearson correlation heatmap | Not in V2 scope |
| Multivariate | Hotelling's T² control chart | Not in V2 scope |

These are specialist features used by metrology/lab engineers. They are out of scope for the current pilot.

---

## 12. Original SPC — Export / Share

The original app has an **"Export to PDF"** button on the Overview tab. The export renders the current chart series and alarm table into a PDF via browser `window.print()`. This is functional (not mock) in the original.

---

## 13. Current V2 SPC Implementation

### Workspace
`spc-monitoring` (lifecycle: `pilot`)  
Route: `/spc/monitoring`  
Owner: `di-spc`

### Views (5)
| View | Description |
|------|-------------|
| `chart-overview` | SPC summary KPIs + active signals + all monitored characteristic charts |
| `characteristic-review` | Selector list + single characteristic chart + capability panel |
| `capability-analysis` | Capability indices |
| `alarm-history` | Historical alarms table |
| `related-batches` | Batches affected by signals |

### Panels (6)
| Panel | Method | Status |
|-------|--------|--------|
| `SPCSummaryPanel` | `getSPCSummary()` | mock |
| `ActiveSPCSignalsPanel` | `getActiveSPCSignals()` | mock |
| `ControlChartPanel` | `getControlChartSeries(characteristicId)` | mock |
| `CharacteristicCapabilityPanel` | `getCharacteristicCapability()` | mock |
| `SPCAlarmHistoryPanel` | `getSPCAlarmHistory()` | mock |
| `SPCRelatedBatchesPanel` | `getSPCRelatedBatches()` | mock |

### Adapter methods (8)
`getSPCMonitoringContext`, `getSPCSummary`, `getActiveSPCSignals`, `getMonitoredCharacteristics`,  
`getControlChartSeries`, `getCharacteristicCapability`, `getSPCAlarmHistory`, `getSPCRelatedBatches`

All return mock data. No FastAPI proxy routes exist for SPC.

### Data contracts
`SPCMonitoringContext`, `SPCSummary`, `SPCSignal`, `ControlChartSeries`, `ControlChartPoint`,  
`CharacteristicCapability`, `SPCAlarmHistoryItem`, `SPCRelatedBatch`, `MonitoredSPCCharacteristic`

### Mock characteristics (5)
pH (xbar-r, active/high), Moisture % (individuals, active/medium), Fat % (xbar-r, none),  
Salt % (individuals, none), Texture Score (individuals, none)

---

## 14. Key Parity Gaps After Fixes Applied (2026-05-16)

The following fixes were applied in this tranche:

1. **Hardcoded characteristic list removed** — `ChartOverviewView` now maps over `getMonitoredCharacteristics()` result instead of hardcoding pH/Moisture/Fat panels
2. **Characteristic selector added** — `CharacteristicReviewView` shows all monitored characteristics with signal dot indicators; selection drives `ControlChartPanel`
3. **ControlChartPanel empty/insufficient states** — guards for 0 points (no chart rendered) and <3 points (amber warning shown)
4. **Signal timestamp + plant display** — `ActiveSPCSignalsPanel` shows `detectedAt` formatted date and `plantId` on each signal card

### Remaining gaps

| Gap | Original | V2 Status |
|-----|---------|-----------|
| Chart types beyond xbar-r/individuals | 7 additional chart types | Mock data uses xbar-r and individuals only |
| Locked/frozen limits | `spc_locked_limits` override | Not modelled in V2 |
| Calculated limits (short-term σ) | Computed from subgroup data | Mock fixed limits; no calculation |
| Western Electric / Nelson rule codes | 4+8 rules with codes | V2 signals have rule names matching WE/Nelson pattern, but no ruleCode field |
| Alarm acknowledgement | Operator email + timestamp | Mock has `acknowledgedBy`/`acknowledgedAt`; no UI action |
| Capability with confidence intervals | CI for Cpk/Ppk | V2 has `confidence` scalar; no CI bounds |
| Pp/Ppk | Long-term performance indices | V2 schema has `pp`/`ppk` but mock only; no overallStdDev |
| Characteristic discovery from gold views | `gold_batch_quality_result_v` discovery | V2 has `getMonitoredCharacteristics()` — mock only |
| MSA / Gauge R&R | Dedicated tab | Not in V2 scope |
| Correlation heatmap | Dedicated tab | Not in V2 scope |
| Multivariate (T²) | Dedicated tab | Not in V2 scope |
| PDF export | Browser print export | Not implemented |
| Locked limit effective dates | Date range with from/to | Not in V2 schema |
| MIC discovery → chartType assignment | Heuristic from sample count | V2 schema has `chartTypeSource` field; mock only |
| Drill-through to Quality Batch Release | Drill-through link on batches | Schema has `drillThroughTarget`; not wired in UI |
| No FastAPI SPC proxy | 11 original API routes | 0 proxy routes in V2 |
