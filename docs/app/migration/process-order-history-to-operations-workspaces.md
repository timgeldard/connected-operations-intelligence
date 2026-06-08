# Migration: Process Order History → Operations Workspaces

## Overview

In ConnectIO-RAD V1 and Phase 0 of V2, operations data was accessed through a monolithic "Operations Workspace" stub and a legacy "Process Order History" screen. Phase 3 replaces these with purpose-built workspaces that compose evidence across domains.

This guide explains what changed, what was removed, and how to update integrations that reference the old patterns.

---

## What Changed

### Phase 0 → Phase 3 Operations

| Before (Phase 0) | After (Phase 3) |
|---|---|
| `operations-workspace` (concept-lab stub) | `operations-plan-risk` (live workspace) |
| Monolithic Operations adapter | `OperationsPlanRiskAdapter` (9 focused methods) |
| No cross-domain evidence | Evidence from warehouse, quality, and maintenance in every view |
| Single placeholder view | 7 purpose-built views for different supervisor workflows |
| No action flows | 6 action flows (escalate, staging request, quality review, handover, batch release) |

### Adapter changes

**Old pattern (Phase 0 / Phase 2 side effect):**

```typescript
// OperationsEvidenceAdapter — designed to serve the Quality Batch Release workspace
const adapter = new OperationsEvidenceAdapter()
const result = await adapter.getProcessOrderEvidence({ processOrderId, batchId })
```

This adapter remains in place for the Quality Batch Release workspace and is **not removed**.

**New pattern (Phase 3):**

```typescript
// OperationsPlanRiskAdapter — designed to serve the Operations Plan Risk workspace
const adapter = new OperationsPlanRiskAdapter()
const result = await adapter.getOperationsPlanRiskContext({ plantId, planDate })
```

The two adapters coexist. The `OperationsEvidenceAdapter` serves batch-scoped evidence for quality review. The `OperationsPlanRiskAdapter` serves plan-scoped evidence for shift supervision.

---

## URL Migration

### Old: No operations workspace URL

Phase 0 had no navigable operations workspace. The URL `?workspace=operations-workspace` rendered a placeholder.

### New: Operations Plan Risk workspace URL

```
?workspace=operations-plan-risk&view=plan-overview&planDate=2024-03-08
```

To navigate programmatically from shell code:

```typescript
const { navigateToOperationsPlanRisk } = useWorkspaceShellState()

// Open with default date and view
navigateToOperationsPlanRisk()

// Open with a specific plan date
navigateToOperationsPlanRisk('2024-03-08', 'critical-blockers')
```

---

## Package exports

All new symbols are exported from `@connectio/di-operations`:

```typescript
// Registration
import { operationsPlanRiskRegistration } from '@connectio/di-operations'

// Workspace component
import { OperationsPlanRiskWorkspace } from '@connectio/di-operations'

// Adapter and queries
import {
  OperationsPlanRiskAdapter,
  operationsPlanRiskAdapter,
  useOperationsPlanRiskContext,
  usePlanRiskSummary,
  useLateOrders,
  useMaterialShortages,
  useLineStatus,
  useScheduleAdherenceSummary,
  useYieldVarianceSummary,
  useShiftHandoverItems,
  useOperationsActionQueue,
} from '@connectio/di-operations'

// Views
import { PlanOverviewView, CriticalBlockersView, MaterialStagingRiskView } from '@connectio/di-operations'

// Actions panel
import { OperationsPlanRiskActionsPanel } from '@connectio/di-operations'
```

---

## Cross-domain panel migration

Phase 3 introduces panels owned by warehouse, quality, and maintenance that are consumed by the Operations Plan Risk workspace. These panels are exported from their owning packages, not from di-operations:

```typescript
// Warehouse panel (owned by di-warehouse)
import { WarehouseStagingStatusPanel } from '@connectio/di-warehouse'

// Quality panels (owned by di-quality)
import { QualityBlockersPanel, ReleaseHoldImpactPanel } from '@connectio/di-quality'

// Maintenance panel (owned by di-maintenance)
import { MaintenanceConstraintPanel } from '@connectio/di-maintenance'
```

The Operations Plan Risk views import these directly. If you are building a custom shell that composes views manually, follow the same import pattern.

---

## Maintenance package upgrade

`@connectio/di-maintenance` was a Phase 0 stub (no panels, no adapters). Phase 3 upgraded it to a full domain integration with:

- `MaintenanceConstraintsAdapter` — queries maintenance constraints by plant and date
- `MaintenanceConstraintPanel` — renders active and scheduled constraints
- `useMaintenanceConstraints` — TanStack Query hook

If your code imported from `@connectio/di-maintenance` and expected only `maintenanceWorkspaceRegistration`, the new exports are additive and will not break existing imports.

---

## Governance

All three new `live` workspace registrations (`operations-plan-risk` was added in Phase 3) are visible in the governance UI at `?workspace=admin-governance`. The governance page shows lifecycle, panel counts, view counts, roles, permissions, and drill-through targets for every registered workspace.
