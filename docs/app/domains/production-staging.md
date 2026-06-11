# Production Staging Domain Reference

**Domain:** `warehouse`
**Workspace:** `production-staging`
**Owner:** `di-warehouse`
**Lifecycle:** `pilot`
**Route:** `/warehouse/production-staging`
**Date updated:** 2026-05-16

---

## Purpose

The Production Staging workspace gives warehouse operators, production planners, and shift managers a view of material readiness for production orders — staged stock, pick tasks, zone capacity, shortfalls, pick waves, and move requests.

The workspace maps to the staging portion of the original WH360 application, which tracked whether materials for each production order had been staged at the correct line-side location in time for the scheduled start.

---

## Supported Roles

| Role | Primary use |
|------|-------------|
| `warehouse-operator` | Execute pick tasks; confirm staging; resolve shortfalls |
| `production-planner` | Verify staging readiness before order release |
| `shift-manager` | Staging overview; blocked order triage |
| `logistics-coordinator` | Move request coordination; zone capacity monitoring |

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `warehouse.staging.read` | View production staging status, pick tasks, shortfalls, and zone capacity |

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | `production-staging` |
| displayName | Production Staging |
| domainId | `warehouse` |
| ownerDomain | `warehouse` |
| lifecycle | `pilot` |
| route | `/warehouse/production-staging` |
| telemetryId | `warehouse.production-staging` |

---

## Views

### 1. Staging Overview (`staging-overview`)

Default landing view. Shows staging readiness summary KPIs and active alerts.

**Panels:** `StagingReadinessSummaryPanel`, `StagingAlertsPanel`

---

### 2. Order Staging (`order-staging`)

Per-order staging status list and associated pick task queue.

**Panels:** `StagingOrderListPanel`, `StagingPickTasksPanel`

---

### 3. Shortfalls (`shortfalls`)

Materials that cannot be fully staged due to insufficient available stock.

**Panels:** `StagingShortfallsPanel`

---

### 4. Zone Capacity (`zone-capacity`)

Staging zone fill levels, active order count, and available lane counts.

**Panels:** `StagingZoneCapacityPanel`

---

### 5. Picking Waves (`picking-waves`)

Batched pick wave status: total tasks, completed, in-progress, pending.

**Panels:** `StagingPickingWavesPanel`

---

### 6. Move Requests (`move-requests`)

Inter-zone and zone-to-staging material move requests with status.

**Panels:** `StagingMoveRequestsPanel`

---

## Panels

| Panel ID | Component | Adapter method | Description |
|---|---|---|---|
| `staging-readiness-summary` | `StagingReadinessSummaryPanel` | `getStagingReadinessSummary()` | totalOrders, staged, partial, blocked, readinessPercent |
| `staging-order-list` | `StagingOrderListPanel` | `getStagingOrderSummaries()` | Per-order: orderId, material, stagingStatus, stagingZone, pickCompletion |
| `staging-pick-tasks` | `StagingPickTasksPanel` | `getStagingPickTasks()` | Per-task: taskId, orderId, material, qty, fromLocation, toLocation, priority, status |
| `staging-zone-capacity` | `StagingZoneCapacityPanel` | `getStagingZoneCapacity()` | Zone fill level, active orders, available lanes, zoneType |
| `staging-shortfalls` | `StagingShortfallsPanel` | `getStagingShortfalls()` | shortfallId, material, orderId, requiredQty, availableQty, gapQty, urgency |
| `staging-move-requests` | `StagingMoveRequestsPanel` | `getStagingMoveRequests()` | moveRequestId, material, fromLocation, toLocation, qty, requestedBy, status |
| `staging-picking-waves` | `StagingPickingWavesPanel` | `getStagingPickingWaves()` | waveId, totalTasks, completedTasks, inProgressTasks, pendingTasks, plannedStartAt |
| `staging-alerts` | `StagingAlertsPanel` | `getStagingAlerts()` | alertType, severity, message, relatedEntityId, detectedAt |

---

## Adapter Methods

All methods are on `ProductionStagingAdapter` in `domain-integrations/warehouse/src/adapters/production-staging-adapter.ts`. All currently return mock data. No legacy-api overrides exist yet.

| Method | Request fields used | Returns |
|---|---|---|
| `getProductionStagingContext` | plantId, warehouseId, planDate | `ProductionStagingContext` |
| `getStagingReadinessSummary` | plantId, warehouseId, planDate | `StagingReadinessSummary` |
| `getStagingOrderSummaries` | plantId, warehouseId, planDate | `StagingOrderSummary[]` |
| `getStagingPickTasks` | plantId, warehouseId, planDate | `StagingPickTask[]` |
| `getStagingZoneCapacity` | plantId, warehouseId | `StagingZoneCapacity[]` |
| `getStagingShortfalls` | plantId, warehouseId, planDate | `StagingShortfall[]` |
| `getStagingMoveRequests` | plantId, warehouseId | `StagingMoveRequest[]` |
| `getStagingPickingWaves` | plantId, warehouseId, planDate | `StagingPickingWave[]` |
| `getStagingAlerts` | plantId, warehouseId | `StagingAlert[]` |

---

## Staging Order Status Values

| Status | Description |
|---|---|
| `staged` | All required materials confirmed at staging location |
| `partial` | Some materials staged; pick tasks remain open |
| `blocked` | Cannot be staged — shortfall, hold, or zone capacity issue |
| `pending` | Order not yet started; pick tasks not created |

---

## Staging Alert Types

| alertType | Severity range | Trigger |
|---|---|---|
| `blocked-order` | critical/high | Production order cannot be staged |
| `overdue-pick` | high/medium | Pick task past planned completion time |
| `zone-capacity` | high/medium | Staging zone above capacity threshold |
| `shortfall` | high/medium | Material insufficient for order requirement |
| `missing-batch` | critical | Required batch not found in WMS |

---

## Mock Data Scope

| Field | Mock value | Origin |
|---|---|---|
| plantId | `IE10` (Kerry Listowel) | Fixture |
| warehouseId | `WH-IE10-01` | Fixture |
| planDate | `2026-05-14` | Fixture |
| totalOrders | 18 | Fixture |
| staged | 12 | Fixture |
| partial | 3 | Fixture |
| blocked | 1 | Fixture |

---

## Parity Status (2026-05-16)

| Capability | Status |
|---|---|
| Staging readiness summary | preserved (mock) |
| Order staging list | preserved (mock) |
| Pick task queue | preserved (mock) |
| Zone capacity | preserved (mock) |
| Shortfalls | preserved (mock) |
| Move requests | preserved (mock) |
| Picking waves | preserved (mock) |
| Staging alerts | preserved (mock) |

All staging capabilities are implemented at mock tier. V1 staging data source is `staging_orders_v` and `staging_pick_tasks_v` in the WH360 gold view layer. No FastAPI proxy routes exist for staging endpoints yet.

---

## Known Limitations

1. All data is mock. Production order IDs and materials are Kerry Listowel fixtures.
2. No V1 staging endpoint proxy routes exist.
3. `planDate` filter not yet wired — all staging data is returned regardless of date.
4. Staging alerts are entirely mock — no rule engine or threshold evaluation.
