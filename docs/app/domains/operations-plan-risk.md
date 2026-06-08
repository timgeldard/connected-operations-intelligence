# Operations Plan Risk Domain Reference

**Domain:** `operations`
**Workspace:** `operations-plan-risk`
**Owner:** `di-operations`
**Lifecycle:** `pilot`
**Route:** `/operations/operations-plan-risk`
**Date updated:** 2026-05-16

---

## Purpose

The Operations Plan Risk workspace gives production planners, shift managers, and operations supervisors a daily plan-level view of risk across all production orders — late orders, material shortages, line status, schedule adherence, yield variance, shift handover items, and an action queue.

The workspace covers the planning and analytics capabilities from the original POH application — the planning board, day view, and analytics surfaces — repositioned as a risk-oriented daily operations view rather than a per-order drill-down.

---

## Supported Roles

| Role | Primary use |
|------|-------------|
| `production-manager` | Daily plan risk triage; blocked order escalation |
| `shift-manager` | Shift handover; open action queue |
| `operations-supervisor` | Line status; schedule adherence monitoring |
| `production-planner` | Late order review; material shortage response |
| `logistics-coordinator` | Material staging risk; shortage prioritisation |

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `operations.plan.read` | View plan risk summary, late orders, material shortages, line status, schedule adherence, and shift handover items |

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | `operations-plan-risk` |
| displayName | Operations Plan Risk |
| domainId | `operations` |
| ownerDomain | `operations` |
| lifecycle | `pilot` |
| route | `/operations/operations-plan-risk` |
| telemetryId | `operations.operations-plan-risk` |

---

## Views

### 1. Plan Overview (`plan-overview`)

Default landing view. Plan risk summary KPIs and line status grid.

**Panels:** `PlanRiskSummaryPanel`, `LineStatusPanel`

---

### 2. Critical Blockers (`critical-blockers`)

Late orders and material shortages requiring immediate attention.

**Panels:** `LateOrdersPanel`, `MaterialShortagePanel`

---

### 3. Material Staging Risk (`material-staging-risk`)

Material shortages and staging risk by line and order.

**Panels:** `MaterialShortagePanel`

---

### 4. Quality Release Blockers (`quality-release-blockers`)

Orders blocked at quality release with blocker details.

**Panels:** (Quality release blocker panels)

---

### 5. Line / Resource Risk (`line-resource-risk`)

Line utilisation, capacity constraints, and maintenance-related risk.

**Panels:** `LineStatusPanel`

---

### 6. Schedule Adherence (`schedule-adherence`)

On-time start/finish rates by line and order type.

**Panels:** `ScheduleAdherencePanel`

---

### 7. Handover & Actions (`handover-actions`)

Shift handover items and the daily operations action queue.

**Panels:** `ShiftHandoverPanel`, `OperationsActionQueuePanel`

---

## Panels

| Panel ID | Component | Adapter method | Description |
|---|---|---|---|
| `plan-risk-summary` | `PlanRiskSummaryPanel` | `getPlanRiskSummary()` | highestSeverity, lateOrderCount, shortageCount, blockedOrderCount, recommendedAction |
| `late-orders` | `LateOrdersPanel` | `getLateOrders()` | Per-order: orderId, material, line, delayMinutes, riskLevel, reason |
| `material-shortage` | `MaterialShortagePanel` | `getMaterialShortages()` | shortageId, material, affected orders, shortfall qty, urgency |
| `line-status` | `LineStatusPanel` | `getLineStatuses()` | lineId, status (running/idle/down/maintenance), current order, OEE, utilisation% |
| `schedule-adherence` | `ScheduleAdherencePanel` | `getScheduleAdherence()` | adherencePercent, lateStartCount, earlyFinishCount, avgDelayMinutes, trendDirection |
| `yield-variance` | `YieldVariancePanel` | `getYieldVariances()` | materialId, plannedYield, actualYield, variancePercent, trend |
| `shift-handover` | `ShiftHandoverPanel` | `getShiftHandover()` | handoverItems: category, title, priority, ownerId, dueAt, status |
| `operations-action-queue` | `OperationsActionQueuePanel` | `getOperationsActionQueue()` | actionItems: type, orderId, material, requiredBy, assignedTo, status |

---

## Adapter Methods

All methods are on `OperationsPlanRiskAdapter` in `domain-integrations/operations/src/adapters/operations-plan-risk-adapter.ts`. All methods currently return mock data. No legacy-api overrides exist.

| Method | Request fields used | Returns |
|---|---|---|
| `getOperationsPlanRiskContext` | plantId, planDate | `OperationsPlanRiskContext` |
| `getPlanRiskSummary` | plantId, planDate | `PlanRiskSummary` |
| `getLateOrders` | plantId, planDate | `LateOrder[]` |
| `getMaterialShortages` | plantId, planDate | `MaterialShortage[]` |
| `getLineStatuses` | plantId | `LineStatus[]` |
| `getScheduleAdherence` | plantId, planDate | `ScheduleAdherenceSummary` |
| `getYieldVariances` | plantId, planDate | `YieldVarianceSummary[]` |
| `getShiftHandover` | plantId, planDate | `ShiftHandoverItem[]` |
| `getOperationsActionQueue` | plantId, planDate | `OperationsActionQueueItem[]` |

---

## Risk Severity Values

| Severity | Meaning |
|---|---|
| `low` | Within tolerance; no action required |
| `medium` | Approaching threshold; monitor |
| `high` | Threshold exceeded; intervention recommended |
| `critical` | Immediate action required; escalate |

## Line Status Values

| status | Description |
|---|---|
| `running` | Line producing at planned rate |
| `idle` | No active order; within planned gap |
| `down` | Unplanned stoppage |
| `maintenance` | Planned or corrective maintenance in progress |

---

## Mock Data Scope

| Field | Mock value | Origin |
|---|---|---|
| plantId | `IE10` (Kerry Listowel) | Fixture |
| planDate | `2024-03-08` | Fixture |
| highestSeverity | `high` | Fixture |
| lateOrderCount | 3 | Fixture |
| shortageCount | 2 | Fixture |

---

## Parity Status (2026-05-16)

| Capability | Status |
|---|---|
| Plan risk summary | preserved (mock) |
| Late orders list | preserved (mock) |
| Material shortages | preserved (mock) |
| Line status | preserved (mock) |
| Schedule adherence | preserved (mock) |
| Yield variance | preserved (mock) |
| Shift handover | preserved (mock) |
| Operations action queue | preserved (mock) |

All Operations Plan Risk capabilities are implemented at mock tier. No V1 API proxy routes exist for OPR endpoints. V1 analytics data sources are in `csm_process_order_history` gold views.

---

## Known Limitations

1. All data is mock. Values are Kerry Listowel fixtures.
2. No V1 API proxy routes exist for OPR endpoints.
3. No `planDate` filter wired — all data is returned regardless of date.
4. No real-time line status — data is derived from batch polling, not live events.
5. `OperationsActionQueuePanel` has no write capability — actions cannot be marked complete through V2.
