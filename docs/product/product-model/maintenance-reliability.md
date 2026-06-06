# Maintenance & Reliability Workspace

## Purpose

The **Maintenance & Reliability** workspace is a Phase 5 addition to the maintenance domain. It gives maintenance managers, reliability engineers, plant managers, and maintenance technicians a single view of open work orders, preventive maintenance schedule, equipment availability, reliability metrics, and maintenance backlog.

A maintenance manager should think:

> "What is my open work order position, what PM tasks are overdue, which equipment is at risk, and what is sitting in my backlog?" — not "Check SAP PM for work orders, then the PM schedule spreadsheet, then the reliability report."

The workspace is owned by `di-maintenance` within the `maintenance` domain. In Phase 5 it connects to mock data representing Kerry Listowel (IE10).

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | maintenance-reliability |
| displayName | Maintenance & Reliability |
| domainId | maintenance |
| ownerDomain | maintenance |
| lifecycle | pilot |
| route | /maintenance/reliability |
| telemetryId | maintenance.reliability |

---

## Supported Roles

- maintenance-manager
- plant-manager
- operations-supervisor
- reliability-engineer
- maintenance-technician

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `maintenance.overview.read` | View work orders, PM schedule, equipment availability, and reliability metrics |

---

## Supported Scopes

- `plant` (default)
- `line` — filters to equipment on a specific production line

---

## Views

### 1. Overview (`overview`)

Default landing view. Shows maintenance KPI summary tiles, open work orders, and equipment availability.

**Panels:** Maintenance KPI Summary, Open Work Orders, Equipment Availability

### 2. Work Orders (`work-orders`)

Full open work order list with backlog context.

**Panels:** Open Work Orders, Maintenance Backlog

### 3. PM Schedule (`preventive-maintenance`)

Upcoming, due, and overdue preventive maintenance tasks with linked work order status.

**Panels:** Preventive Maintenance Schedule, Maintenance KPI Summary

### 4. Equipment Availability (`equipment-availability`)

Per-equipment availability vs. target with downtime breakdown and MTBF/MTTR metrics.

**Panels:** Equipment Availability, Reliability Metrics

### 5. Backlog (`backlog`)

Deferred maintenance backlog with priority, production impact, and target completion dates.

**Panels:** Maintenance Backlog, Open Work Orders

---

## Panels

| Panel ID | Owner Domain | Description |
|---|---|---|
| `maintenance-kpi-summary` | maintenance | KPI tiles — open WOs, overdue WOs, critical WOs, completed this shift, equipment availability vs. target |
| `open-work-orders` | maintenance | Work order table with priority badge, status, equipment, production impact, and estimated hours |
| `preventive-maintenance-schedule` | maintenance | PM tasks grouped by status (overdue/due-today/upcoming) with frequency and linked WO |
| `equipment-availability` | maintenance | Per-equipment availability bars with target line, current status badge, and open WO count |
| `reliability-metrics` | maintenance | MTBF, MTTR, failure count, OEE impact, and trend direction per equipment |
| `maintenance-backlog` | maintenance | Deferred items with priority, production impact, deferred reason, and target completion |

---

## Action Flows

| Action | Trigger | Description |
|---|---|---|
| Raise Maintenance Request | Raise Maintenance Request button | Creates a maintenance request with equipment ID, title, priority, description, and requester |
| Open Operations Plan Risk | Link action | Navigates to Operations Plan Risk workspace to assess production impact of maintenance constraints |

---

## Drill-Through Targets

| Label | Target Workspace | Target View | Context |
|---|---|---|---|
| Open Operations Plan Risk | operations-plan-risk | plan-overview | plant |

---

## Data Source

**CMMS / SAP PM** (mock data in Phase 5) — `systemName: cmms`. Represents maintenance and equipment reliability data for Kerry Listowel IE10.
