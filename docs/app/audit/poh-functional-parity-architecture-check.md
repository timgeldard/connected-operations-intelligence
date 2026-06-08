# POH Functional Parity Architecture Check

**Date:** 2026-05-16
**Domain:** `di-operations` / `process-order-review`
**Reviewer:** POH parity tranche (g.txt)
**Reference:** `docs/migration/poh-functional-parity-audit.md`, `docs/migration/poh-functional-parity-matrix.md`

---

## Purpose

This document checks that the POH parity fixes applied in the g.txt tranche do not regress the V2 workspace/evidence-panel architecture. It confirms constraints from the task definition are respected.

---

## Constraint Check

| Constraint | Status | Evidence |
|---|---|---|
| Process Order Review remains a V2 workspace | ✓ Pass | `process-order-review-workspace.tsx` — `StandardWorkspaceTemplate` unchanged |
| All new panels use `EvidencePanel` | ✓ Pass | `OrderOperationsPanel`, `OrderConfirmationsPanel`, `ProcessOrderGoodsMovementsPanel` — all wrap `<EvidencePanel>` |
| Adapter methods return `AdapterResult<T>` | ✓ Pass | All 3 new methods return `ok(mock..., this.now)` |
| No direct shadcn/Radix imports in domain-integrations | ✓ Pass | No new imports; inline style rendering only |
| No custom app shell | ✓ Pass | No shell-level changes |
| No speculative FastAPI routes | ✓ Pass | No new proxy routes added; existing `POST /por/order-header` unchanged |
| No unlabelled mock data | ✓ Pass | Mock data is in `process-order-review-mock-data.ts`; sources clearly named |
| No claims of live/browser-verified data | ✓ Pass | All tests use adapter mock returns; no browser verification claimed |
| No hardcoded process order IDs in views | ✓ Pass | All panels receive `request` prop; `PO-240308-3847` only in mock data file |
| No SPC or domain logic in UI components | ✓ Pass | Variance colour maps and status icons are presentation-only |
| New helper functions typed and tested | ✓ Pass | New methods follow existing adapter pattern; tests cover all new methods |
| Mock data counts consistent with `OrderProgressSummary` | ✓ Pass | 8 operations (6 confirmed), 7 confirmations (5 final, 2 open) — matches mock summary |
| `ProcessOrderHeaderSchema` change is backward-compatible | ✓ Pass | `productionLine` and `scrapQuantity` both optional — existing consumers unaffected |
| Existing panels not modified or removed | ✓ Pass | No existing panel files touched; 3 new panels added as siblings |

---

## Changes Applied

### 1. `packages/data-contracts/src/schemas/process-order-review.ts`

Added `productionLine?: z.string()` and `scrapQuantity?: z.number().min(0).optional()` to `ProcessOrderHeaderSchema`.

Added `ProcessOrderOperationSchema`:
```typescript
export const ProcessOrderOperationSchema = z.object({
  operationId: z.string(),
  operationNumber: z.string(),
  operationText: z.string(),
  workCentre: z.string(),
  resource: z.string().optional(),
  plannedStart: z.string().datetime(),
  plannedFinish: z.string().datetime(),
  actualStart: z.string().datetime().optional(),
  actualFinish: z.string().datetime().optional(),
  status: z.enum(['pending', 'in-progress', 'confirmed', 'skipped']),
  plannedDurationMinutes: z.number().min(0),
  actualDurationMinutes: z.number().min(0).optional(),
  confirmationStatus: z.enum(['unconfirmed', 'partially-confirmed', 'final-confirmed']),
  confirmed: z.boolean(),
  hasException: z.boolean(),
})
```

Added `ProcessOrderConfirmationSchema`:
```typescript
export const ProcessOrderConfirmationSchema = z.object({
  confirmationId: z.string(),
  operationId: z.string(),
  operationText: z.string(),
  confirmedYield: z.number().min(0),
  scrapQuantity: z.number().min(0).optional(),
  reworkQuantity: z.number().min(0).optional(),
  uom: z.string(),
  confirmedAt: z.string().datetime(),
  confirmedBy: z.string().optional(),
  isFinalConfirmation: z.boolean(),
  setupDurationMinutes: z.number().min(0).optional(),
  machineDurationMinutes: z.number().min(0).optional(),
  cleaningDurationMinutes: z.number().min(0).optional(),
  variancePercent: z.number().optional(),
})
```

Added `ProcessOrderGoodsMovementSchema`:
```typescript
export const ProcessOrderGoodsMovementSchema = z.object({
  movementId: z.string(),
  movementType: z.string(),
  direction: z.enum(['input', 'output']),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  quantity: z.number(),
  uom: z.string(),
  postedAt: z.string().datetime(),
  postedBy: z.string().optional(),
  referenceDocument: z.string().optional(),
  storageLocation: z.string().optional(),
})
```

**Verdict:** Additive schema extensions. Backward-compatible. No existing consumers broken.

---

### 2. `domain-integrations/operations/src/adapters/process-order-review-mock-data.ts`

Added `mockOrderOperations` (8 entries: OP-010 through OP-080, matching V1 `vw_gold_process_order_phase` field names). Added `mockOrderConfirmations` (7 entries: 5 final, 2 open). Added `mockOrderGoodsMovements` (4 entries: 3 GI input, 1 GR output). Updated `mockProcessOrderHeader` with `productionLine` and `scrapQuantity`.

**Verdict:** Additive fixture data. No existing mock data modified.

---

### 3. `domain-integrations/operations/src/adapters/process-order-review-adapter.ts`

Added `getOrderOperations()`, `getOrderConfirmations()`, `getOrderGoodsMovements()` methods returning `ok(mock..., this.now)`.

**Verdict:** Additive. No existing method signatures changed. Pattern follows existing `getOrderQualityContext()` / `getRelatedBatchContext()` precedent.

---

### 4. `domain-integrations/operations/src/adapters/process-order-review-queries.ts`

Added `useOrderOperations()`, `useOrderConfirmations()`, `useOrderGoodsMovements()` hooks following existing pattern.

**Verdict:** Additive. No existing hooks modified.

---

### 5. `domain-integrations/operations/src/panels/order-operations-panel.tsx` (new)

`OrderOperationsPanel` renders 8 operations with status icon, work centre, planned/actual duration comparison, and exception flag. Confirmed count summary shown at top. Empty state handled. EvidencePanel wrapping present.

**Verdict:** Correct. No business logic in panel — status colour map and icon map are pure presentation helpers. Architecture constraint satisfied.

---

### 6. `domain-integrations/operations/src/panels/order-confirmations-panel.tsx` (new)

`OrderConfirmationsPanel` renders confirmations with yield, scrap, variance%, and isFinalConfirmation badge. Open confirmation count banner shown when openCount > 0. Empty state handled. EvidencePanel wrapping present.

**Verdict:** Correct. `varianceLabel()` and `varianceColor()` are pure presentation helpers. Architecture constraint satisfied.

---

### 7. `domain-integrations/operations/src/panels/process-order-goods-movements-panel.tsx` (new)

`ProcessOrderGoodsMovementsPanel` renders goods movements with GI/GR badge (direction), material, quantity, batch reference, and storage location. Input/output summary counts shown at top. Empty state handled. EvidencePanel wrapping present.

**Verdict:** Correct. `direction` field abstracts SAP movement type codes from the UI. No SAP domain logic in panel. Architecture constraint satisfied.

---

### 8. `domain-integrations/operations/src/views/execution-timeline-view.tsx`

Added `OrderOperationsPanel`, `OrderConfirmationsPanel`, `ProcessOrderGoodsMovementsPanel` to the view grid before `ExecutionTimelinePanel` and `OrderProgressPanel`.

**Verdict:** Additive. Grid layout unchanged (`repeat(auto-fill, minmax(320px, 1fr))`). No existing panels removed.

---

## Test Coverage

| File | Tests | Status |
|---|---|---|
| `process-order-review-adapter.test.ts` | +18 new (getOrderOperations × 6, getOrderConfirmations × 6, getOrderGoodsMovements × 6) | ✓ Pass |
| `order-operations-panel.test.tsx` | 7 new | ✓ Pass |
| `order-confirmations-panel.test.tsx` | 8 new | ✓ Pass |
| `process-order-goods-movements-panel.test.tsx` | 7 new | ✓ Pass |
| `process-order-review-legacy-api-adapter.test.ts` | Existing 11 | ✓ Pass |
| `operations-plan-risk-adapter.test.ts` | Existing 11 | ✓ Pass |
| `plan-risk-summary-panel.test.tsx` | Existing 4 | ✓ Pass |
| `process-order-review-workspace.test.tsx` | Existing 6 | ✓ Pass |
| `operations-plan-risk-workspace.test.tsx` | Existing 7 | ✓ Pass |
| **Total new** | **40** | ✓ All pass |
| **Total in di-operations** | **102** | ✓ All pass |

---

## Regressions Checked

| Panel / Adapter | Previously passing | Still passing |
|---|---|---|
| `ProcessOrderReviewAdapter` all 7 existing methods | ✓ | ✓ |
| `ProcessOrderReviewLegacyApiAdapter` | ✓ | ✓ |
| `OperationsPlanRiskAdapter` all 9 methods | ✓ | ✓ |
| `PlanRiskSummaryPanel` | ✓ | ✓ |
| `process-order-review-workspace` render | ✓ | ✓ |
| `operations-plan-risk-workspace` render | ✓ | ✓ |

---

## Architecture Anti-Patterns Verified Absent

| Anti-pattern | Check |
|---|---|
| Hardcoded process order ID in view layer | ✓ None — all panels receive `request` prop |
| Direct `fetch()` or `axios()` call in panel | ✓ None |
| Import of Databricks or FastAPI client in panel | ✓ None |
| Existing panels modified or removed | ✓ Not touched — sibling panels added only |
| New speculative FastAPI proxy route | ✓ None added |
| Browser verification claimed without testing | ✓ Not claimed |
| SAP movement type codes rendered directly in UI | ✓ None — `direction` field used |

---

## Remaining Architecture Risks

1. **`getProcessOrderHeader` not browser-verified.** The `ProcessOrderReviewLegacyApiAdapter` override calls `POST /por/order-header` and maps V1 snake_case fields. The mapping has not been tested against a live V1 instance. Field names like `process_order_id` and `planned_qty` are assumptions. Must be verified before promoting to `legacy-api verified` tier.

2. **Mock data consistency must be maintained on future changes.** The `mockOrderOperations` (8 total, 6 confirmed) and `mockOrderConfirmations` (7 total, 5 final) are tightly coupled to `mockOrderProgressSummary` counts. If either array is modified, the progress summary mock must be updated in sync.

3. **`ProcessOrderGoodsMovementsPanel` is read-only.** When goods-issue reversal workflow is added (a write endpoint), the panel must invalidate its query cache on optimistic update to avoid showing stale posted movements.

---

## Summary

All 4 parity fixes applied in this tranche are **architecturally clean**:
- No constraints violated
- No regressions introduced
- 40 new tests passing (102 total in di-operations)
- All existing panels and adapters preserved unchanged
- Operations, confirmations, and goods movements added as new first-class panels
- `ProcessOrderHeader` schema strengthened with `productionLine` and `scrapQuantity` (both optional, backward-compatible)
