# Production Staging Workspace

## Purpose

The **Production Staging** workspace is the Phase 4 warehouse domain workspace. It gives warehouse managers and logistics leads a single view of staging readiness for all process orders in today's production plan — covering pick task progress, zone capacity, material shortfalls, move requests, and picking wave status.

A warehouse manager starting their shift should think:

> "Which orders are staged and ready, which have shortfalls blocking them, and what pick work is still outstanding?" — not "Let me check the WMS for picks, then the shortfall report, then the zone capacity screen."

The workspace is owned by `di-warehouse` and consumes only warehouse-domain data (WMS). It does not require cross-domain data in Phase 4 — the Operations Plan Risk workspace provides the cross-domain view.

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | production-staging |
| displayName | Production Staging |
| domainId | warehouse |
| ownerDomain | warehouse |
| lifecycle | live |
| route | /warehouse/production-staging |
| telemetryId | warehouse.production-staging |

---

## Supported Roles

- warehouse-manager
- logistics-lead
- operations-supervisor
- plant-manager
- production-planner
- shift-lead

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `warehouse.staging.read` | View staging readiness, pick tasks, zone capacity, and shortfall data |
| `warehouse.staging.write` | Request moves, escalate shortfalls, and submit expedited staging requests |

---

## Supported Scopes

- `warehouse` (default) — monitors staging for a single warehouse location
- `plant` — aggregates across all warehouses for a plant

---

## Views

### 1. Staging Overview (`staging-overview`)

Default landing view. Shows overall readiness summary, order list, and active alerts — the complete picture at a glance.

**Panels:** Staging Readiness, Order List, Alerts

### 2. Order Staging (`order-staging`)

Per-order staging status with linked pick tasks for each order.

**Panels:** Order List, Pick Tasks

### 3. Shortfalls (`shortfalls`)

Open material shortfalls with procurement status, expected arrival, and affected orders.

**Panels:** Shortfalls, Alerts

### 4. Zone Capacity (`zone-capacity`)

Staging area utilisation with per-zone capacity percentages and overflow risk.

**Panels:** Zone Capacity, Order List

### 5. Picking Waves (`picking-waves`)

Wave progress — scheduled, in-progress, and completed waves with task completion rates.

**Panels:** Picking Waves, Pick Tasks

### 6. Move Requests (`move-requests`)

Internal move requests — pending, assigned, and in-transit with material and location detail.

**Panels:** Move Requests, Shortfalls

---

## Panels

| Panel ID | Owner Domain | Description |
|---|---|---|
| `staging-readiness-summary` | warehouse | KPI summary — fully staged, partial, not staged, blocked, percent ready |
| `staging-order-list` | warehouse | Per-order staging status with staged/required quantity and urgency |
| `staging-pick-tasks` | warehouse | Open and in-progress pick tasks with assignee, priority, and location |
| `staging-zone-capacity` | warehouse | Per-zone capacity utilisation with overflow risk flag |
| `staging-shortfalls` | warehouse | Material shortfalls with affected orders and procurement status |
| `staging-move-requests` | warehouse | Internal material move requests — status, location, and assignee |
| `staging-picking-waves` | warehouse | Picking wave progress — task completion, scheduled vs actual times |
| `staging-alerts` | warehouse | Active staging alerts — shortfalls, overdue picks, zone capacity, blocked orders |

---

## Action Flows

| Action | Trigger | Description |
|---|---|---|
| Request Internal Move | Request Internal Move button | Creates a move request for a material between storage locations |
| Escalate Shortfall | Escalate Shortfall button | Escalates an open shortfall to procurement and operations leads |
| Request Expedited Staging | Request Expedited Staging button | Submits an expedited staging request for a high-priority order |
| Notify Production | Notify Production button | Sends a staging status notification to the production supervisor |

---

## Drill-Through Targets

| Label | Target Workspace | Target View | Context |
|---|---|---|---|
| Open Operations Plan Risk | operations-plan-risk | material-staging-risk | plant |

---

## Data Source

**WMS** (Warehouse Management System) — `systemName: wms`. All data is mock in Phase 4.
