# POH Functional Parity Audit

**Date:** 2026-05-16
**Domain:** `di-operations` / `process-order-review`
**Reviewer:** POH parity tranche (g.txt)
**Reference:** `docs/migration/poh-functional-parity-matrix.md`, `docs/migration/poh-parity-remediation-backlog.md`

---

## Purpose

This document audits the functional gap between the V1 Process Order History (POH) application and the V2 Process Order Review workspace. It identifies the top parity gaps closed in the g.txt tranche and any remaining gaps.

---

## V1 POH Summary

**V1 technology stack:** FastAPI + React + Databricks SQL  
**V1 schema:** `csm_process_order_history`  
**V1 SAP source tables:** AFKO (order header), AFPO (operations/phases), AFVC/AFVV (confirmations), AFRU (time tickets), JEST/TJ02T (status), MSEG (goods movements), MARA (material), QM tables (inspection lots, results, usage decisions)

### V1 Key Gold Views

| Gold View | SAP Source | Content |
|---|---|---|
| `vw_gold_process_order` | AFKO | Order headers: order type, material, quantities, dates, status |
| `vw_gold_process_order_phase` | AFPO | Operations/phases: work centre, planned/actual dates, durations |
| `vw_gold_confirmation` | AFVC/AFVV | Confirmations: yield, scrap, rework, setup/machine/clean durations |
| `vw_gold_adp_movement` | MSEG | Goods movements: types 101 (GR/output), 261 (GI/input) |
| `vw_gold_inspection_lot` | QM | Inspection lots per order/batch |
| `vw_gold_inspection_result` | QM | Characteristic results per inspection |
| `vw_gold_inspection_usage_decision` | QM | Usage decisions: accept/reject/conditional |
| `vw_gold_downtime_and_issues` | Custom | Downtime events and OEE issues per order |
| `vw_gold_logs_notes_and_comments` | Custom | Operator notes and shift comments |
| `vw_gold_batch_material` | MARA + batch | Batch/material linkage |

### V1 Frontend Pages

| Page | V1 Route | Description |
|---|---|---|
| Order List | `/orders` | Searchable order list with status, plant, date filters |
| Order Detail | `/orders/:orderId` | Full order detail: header, phases, confirmations, goods movements |
| Planning Board | `/planning` | Weekly production plan by line with order status overlay |
| Day View | `/planning/day` | Daily capacity and order schedule by line |
| Lineside Monitor | `/lineside` | Operator-facing view: current order, operations, staging |
| Analytics | `/analytics` | OEE, yield variance, defect trends |

---

## V2 Current State (before g.txt tranche)

**V2 workspace:** `process-order-review` (6 views)  
**V2 adapter:** `ProcessOrderReviewAdapter` (7 methods)  
**Wired to V1:** `getProcessOrderHeader` via `POST /por/order-header` (not browser-verified)  
**All other methods:** mock only

### V2 Views (before tranche)

| View ID | Panels |
|---|---|
| `order-overview` | ProcessOrderHeaderPanel, OrderProgressPanel, OrderQualityContextPanel |
| `execution-timeline` | ExecutionTimelinePanel, OrderProgressPanel |
| `yield-losses` | (yield loss panels) |
| `quality-context` | OrderQualityContextPanel, (quality panels) |
| `staging-context` | OrderStagingContextPanel, OrderProgressPanel |
| `related-batches` | RelatedBatchContextPanel |

### Pre-tranche Parity Gaps

| V1 Capability | V2 Status | Gap |
|---|---|---|
| Order header (material, qty, dates, status) | partial (legacy-api wired, unverified) | Missing productionLine, scrapQuantity |
| Operations/phases list | missing | No panel, no adapter method, no schema |
| Confirmations list | missing | No panel, no adapter method, no schema |
| Goods movements (GI/GR) | missing (only timeline events) | No dedicated panel; no direction/type schema |
| Execution timeline (events) | preserved (mock) | Present but lacks operations/confirmations detail |
| Quality context | preserved (mock) | Inspection lot, blockers, SPC signals present |
| Staging context | preserved (mock) | Components staged, missing, blocked |
| Related batches | preserved (mock) | Input/output/rework tracing |
| Order progress summary | preserved (mock) | operationsComplete, confirmationsComplete, riskLevel |
| Planning board / day view | missing | No planning surface in V2 |
| Lineside monitor | missing | No operator-facing view |
| Analytics / OEE | preserved (partial) | YieldLossesView, ScheduleAdherenceView in OPR workspace |
| Order search / selection | missing | No order list or search in V2 |

---

## Tranche Fixes (g.txt)

### Fix 1: `ProcessOrderHeader` strengthened

Added `productionLine: z.string().optional()` and `scrapQuantity: z.number().min(0).optional()` to `ProcessOrderHeaderSchema`.

- `productionLine` maps to `LINE` column in `vw_gold_process_order` (via AFKO work centre reference)
- `scrapQuantity` maps to `total_scrap_qty` aggregate from `vw_gold_confirmation`
- Mock header now includes `productionLine: 'LINE-IE10-CHEESE-01'` and `scrapQuantity: 48`

**Verdict:** Additive. Existing consumers of `ProcessOrderHeader` type are unaffected (both fields optional).

---

### Fix 2: `ProcessOrderOperation` schema + adapter method + panel (new)

Added `ProcessOrderOperationSchema` mapping to `vw_gold_process_order_phase`:
- operationId, operationNumber, operationText, workCentre, resource
- plannedStart, plannedFinish, actualStart?, actualFinish?
- status (`pending|in-progress|confirmed|skipped`)
- plannedDurationMinutes, actualDurationMinutes?
- confirmationStatus (`unconfirmed|partially-confirmed|final-confirmed`)
- confirmed (boolean), hasException (boolean)

Added `getOrderOperations()` adapter method returning `ProcessOrderOperation[]`.
Added `useOrderOperations()` TanStack Query hook.
Created `OrderOperationsPanel` panel in `execution-timeline-view`.

Mock data: 8 operations — OP-010 through OP-080 (6 confirmed, 1 in-progress, 1 pending). Consistent with `mockOrderProgressSummary.operationsComplete: 6` and `operationsTotal: 8`.

**Verdict:** Correct. `hasException: true` set for OP-020 Pasteurisation (pH deviation). Architecture constraint satisfied.

---

### Fix 3: `ProcessOrderConfirmation` schema + adapter method + panel (new)

Added `ProcessOrderConfirmationSchema` mapping to `vw_gold_confirmation`:
- confirmationId, operationId, operationText
- confirmedYield, scrapQuantity?, reworkQuantity?, uom
- confirmedAt, confirmedBy?
- isFinalConfirmation (boolean)
- setupDurationMinutes?, machineDurationMinutes?, cleaningDurationMinutes?
- variancePercent? (actual vs planned yield %)

Added `getOrderConfirmations()` adapter method returning `ProcessOrderConfirmation[]`.
Added `useOrderConfirmations()` TanStack Query hook.
Created `OrderConfirmationsPanel` panel in `execution-timeline-view`.

Mock data: 7 confirmations (5 final, 2 partial/open). Consistent with `mockOrderProgressSummary.confirmationsComplete: 5` and `openConfirmations: 2`.

**Verdict:** Correct. Variance colour coding: ≤5% green, ≤15% amber, >15% red. Scrap displayed only when > 0. Architecture constraint satisfied.

---

### Fix 4: `ProcessOrderGoodsMovement` schema + adapter method + panel (new)

Added `ProcessOrderGoodsMovementSchema` mapping to `vw_gold_adp_movement` (movement types 101/261):
- movementId, movementType (SAP code string), direction (`input|output`)
- materialId, materialDescription, batchId?
- quantity, uom
- postedAt, postedBy?, referenceDocument?, storageLocation?

The `direction` field is the V2 consumer-friendly representation of SAP movement types:
- `261` (goods issue to order) → `input`
- `101` (goods receipt from order) → `output`

Added `getOrderGoodsMovements()` adapter method returning `ProcessOrderGoodsMovement[]`.
Added `useOrderGoodsMovements()` TanStack Query hook.
Created `ProcessOrderGoodsMovementsPanel` panel in `execution-timeline-view`.

Mock data: 4 movements — 3 goods issues (raw milk, starter culture, rennet), 1 goods receipt (Emmental Block partial).

**Verdict:** Correct. `direction` field prevents panel from needing to know SAP movement type codes. Architecture constraint satisfied. Panel shows GI/GR badges, input/output summary counts, batch references, storage locations.

---

## Test Coverage

| File | Tests | Status |
|---|---|---|
| `process-order-review-adapter.test.ts` | +18 new (getOrderOperations × 6, getOrderConfirmations × 6, getOrderGoodsMovements × 6) | ✓ Pass |
| `order-operations-panel.test.tsx` | 7 new | ✓ Pass |
| `order-confirmations-panel.test.tsx` | 8 new | ✓ Pass |
| `process-order-goods-movements-panel.test.tsx` | 7 new | ✓ Pass |
| All existing tests | 62 existing | ✓ Pass |
| **Total new** | **40** | ✓ All pass |
| **Total in di-operations** | **102** | ✓ All pass |

---

## Regressions Checked

| Area | Previously passing | Still passing |
|---|---|---|
| `ProcessOrderReviewAdapter` all 7 existing methods | ✓ | ✓ |
| `ProcessOrderReviewLegacyApiAdapter` | ✓ | ✓ |
| `OperationsPlanRiskAdapter` | ✓ | ✓ |
| Workspace render tests | ✓ | ✓ |
| `PlanRiskSummaryPanel` | ✓ | ✓ |

---

## Remaining Parity Gaps (not in this tranche)

1. **Order search / selection** — V1 had a searchable order list (`/orders`). V2 has no order list or search. Blocked by workspace context plumbing; deferred.
2. **Planning board / day view** — V1 had weekly/daily planning views per production line. Not in V2 scope.
3. **Lineside monitor** — V1 had an operator-facing current-order view. Not in V2 scope.
4. **`getProcessOrderHeader` not browser-verified** — `ProcessOrderReviewLegacyApiAdapter` calls `POST /por/order-header` but field mapping has not been confirmed against live V1.
5. **Downtime and OEE** — V1 had `vw_gold_downtime_and_issues`. V2 partially covered in `OperationsPlanRisk` workspace but no per-order downtime panel.
6. **Operator notes/comments** — V1 had `vw_gold_logs_notes_and_comments`. V2 has no notes panel.
