# SPC Monitoring Workspace

## Purpose

The **SPC Monitoring** workspace is a Phase 5 addition to the quality domain. It gives process engineers, quality technicians, and quality leads a real-time view of statistical process control signals, control chart series, process capability indices, and alarm history across a plant or production line.

A process engineer should think:

> "Which parameters are out of statistical control right now, why did the alarm fire, and what is the capability trend?" — not "Let me pull the chart from the historian, check the spec in the ERP, then look up the batch log."

The workspace is owned by `di-spc` and sits within the `spc` domain. In Phase 5 it connects to mock data representing Kerry Listowel (IE10) process parameters.

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | spc-monitoring |
| displayName | SPC Monitoring |
| domainId | spc |
| ownerDomain | spc |
| lifecycle | pilot |
| route | /spc/monitoring |
| telemetryId | spc.monitoring |

---

## Supported Roles

- process-engineer
- quality-technician
- quality-lead
- plant-manager
- operations-supervisor

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `spc.monitoring.read` | View control charts, SPC signals, capability indices, and alarm history |

---

## Supported Scopes

- `plant` (default) — monitors all lines and characteristics within a plant
- `line` — filters to a single production line

---

## Views

### 1. Chart Overview (`chart-overview`)

Default landing view. Shows SPC summary KPIs, active signals list, and capability index tiles for all monitored characteristics.

**Panels:** SPC Summary, Active SPC Signals, Characteristic Capability

### 2. Control Charts (`control-charts`)

Individual control chart series with control limits, Western Electric rules, and point annotations.

**Panels:** Control Chart Series, Active SPC Signals

### 3. Capability Analysis (`capability-analysis`)

Cpk / Ppk breakdown for all characteristics with trend direction indicators.

**Panels:** Characteristic Capability, SPC Summary

### 4. Alarm History (`alarm-history`)

Historical alarm events with acknowledgement status, rule violated, and linked batch context.

**Panels:** SPC Alarm History, Active SPC Signals

### 5. Related Batches (`related-batches`)

Batches produced during active signal periods with quality disposition status.

**Panels:** Related Batches, SPC Summary

---

## Panels

| Panel ID | Owner Domain | Description |
|---|---|---|
| `spc-summary` | spc | Plant-level KPIs — active signals, characteristics in control, batches affected, confidence |
| `active-spc-signals` | spc | Active rule violations with characteristic, line, rule name, severity, and detection time |
| `control-chart-series` | spc | Time-series control chart with UCL/LCL/mean lines, point values, and violation highlights |
| `characteristic-capability` | spc | Cpk/Ppk indices per characteristic with target, trend arrow, and period summary |
| `spc-alarm-history` | spc | Historical alarms with rule violated, acknowledgement status, and linked batch |
| `spc-related-batches` | spc | Batches produced during alarm periods with disposition and process order link |

---

## Action Flows

| Action | Trigger | Description |
|---|---|---|
| Acknowledge Signal | Acknowledge Signal button | Records acknowledgement of an active SPC signal with optional comment |
| Request Batch Review | Request Batch Review button | Initiates a quality review for batches produced during an active signal period |
| Open Quality Batch Release | Link action | Navigates to Quality Batch Release workspace for the affected batch |

---

## Drill-Through Targets

| Label | Target Workspace | Target View | Context |
|---|---|---|---|
| Open Quality Batch Release | quality-batch-release | batch-decision | batch, plant |

---

## Data Source

**Historian / SPC Engine** (mock data in Phase 5) — `systemName: spc-engine`. Represents in-process control data for Kerry Listowel IE10.
