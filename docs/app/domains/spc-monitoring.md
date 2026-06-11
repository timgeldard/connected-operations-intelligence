# SPC Monitoring Domain Reference

**Domain:** `spc`
**Workspace:** `spc-monitoring`
**Owner:** `di-spc`
**Lifecycle:** `pilot`
**Route:** `/spc/monitoring`
**Date updated:** 2026-05-16

---

## Purpose

The SPC Monitoring workspace gives process engineers, quality technicians, and quality leads a consolidated view of statistical process control signals, control chart series, process capability indices, and alarm history across a plant or production line.

The workspace preserves the original ConnectIO-RAD SPC app's core workflow: characteristic selection, control chart behaviour, rule signals, limits, batch/material/plant context, and quality impact. It wraps that capability in the V2 evidence-panel architecture without redesigning the underlying SPC semantics.

---

## Supported Roles

| Role | Primary use |
|------|-------------|
| `process-engineer` | Monitor charts; investigate signals; link to process events |
| `quality-technician` | Review active alarms; acknowledge resolved signals |
| `quality-lead` | Review capability trends; request batch reviews |
| `plant-manager` | Summary KPIs; batch release impact overview |

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `spc.read` | View control charts, SPC signals, capability indices, and alarm history |

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | `spc-monitoring` |
| displayName | SPC Monitoring |
| domainId | `spc` |
| ownerDomain | `spc` |
| lifecycle | `pilot` |
| route | `/spc/monitoring` |
| telemetryId | `spc.monitoring` |

---

## Views

### 1. Chart Overview (`chart-overview`)

Default landing view. Shows SPC summary KPIs, active signals list, and control charts for all monitored characteristics.

The characteristic list is data-driven via `getMonitoredCharacteristics()` — no characteristics are hardcoded in the view.

**Panels:** `SPCSummaryPanel`, `ActiveSPCSignalsPanel`, `ControlChartPanel` × N (one per monitored characteristic)

---

### 2. Characteristic Review (`characteristic-review`)

Single-characteristic deep-dive. Selector row shows all monitored characteristics with signal dot indicators. Selecting a characteristic updates the `ControlChartPanel` and `CharacteristicCapabilityPanel`.

Default selection: first characteristic in the monitored list.

**Panels:** Characteristic selector (inline), `ControlChartPanel`, `CharacteristicCapabilityPanel`

---

### 3. Capability Analysis (`capability-analysis`)

Process capability indices per characteristic with interpretation.

**Panels:** `CharacteristicCapabilityPanel`, `SPCSummaryPanel`

---

### 4. Alarm History (`alarm-history`)

Historical alarms with acknowledgement status, rule violated, characteristic, and linked batch.

**Panels:** `SPCAlarmHistoryPanel`, `ActiveSPCSignalsPanel`

---

### 5. Related Batches (`related-batches`)

Batches produced during active signal windows with quality disposition and release impact.

**Panels:** `SPCRelatedBatchesPanel`, `SPCSummaryPanel`

---

## Panels

| Panel ID | Component | Adapter method | Description |
|---|---|---|---|
| `spc-summary` | `SPCSummaryPanel` | `getSPCSummary()` | Plant-level KPIs: active signals, charts monitored, characteristics at risk, highest severity, recommended action |
| `active-spc-signals` | `ActiveSPCSignalsPanel` | `getActiveSPCSignals()` | Active rule violations: characteristic, rule name, severity (colour-coded), result value, batch, detectedAt, plant, recommended action |
| `control-chart` | `ControlChartPanel` | `getControlChartSeries(characteristicId)` | Time-series SVG chart with UCL/CL/LCL lines, spec limits, points coloured by status (in-control/warning/out-of-control); empty state for 0 points; insufficient-data warning for <3 samples |
| `characteristic-capability` | `CharacteristicCapabilityPanel` | `getCharacteristicCapability()` | Cp, Cpk, Pp, Ppk, sampleCount, mean, standardDeviation, interpretation (capable / marginal / incapable) |
| `spc-alarm-history` | `SPCAlarmHistoryPanel` | `getSPCAlarmHistory()` | Historical alarms: alarmId, timestamp, characteristic, rule, severity, status, acknowledgedBy/At, linked batch |
| `spc-related-batches` | `SPCRelatedBatchesPanel` | `getSPCRelatedBatches()` | Related batches: batchId, material, plant, relatedSignalCount, releaseImpact (blocking / risk / none), disposition status |

---

## Adapter Methods

All methods are on `SPCMonitoringAdapter` in `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts`. All currently return mock data.

| Method | Request fields used | Returns |
|---|---|---|
| `getSPCMonitoringContext` | plantId, workCentreId | `SPCMonitoringContext` |
| `getSPCSummary` | plantId, workCentreId | `SPCSummary` |
| `getActiveSPCSignals` | plantId, workCentreId | `SPCSignal[]` |
| `getMonitoredCharacteristics` | plantId, workCentreId, materialId | `MonitoredSPCCharacteristic[]` |
| `getControlChartSeries` | plantId, characteristicId | `ControlChartSeries` |
| `getCharacteristicCapability` | plantId, characteristicId | `CharacteristicCapability` |
| `getSPCAlarmHistory` | plantId, workCentreId, dateFrom, dateTo | `SPCAlarmHistoryItem[]` |
| `getSPCRelatedBatches` | plantId, workCentreId | `SPCRelatedBatch[]` |

---

## Data Contracts

All types are in `packages/data-contracts/src/schemas/spc-monitoring.ts` and exported from `@connectio/data-contracts`.

| Type | Description |
|---|---|
| `SPCMonitoringContext` | Workspace context: plant, material, batch, active scope, active view |
| `SPCSummary` | Plant-level KPI aggregate |
| `SPCSignal` | Active out-of-control or warning signal |
| `MonitoredSPCCharacteristic` | Discovered/configured characteristic with chartType, signal status, batch counts |
| `ControlChartSeries` | Full chart series: points, UCL/CL/LCL, USL/LSL, chartType, characteristic |
| `ControlChartPoint` | Individual sample point: timestamp, value, batchId, sampleId, signalIds, status |
| `CharacteristicCapability` | Cp/Cpk/Pp/Ppk + sample statistics + interpretation |
| `SPCAlarmHistoryItem` | Historical alarm record with acknowledgement |
| `SPCRelatedBatch` | Batch affected by an alarm window |
| `ChartType` | `'xbar-r' \| 'individuals' \| 'xbar-s' \| 'ewma' \| 'cusum' \| 'p' \| 'np' \| 'c' \| 'u'` |
| `Severity` | `'critical' \| 'high' \| 'medium' \| 'low'` |

---

## Characteristic Selection Architecture

The workspace is **data-driven** — there are no hardcoded characteristic IDs or names in views or panels. The flow is:

```
SPCMonitoringAdapterRequest (plantId, workCentreId)
  ↓
getMonitoredCharacteristics() → MonitoredSPCCharacteristic[]
  ↓
View maps over list → ControlChartPanel(characteristicId) per item
  ↓
getControlChartSeries(characteristicId) → ControlChartSeries
```

The mock data contains 5 characteristics (pH, Moisture %, Fat %, Salt %, Texture Score) as examples. These IDs are fixture data, not architecture.

---

## Control Chart Behaviour

| State | Condition | Rendering |
|---|---|---|
| Normal | `points.length >= 3` | SVG chart with UCL/CL/LCL; points coloured by status; legend |
| Insufficient data | `0 < points.length < 3` | Chart rendered with amber warning notice above |
| Empty | `points.length === 0` | "No measurement data found" status message; no SVG |

Point status colours:
- In-control: `#388E3C` (green)
- Warning: `#D97706` (amber)
- Out-of-control: `#D32F2F` (red)

---

## Mock Data Scope

The following are fixture values and will be replaced when V1 API is wired:

| Field | Mock value | Origin |
|---|---|---|
| plantId | `IE10` (Kerry Listowel) | Fixture |
| workCentreId | `WC-IE10-PASTEURISATION` | Fixture |
| materialId | `MAT-CH-EMMENTAL-BLOCK` | Fixture |
| batchId | `CH-240308-0047` | Fixture |
| Characteristics | pH, Moisture %, Fat %, Salt %, Texture Score | Fixture — not architecture |
| Control limits | Fixed values per characteristic | Fixture |
| Signal rule names | Western Electric / Nelson naming convention | Matching original SPC rule model |

---

## Active Signals Display

Each signal card in `ActiveSPCSignalsPanel` shows:
- Characteristic name (bold, left) + severity (upper-case label, right; colour-coded)
- Rule name (full Western Electric / Nelson rule text)
- Result value · Chart type · Batch ID
- Detected: [formatted date] · Plant: [plantId]
- Recommended action (italic, when present)

Left border colour per severity: critical → `#D32F2F`, high → `#F24A00`, medium → `#D97706`, low → `#388E3C`

---

## Parity Status (2026-05-16)

| Capability | Status |
|---|---|
| Characteristic selection (data-driven) | partially-preserved (mock) |
| Control chart (UCL/CL/LCL/USL/LSL) | partially-preserved (mock, SVG only) |
| Active SPC signals with rule detail | preserved (mock) |
| Alarm history with acknowledgement fields | preserved (mock; no acknowledge action) |
| Capability indices (Cp/Cpk/Pp/Ppk) | partially-preserved (no CI bounds) |
| Related batches with release impact | preserved (mock) |
| Empty / insufficient-data chart states | preserved |
| Locked limits | missing |
| Alarm acknowledgement action | missing |
| R sub-chart for xbar-r | degraded |
| MSA / Gauge R&R | out of scope |
| Correlation / Multivariate | out of scope |

See `docs/migration/spc-functional-parity-matrix.md` for full matrix.

---

## Known Limitations

1. No V1 API wired — all data is mock. No FastAPI proxy routes exist for SPC.
2. Chart renderer is custom SVG, not ECharts. Lacks zoom, crosshair, and interactive tooltip click of the original.
3. R sub-chart (range) is not rendered for xbar-r charts.
4. Alarm acknowledgement is display-only; no write endpoint available yet.
5. Confidence intervals for Cpk/Ppk are not in the current schema.
6. MSA, Correlation, and Multivariate tabs from the original SPC app are out of scope for the current pilot.
