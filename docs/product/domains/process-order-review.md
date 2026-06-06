# Process Order Review Domain Reference

**Domain:** `operations`
**Workspace:** `process-order-review`
**Owner:** `di-operations`
**Lifecycle:** `pilot`
**Route:** `/operations/process-order-review`
**Date updated:** 2026-05-17 (getOrderOperations wired to databricks-api)

---

## Purpose

The Process Order Review workspace gives production managers, quality reviewers, and shift managers a consolidated view of a single process order — header details, operation/phase status, confirmations, goods movements, quality context, staging readiness, and related batch tracing.

The workspace preserves the original POH application's per-order detail view: execution record, yield and scrap actuals, SPC-linked quality context, and batch linkage. It wraps that capability in the V2 evidence-panel architecture.

---

## Supported Roles

| Role | Primary use |
|------|-------------|
| `production-manager` | Monitor order execution, operation status, yield actuals |
| `quality-reviewer` | Review inspection context, SPC signals, release blockers |
| `shift-manager` | Confirm staging readiness; review open confirmations |
| `inventory-controller` | Trace goods movements; verify goods issues and receipts |
| `operations-supervisor` | Track confirmation progress; identify deviations |

---

## Required Permissions

| Permission ID | Description |
|---|---|
| `operations.order.read` | View process order header, operations, confirmations, goods movements, quality context, staging context, and related batches |

---

## Workspace Metadata

| Field | Value |
|---|---|
| workspaceId | `process-order-review` |
| displayName | Process Order Review |
| domainId | `operations` |
| ownerDomain | `operations` |
| lifecycle | `pilot` |
| route | `/operations/process-order-review` |
| telemetryId | `operations.process-order-review` |

---

## Views

### 1. Order Overview (`order-overview`)

Default landing view. Shows process order header, progress KPIs, and quality context.

**Panels:** `ProcessOrderHeaderPanel`, `OrderProgressPanel`, `OrderQualityContextPanel`

---

### 2. Execution Timeline (`execution-timeline`)

Operations/phases list, confirmations detail, goods movements, and the chronological event timeline.

**Panels:** `OrderOperationsPanel`, `OrderConfirmationsPanel`, `ProcessOrderGoodsMovementsPanel`, `ExecutionTimelinePanel`, `OrderProgressPanel`

---

### 3. Yield Losses (`yield-losses`)

Yield variance and scrap analysis for the order.

**Panels:** (yield loss panels — Operations Plan Risk domain)

---

### 4. Quality Context (`quality-context`)

Inspection lot status, usage decision, SPC signals, and release blockers.

**Panels:** `OrderQualityContextPanel`

---

### 5. Staging Context (`staging-context`)

Component staging readiness: staged, missing, blocked components and open transfer requirements.

**Panels:** `OrderStagingContextPanel`, `OrderProgressPanel`

---

### 6. Related Batches (`related-batches`)

Input components, output batch, co-products, and rework batches linked to this order.

**Panels:** `RelatedBatchContextPanel`

---

## Panels

| Panel ID | Component | Adapter method | Description |
|---|---|---|---|
| `process-order-header` | `ProcessOrderHeaderPanel` | `getProcessOrderHeader()` | Order header: material, batch, qty, dates, status, productionLine |
| `order-progress` | `OrderProgressPanel` | `getOrderProgressSummary()` | progressPercent, operationsComplete, confirmationsComplete, riskLevel, confidence |
| `order-quality-context` | `OrderQualityContextPanel` | `getOrderQualityContext()` | Inspection lot, usage decision, SPC signals, release blockers |
| `order-staging-context` | `OrderStagingContextPanel` | `getOrderStagingContext()` | componentsRequired/staged/missing/blocked, openTransferRequirements |
| `related-batch-context` | `RelatedBatchContextPanel` | `getRelatedBatchContext()` | Per-batch: relationshipType, traceRisk, qualityStatus, stockStatus |
| `execution-timeline` | `ExecutionTimelinePanel` | `getExecutionTimeline()` | Chronological events: operation-started/confirmed, goods-issued, deviation-raised, quality-inspection, alerts |
| `order-operations` | `OrderOperationsPanel` | `getOrderOperations()` | Per-operation: operationNumber, workCentre, planned/actual durations, status, confirmationStatus, hasException |
| `order-confirmations` | `OrderConfirmationsPanel` | `getOrderConfirmations()` | Per-confirmation: operationText, yield, scrap, variance%, setup/machine/clean durations, isFinalConfirmation |
| `process-order-goods-movements` | `ProcessOrderGoodsMovementsPanel` | `getOrderGoodsMovements()` | Per-movement: direction (input/output), materialDescription, batch, qty, postedAt, storageLocation |

---

## Adapter Methods

All methods are on `ProcessOrderReviewAdapter` in `domain-integrations/operations/src/adapters/process-order-review-adapter.ts`. `getProcessOrderHeader` is wired to V1 (legacy-api, not browser-verified) and native Databricks (browser-verified 2026-05-17). `getOrderOperations` is wired to native Databricks (`GET /api/por/order-operations`, browser-verified 2026-05-17 — 11 operations for PO 7006965038). `getOrderConfirmations` is wired to native Databricks (`GET /api/por/order-confirmations`, DDL confirmed 2026-05-17, executable — browser verification pending). `getOrderGoodsMovements` is wired to native Databricks (`GET /api/por/order-goods-movements`, DDL confirmed 2026-05-17, executable — browser verification pending). All other methods return mock data.

| Method | Request fields used | Returns |
|---|---|---|
| `getProcessOrderReviewContext` | processOrderId, plantId | `ProcessOrderReviewContext` |
| `getProcessOrderHeader` | processOrderId, plantId | `ProcessOrderHeader` |
| `getOrderProgressSummary` | processOrderId | `OrderProgressSummary` |
| `getExecutionTimeline` | processOrderId, plantId | `ExecutionTimelineItem[]` |
| `getOrderQualityContext` | processOrderId, batchId | `OrderQualityContext` |
| `getOrderStagingContext` | processOrderId, plantId | `OrderStagingContext` |
| `getRelatedBatchContext` | processOrderId, batchId | `RelatedBatchContext[]` |
| `getOrderOperations` | processOrderId, plantId | `ProcessOrderOperation[]` |
| `getOrderConfirmations` | processOrderId, plantId | `ProcessOrderConfirmation[]` |
| `getOrderGoodsMovements` | processOrderId, plantId | `ProcessOrderGoodsMovement[]` |

---

## Data Contracts

All types are in `packages/data-contracts/src/schemas/process-order-review.ts` and exported from `@connectio/data-contracts`.

| Type | Description |
|---|---|
| `ProcessOrderReviewContext` | Workspace context: order ID, material, quality/staging status, active view |
| `ProcessOrderHeader` | Order header: material, batch, quantities, dates, productionLine, scrapQuantity, orderStatus |
| `OrderProgressSummary` | Progress KPIs: progressPercent, operationsComplete/Total, confirmationsComplete, openConfirmations, riskLevel |
| `ExecutionTimelineItem` | Single timeline event: eventType, timestamp, title, description, sourceSystem, actor, severity |
| `OrderQualityContext` | Quality snapshot: inspectionLotId, qualityStatus, SPC signals, release blockers, deviations |
| `OrderStagingContext` | Staging snapshot: components staged/missing/blocked, openTransferRequirements |
| `RelatedBatchContext` | Batch link: batchId, materialId, relationshipType, traceRisk, qualityStatus, stockStatus |
| `ProcessOrderOperation` | Operation record: operationId, operationNumber, workCentre, durations, status, confirmed, hasException |
| `ProcessOrderConfirmation` | Confirmation record: confirmationId, operationText, yield, scrap, variance%, durations, isFinalConfirmation |
| `ProcessOrderGoodsMovement` | Goods movement: movementId, direction, materialId, batch, qty, postedAt, storageLocation |

---

## Operation Status Values

| Status | Description |
|---|---|
| `pending` | Operation not yet started |
| `in-progress` | Operation currently active |
| `confirmed` | Final or partial confirmation posted |
| `skipped` | Operation bypassed (e.g., not applicable for this batch) |

## Operation Confirmation Status Values

| confirmationStatus | Description |
|---|---|
| `unconfirmed` | No confirmation posted |
| `partially-confirmed` | At least one confirmation posted but not final |
| `final-confirmed` | Final confirmation posted; operation closed |

## Goods Movement Direction

| direction | SAP movement type | Meaning |
|---|---|---|
| `input` | 261, 262 | Goods issue to order (component consumed or returned) |
| `output` | 101, 531 | Goods receipt from order (batch produced or returned to stock) |
| `unknown` | 711, 712, 999, null, other | Unmapped movement type — displayed as "Unclassified" in UI |

---

## Mock Data Scope

| Field | Mock value | Origin |
|---|---|---|
| processOrderId | `PO-240308-3847` | Fixture |
| materialDescription | `Emmental Block 4 kg` | Fixture — not architecture |
| plantId | `IE10` (Kerry Listowel) | Fixture |
| productionLine | `LINE-IE10-CHEESE-01` | Fixture |
| operationsTotal | 8 | Fixture — consistent with progress summary |
| operationsComplete | 6 | Fixture — consistent with confirmed count in operations array |
| confirmationsComplete | 5 | Fixture — consistent with isFinalConfirmation count |
| openConfirmations | 2 | Fixture — consistent with !isFinalConfirmation count |

---

## Parity Status (2026-05-17)

| Capability | Status |
|---|---|
| Process order header | **databricks-api browser-verified 2026-05-17** (process order 7006965038) |
| Operations / phases list | **databricks-api browser-verified 2026-05-17** (`GET /api/por/order-operations`, 11 ops for PO 7006965038); known field gaps (workCentre, dates, hasException) — not in view |
| Confirmations (yield, scrap, variance) | **databricks-api executable 2026-05-17** (`GET /api/por/order-confirmations`); DDL confirmed; browser verification pending; `operationText`/`isFinalConfirmation` absent — not in view |
| Goods movements (GI/GR) | **databricks-api executable 2026-05-17** (`GET /api/por/order-goods-movements`); DDL confirmed; browser verification pending; `materialDescription` absent; `direction: "unknown"` for unmapped movement types |
| Execution event timeline | mock — deferred until operations/confirmations/movements are native |
| Order progress KPIs | mock |
| Quality context | mock |
| Staging context | mock |
| Related batch tracing | mock |
| Inspection characteristic results | missing |
| Operator notes / shift comments | missing |
| Order search / selection | missing |

See `docs/migration/poh-functional-parity-matrix.md` for full matrix.

---

## Known Limitations

1. `getProcessOrderHeader` is browser-verified (2026-05-17) but returns empty `plannedQuantity`, `confirmedQuantity`, `uom`, and date fields — these are not in `vw_gold_process_order`.
2. `getOrderOperations` is wired to native Databricks and browser-verified 2026-05-17. `workCentre`, `plannedStart`, `plannedFinish`, `plannedDurationMinutes` are empty/zero (not in `vw_gold_process_order_phase`). Status is inferred from START_USER/END_USER.
3. `getOrderConfirmations` is wired and executable (DDL confirmed 2026-05-17). `operationText` and `isFinalConfirmation` are absent — not in `vw_gold_confirmation`. Browser verification pending.
4. `getOrderGoodsMovements` is wired and executable (DDL confirmed 2026-05-17). `materialDescription` is absent — no material master join in `vw_gold_adp_movement`. Movement types 711/712/999/null return `direction: "unknown"`. Browser verification pending.
5. All other adapter methods return mock data using Kerry Listowel fixtures.
6. No order search or order list — workspace requires `processOrderId` from scope context.
7. No inspection characteristic results panel — only pass/fail summary via `OrderQualityContextPanel`.
8. No operator notes panel.
