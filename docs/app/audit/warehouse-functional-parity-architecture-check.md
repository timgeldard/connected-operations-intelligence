# Warehouse Functional Parity Architecture Check

**Date:** 2026-05-16
**Domain:** `di-warehouse` / `warehouse-360-overview`
**Reviewer:** Warehouse parity tranche (f.txt)
**Reference:** `docs/migration/warehouse-functional-parity-audit.md`, `docs/migration/warehouse-functional-parity-matrix.md`

---

## Purpose

This document checks that the warehouse parity fixes applied in the f.txt tranche do not regress the V2 workspace/evidence-panel architecture. It confirms constraints from the task definition are respected.

---

## Constraint Check

| Constraint | Status | Evidence |
|---|---|---|
| Warehouse 360 remains a V2 workspace | ✓ Pass | `warehouse-360-workspace.tsx` — `StandardWorkspaceTemplate` unchanged |
| All panels use `EvidencePanel` | ✓ Pass | `NearExpiryStockPanel`, `WarehouseReconciliationExceptionsPanel` — both wrap `<EvidencePanel>` |
| Adapter methods return `AdapterResult<T>` | ✓ Pass | `Warehouse360Adapter` — all methods return `ok(data, this.now)` |
| No direct shadcn/Radix imports in domain-integrations | ✓ Pass | No new imports; inline style rendering only |
| No custom app shell | ✓ Pass | No shell-level changes |
| No speculative FastAPI routes | ✓ Pass | No new proxy routes added; existing `POST /api/wh360/warehouse-summary` unchanged |
| No unlabelled mock data | ✓ Pass | Mock data is in `warehouse-360-mock-data.ts`; sources clearly named |
| No claims of live/browser-verified data | ✓ Pass | All tests use `vi.mock`; no browser verification claimed |
| No hardcoded warehouse IDs in views | ✓ Pass | `StockStatusView` passes `request` prop to all panels; no hardcoded IDs |
| No SPC or domain logic in UI components | ✓ Pass | Urgency colour maps and exception type labels are presentation-only |
| New helper functions typed and tested | ✓ Pass | New methods follow existing adapter pattern; tests cover all new methods |
| `ExceptionStockSummaryPanel` unchanged | ✓ Pass | Existing panel not modified; new panel added as sibling |

---

## Changes Applied

### 1. `packages/data-contracts/src/schemas/warehouse-360-overview.ts`

Added `NearExpiryBatchSchema`:
```typescript
export const NearExpiryBatchSchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  storageLocationId: z.string(),
  expiryDate: z.string().datetime(),
  daysUntilExpiry: z.number(),
  quantity: z.number().min(0),
  uom: z.string(),
  urgency: z.enum(['expired', 'critical', 'warning', 'caution']),
  holdStatus: z.enum(['unrestricted', 'quality-hold', 'blocked']),
})
```

Added `WarehouseReconciliationExceptionSchema`:
```typescript
export const WarehouseReconciliationExceptionSchema = z.object({
  exceptionId: z.string(),
  exceptionType: z.enum(['quantity-mismatch', 'location-mismatch', 'status-mismatch',
    'missing-in-wms', 'missing-in-im', 'duplicate-posting']),
  materialId: z.string(),
  materialDescription: z.string(),
  batchId: z.string().optional(),
  storageLocationId: z.string(),
  imQuantity: z.number().optional(),
  wmsQuantity: z.number().optional(),
  discrepancyQuantity: z.number().optional(),
  uom: z.string(),
  detectedAt: z.string().datetime(),
  ageHours: z.number().min(0),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  resolution: z.enum(['open', 'in-progress', 'resolved', 'escalated']),
})
```

**Verdict:** Additive schema extensions. Backward-compatible. No existing consumers broken.

---

### 2. `domain-integrations/warehouse/src/adapters/warehouse-360-mock-data.ts`

Added `mockNearExpiryBatches` (4 entries: expired Rennet, critical Starter Culture, warning Cheddar, caution Emmental) and `mockWarehouseReconciliationExceptions` (3 entries: quantity mismatch, missing-in-WM, location mismatch).

**Verdict:** Additive fixture data. No existing mock data modified.

---

### 3. `domain-integrations/warehouse/src/adapters/warehouse-360-adapter.ts`

Added `getNearExpiryStock()` and `getWarehouseExceptions()` methods returning `ok(mock..., this.now)`.

**Verdict:** Additive. No existing method signatures changed. Pattern follows existing `getOpenHolds()` / `getGoodsMovements()` precedent.

---

### 4. `domain-integrations/warehouse/src/adapters/warehouse-360-queries.ts`

Added `useNearExpiryStock()` and `useWarehouseExceptions()` hooks following existing `useOpenHolds()` / `useGoodsMovements()` pattern.

**Verdict:** Additive. No existing hooks modified.

---

### 5. `domain-integrations/warehouse/src/panels/near-expiry-stock-panel.tsx` (new)

`NearExpiryStockPanel` renders a list of batches with urgency colour coding, daysUntilExpiry text, and hold status indicator. Empty state handled. EvidencePanel wrapping present.

**Verdict:** Correct. No business logic in panel — urgency colour map and `daysLabel()` are pure presentation helpers. Architecture constraint satisfied.

---

### 6. `domain-integrations/warehouse/src/panels/warehouse-reconciliation-exceptions-panel.tsx` (new)

`WarehouseReconciliationExceptionsPanel` renders exception records with exceptionType label, discrepancy quantity, severity colour coding, and resolution status. Open exception count banner shown when open/escalated exceptions present.

**Verdict:** Correct. Added as sibling to existing `ExceptionStockSummaryPanel` — does not replace or modify it. Architecture constraint satisfied.

---

### 7. `domain-integrations/warehouse/src/views/stock-status-view.tsx`

Added `NearExpiryStockPanel` and `WarehouseReconciliationExceptionsPanel` to the view grid alongside existing `StockOverviewPanel` and `LocationCapacityPanel`.

**Verdict:** Additive. Grid layout unchanged (`repeat(auto-fill, minmax(320px, 1fr))`). No existing panels removed.

---

## Test Coverage

| File | Tests | Status |
|---|---|---|
| `warehouse-360-adapter.test.ts` | +10 new (getNearExpiryStock × 5, getWarehouseExceptions × 5) | ✓ Pass |
| `near-expiry-stock-panel.test.tsx` | 9 new | ✓ Pass |
| `warehouse-reconciliation-exceptions-panel.test.tsx` | 8 new | ✓ Pass |
| `exception-stock-summary-panel.test.tsx` | Existing 7 | ✓ Pass |
| `inbound-outbound-summary-panel.test.tsx` | Existing | ✓ Pass |
| `staging-readiness-summary-panel.test.tsx` | Existing | ✓ Pass |
| `staging-shortfalls-panel.test.tsx` | Existing | ✓ Pass |
| `staging-alerts-panel.test.tsx` | Existing | ✓ Pass |
| **Total new** | **27** | ✓ All pass |

---

## Regressions Checked

| Panel | Previously passing | Still passing |
|---|---|---|
| `ExceptionStockSummaryPanel` | ✓ | ✓ |
| `InboundOutboundSummaryPanel` | ✓ | ✓ |
| `StagingReadinessSummaryPanel` | ✓ | ✓ |
| `StagingShortfallsPanel` | ✓ | ✓ |
| `StagingAlertsPanel` | ✓ | ✓ |
| `Warehouse360Adapter` all existing methods | ✓ | ✓ |

---

## Architecture Anti-Patterns Verified Absent

| Anti-pattern | Check |
|---|---|
| Hardcoded warehouse ID or plant ID in view layer | ✓ None — all panels receive `request` prop |
| Direct `fetch()` or `axios()` call in panel | ✓ None |
| Import of Databricks or FastAPI client in panel | ✓ None |
| `ExceptionStockSummaryPanel` modified or removed | ✓ Not touched — sibling panel added only |
| New speculative FastAPI proxy route | ✓ None added |
| Browser verification claimed without testing | ✓ Not claimed |

---

## Remaining Architecture Risks

1. **`getWarehouse360Summary` not browser-verified.** The `Warehouse360LegacyApiAdapter` override calls `POST /api/wh360/warehouse-summary` and maps V1 snake_case fields using `??` fallbacks. The mapping has not been tested against a live V1 instance. Field names like `qi_lines` and `capacity_pct` are assumptions. Must be verified before promoting to `legacy-api verified` tier.

2. **No generic routing in `getNearExpiryStock`.** When V1 is wired, the adapter will need to map V1 `days_until_expiry` and `urgency_band` (or equivalent) fields to V2 urgency enum. The V1 urgency thresholds may differ from the V2 `expired/critical/warning/caution` bands defined in the schema.

3. **`WarehouseReconciliationExceptionsPanel` does not update on resolution.** Currently read-only. When resolution workflow is added (a write endpoint), the panel must invalidate its query cache on optimistic update to avoid showing stale resolution status.

---

## Summary

Both parity fixes applied in this tranche are **architecturally clean**:
- No constraints violated
- No regressions introduced
- 27 new tests passing
- `ExceptionStockSummaryPanel` preserved unchanged
- Near-expiry and reconciliation exception surfaces added as new first-class panels
