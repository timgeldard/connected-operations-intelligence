# Environmental Monitoring Workspace

## Purpose

The **Environmental Monitoring** workspace is the Phase 4 flagship feature for the quality and food-safety domain. It gives environmental monitoring coordinators and quality leads a single view of zone status, active microbial alerts, swab results, corrective action progress, and compliance trends across a plant or region.

An environmental monitoring coordinator should think:

> "Where are my hot zones today, what actions are open, and are my compliance trends moving in the right direction?" — not "Let me check LIMS for swab results, then the action tracker, then the zone report."

The workspace is fully owned by `di-envmon` with no cross-domain panel consumption in Phase 4. It connects to LIMS (mock data in Phase 4).

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | envmon-monitoring |
| displayName | Environmental Monitoring |
| domainId | envmon |
| ownerDomain | envmon |
| lifecycle | live |
| route | /envmon/monitoring |
| telemetryId | envmon.monitoring |

---

## Supported Roles

- envmon-coordinator
- quality-lead
- site-manager
- plant-manager
- operations-supervisor

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `envmon.monitoring.read` | View zone status, alerts, swab results, and corrective actions |
| `envmon.actions.write` | Raise alerts, create corrective actions, and request retests |

---

## Supported Scopes

- `plant` (default) — monitors all zones within a single plant
- `region` — aggregates across all plants in a region

---

## Views

### 1. Overview (`scope-overview`)

Default landing view. Shows site KPI summary, active alerts, and zone heatmap — the complete picture at a glance.

**Panels:** Site Environmental Summary, Alerts, Zone Heatmap

### 2. Plant Monitoring (`plant-monitoring`)

Zone-by-zone status for the plant with alert detail.

**Panels:** Site Environmental Summary, Zone Status, Alerts

### 3. Zone Heatmap (`heatmap`)

Spatial risk view — heatmap cells coloured by risk score alongside zone status table.

**Panels:** Zone Heatmap, Zone Status

### 4. Alerts (`alerts`)

Active alert list with linked corrective actions for each alert.

**Panels:** Alerts, Corrective Actions

### 5. Swab Vectors (`swab-vectors`)

Scheduled swab vector routes and recent swab result detail.

**Panels:** Swab Vectors, Swab Results

### 6. Trends (`trends`)

Positive rate, compliance rate, and alert volume trends over the monitoring period.

**Panels:** Trends, Site Environmental Summary

### 7. Corrective Actions (`corrective-actions`)

All open and overdue corrective actions with linked alerts.

**Panels:** Corrective Actions, Alerts

---

## Panels

| Panel ID | Owner Domain | Description |
|---|---|---|
| `envmon-site-summary` | envmon | Plant-level KPIs — compliance rate, positive rate, open alerts, corrective actions |
| `envmon-zone-status` | envmon | Per-zone hygiene classification, status, consecutive positives, open alerts |
| `envmon-alerts` | envmon | Active microbial alerts with severity, organism, detection date, and status |
| `envmon-heatmap` | envmon | Spatial risk heatmap — cells coloured by risk score (green/amber/orange/red) |
| `envmon-swab-results` | envmon | Individual swab test results with CFU counts and limits |
| `envmon-trends` | envmon | Weekly time-series of positive rate, compliance rate, and alert volume |
| `envmon-corrective-actions` | envmon | Corrective action tracker — assignee, due date, recurrence status |
| `envmon-swab-vectors` | envmon | Scheduled swab vector routes — frequency, point count, assigned team |

---

## Action Flows

| Action | Trigger | Description |
|---|---|---|
| Raise Environmental Alert | Raise Environmental Alert button | Records a new environmental alert with zone, organism, severity, and description |
| Create Corrective Action | Create Corrective Action button | Creates a corrective action with type, assignee, due date, and recurrence flag |
| Request Zone Retest | Request Zone Retest button | Submits an urgent retest request for a specific zone |
| Notify QA Lead | Notify QA Lead button | Sends a QA lead notification with risk status context |

---

## Drill-Through Targets

| Label | Target Workspace | Target View | Context |
|---|---|---|---|
| Open Quality Batch Release | quality-batch-release | batch-decision | batch, plant |
| Open Trace Investigation | trace-investigation | overview | batch, plant |

---

## Data Source

**LIMS** (Laboratory Information Management System) — `systemName: lims`. All data is mock in Phase 4.
