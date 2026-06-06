# Operations Plan Risk Workspace

## Purpose

The **Operations Plan Risk** workspace is the Phase 3 flagship feature of ConnectIO-RAD V2, proving the cross-domain cockpit composition model at plant level. It gives an operations supervisor a single view of everything that could prevent the day's production plan from completing on time.

An operations supervisor starting their shift should think:

> "What's at risk today and what do I need to action before it becomes a problem?" — not "Let me check the MES, then the WMS, then the QMS, then the CMMS."

The workspace aggregates live evidence from four domain integrations:

| Domain Integration | Evidence Provided |
|---|---|
| `@connectio/di-operations` | Plan risk summary, late orders, material shortages, line status, schedule adherence, yield variance, shift handover, action queue |
| `@connectio/di-warehouse` | Staging status for all process orders in the plan |
| `@connectio/di-quality` | Quality blockers, release hold impacts affecting production |
| `@connectio/di-maintenance` | Active and scheduled maintenance constraints by line |

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | operations-plan-risk |
| displayName | Operations Plan Risk |
| domainId | operations |
| ownerDomain | operations |
| lifecycle | live |
| route | /operations/plan-risk |
| telemetryId | operations.plan-risk |

---

## Supported Roles

- operations-supervisor
- production-planner
- plant-manager
- shift-lead
- logistics-lead
- quality-lead

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `operations.plan.read` | View plan risk summaries, line status, and schedule adherence data |
| `operations.actions.write` | Submit escalations, staging requests, and handover notes |

---

## Views

### 1. Plan Overview (`plan-overview`)

The default landing view. Shows the complete picture of today's plan risk.

**Panels:** Plan Risk Summary, Late Orders, Material Shortage, Quality Blockers, Warehouse Staging Status, Line Status, Operations Action Queue

### 2. Critical Blockers (`critical-blockers`)

Focused view on the highest-severity cross-domain blockers that could halt production.

**Panels:** Plan Risk Summary, Quality Blockers, Release Hold Impact, Material Shortage, Maintenance Constraint, Operations Action Queue

### 3. Material & Staging (`material-staging-risk`)

Logistics risk view for supervisors coordinating with warehouse on staging readiness.

**Panels:** Material Shortage, Warehouse Staging Status, Late Orders, Operations Action Queue

### 4. Quality Blockers (`quality-release-blockers`)

Quality-owned risk view for orders blocked by release holds or SPC alarms.

**Panels:** Quality Blockers, Release Hold Impact, Operations Action Queue

### 5. Line & Resources (`line-resource-risk`)

Line health view covering active constraints, OEE, yield variance, and schedule adherence.

**Panels:** Line Status, Maintenance Constraint, Yield Variance, Schedule Adherence, Late Orders

### 6. Schedule Adherence (`schedule-adherence`)

Throughput and adherence view for production planners.

**Panels:** Schedule Adherence, Late Orders, Yield Variance, Material Shortage, Quality Blockers

### 7. Handover & Actions (`handover-actions`)

Shift handover view. Surfaces open items that must be passed to the next shift.

**Panels:** Shift Handover, Operations Action Queue, Quality Blockers, Maintenance Constraint

---

## Evidence Panels

### Operations-owned panels

| Panel ID | Display Name | Description |
|---|---|---|
| `plan-risk-summary` | Plan Risk Summary | Aggregate risk score, metric tiles, top risk reason, recommended action |
| `late-orders` | Late Orders | Process orders behind schedule, sorted by severity then delay |
| `material-shortage` | Material Shortage | Materials with insufficient staging or open procurement issues |
| `line-status` | Line Status | OEE and operational status for each production line |
| `schedule-adherence` | Schedule Adherence | Overall schedule adherence % with progress bar |
| `yield-variance` | Yield Variance | Planned vs actual yield with variance indicators |
| `shift-handover` | Shift Handover | Open items requiring handover to next shift |
| `operations-action-queue` | Operations Action Queue | Actionable items assigned to operations with priority sorting |

### Cross-domain panels (consumed from other domain integrations)

| Panel ID | Owner | Display Name |
|---|---|---|
| `warehouse-staging-status` | `@connectio/di-warehouse` | Warehouse Staging Status |
| `quality-blockers` | `@connectio/di-quality` | Quality Blockers |
| `release-hold-impact` | `@connectio/di-quality` | Release Hold Impact |
| `maintenance-constraint` | `@connectio/di-maintenance` | Maintenance Constraint |

---

## Action Flows

Six action flows are available from the right-hand action sidebar:

| Action | Description |
|---|---|
| Escalate Blocker | Escalate a blocker to shift manager or plant manager |
| Request Staging | Submit a warehouse staging request for a specific process order |
| Request Quality Review | Request expedited quality review for a held batch |
| Create Handover Note | Record a handover note for the next shift |
| Open Process Order Review | Governed placeholder — Process Order Review workspace (Phase 4+) |
| Open Batch Release | Drill through to Quality Batch Release workspace for a specific batch |

---

## Adapter Architecture

### OperationsPlanRiskAdapter

Owned by `@connectio/di-operations`. Implements 9 methods:

- `getOperationsPlanRiskContext(request)` — summary context for the entire workspace
- `getPlanRiskSummary(request)` — aggregate risk score and metrics
- `getLateOrders(request)` — list of process orders behind schedule
- `getMaterialShortages(request)` — list of materials with supply risk
- `getLineStatus(request)` — status and OEE for each production line
- `getScheduleAdherenceSummary(request)` — overall schedule adherence
- `getYieldVarianceSummary(request)` — yield variance by material
- `getShiftHandoverItems(request)` — open handover items
- `getOperationsActionQueue(request)` — pending operations actions

### WarehouseStagingAdapter

Owned by `@connectio/di-warehouse`. Exposes:

- `getWarehouseStagingStatus(request)` — staging status per process order

### QualityBlockersAdapter

Owned by `@connectio/di-quality`. Exposes:

- `getQualityBlockersForPlan(request)` — quality holds affecting the plan
- `getReleaseHoldImpacts(request)` — operational impact of active holds

### MaintenanceConstraintsAdapter

Owned by `@connectio/di-maintenance`. Exposes:

- `getMaintenanceConstraintsForPlan(request)` — active and scheduled maintenance by line

---

## URL Routing

The workspace uses query-parameter routing with no router library:

```
?workspace=operations-plan-risk&view=plan-overview&planDate=2024-03-08
```

| Param | Purpose |
|---|---|
| `workspace` | Selects the workspace (must be `operations-plan-risk`) |
| `view` | Selects the active view tab |
| `planDate` | ISO 8601 date (YYYY-MM-DD) for the plan being reviewed |

The `navigateToOperationsPlanRisk(planDate?, viewId?)` action in `useWorkspaceShellState` sets all three atomically.

---

## Drill-through

From within Operations Plan Risk, users can drill through to:

- **Quality Batch Release** (`quality-batch-release` / `batch-decision` view) — when quality review is needed for a specific batch
- **Trace Investigation** (`trace-investigation` / `overview` view) — when traceability evidence is needed

The `onNavigateToBatchRelease` prop on `OperationsPlanRiskWorkspace` is wired to the shell's `navigateToBatchRelease` action.
