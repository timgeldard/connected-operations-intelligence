# POH Next Databricks Vertical Slices — Candidate Analysis

**Date:** 2026-05-17  
**Foundation:** POH order header and CQ lab plants browser-verified (2026-05-17). End-to-end Databricks path proven.  
**Reference:** `docs/audit/adapter-source-status-matrix.md`, `docs/audit/native-databricks-column-verification-checklist.md`

---

## Context

The native Databricks read path is proven end-to-end. This document analyses the next POH candidates for native migration and records the implement/defer decision for each.

Sample process order for testing: **7006965038**

---

## 1. `getOrderOperations` — IMPLEMENTED

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Operations / Phases tab |
| Mock method | `ProcessOrderReviewAdapter.getOrderOperations` |
| Contract | `ProcessOrderOperation[]` (`packages/data-contracts/src/schemas/process-order-review.ts`) |
| Source view | `vw_gold_process_order_phase` |
| QuerySpec | `poh.get_order_operations` |
| FastAPI route | `GET /api/por/order-operations?process_order_id=...` |
| Frontend wiring | `ProcessOrderReviewLegacyApiAdapter.getOrderOperations` |

**Source columns confirmed from DDL (2026-05-17):**

| Column | Maps to | Status |
|--------|---------|--------|
| `PROCESS_ORDER_PHASE_ID` | `operationId` | confirmed-ddl |
| `PHASE_ID` | `operationNumber` | confirmed-ddl |
| `PHASE_DESCRIPTION` | `operationText` | confirmed-ddl |
| `PHASE_TEXT` | `operationDetail` (not in contract) | confirmed-ddl |
| `OPERATION_QUANTITY` | planned qty (not in contract) | confirmed-ddl |
| `OPERATION_QUANTITY_UOM` | uom (not in contract) | confirmed-ddl |
| `SORT_NUMBER` | order key | confirmed-ddl |
| `START_USER` | infers status/confirmationStatus | confirmed-ddl |
| `END_USER` | infers confirmed/status | confirmed-ddl |

**Contract fields not in view (returned as empty/zero defaults):**
- `workCentre` → `""`
- `plannedStart` → `""`
- `plannedFinish` → `""`
- `plannedDurationMinutes` → `0`
- `hasException` → `false`

**Risk:** Low. View DDL confirmed. Status inference from START_USER/END_USER is conservative and documented. Known gaps documented rather than faked.

**User value:** High — Operations tab shows no live data without this slice.

**Decision: IMPLEMENTED.** Browser verification still required — see `docs/deployment/poh-native-slices-browser-verification.md`.

---

## 2. `getOrderConfirmations` — IMPLEMENTED

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Confirmations tab |
| Mock method | `ProcessOrderReviewAdapter.getOrderConfirmations` |
| Contract | `ProcessOrderConfirmation[]` |
| Source view | `vw_gold_confirmation` |
| QuerySpec | `poh.get_order_confirmations` |
| FastAPI route | `GET /api/por/order-confirmations?process_order_id=...` |
| Frontend wiring | `ProcessOrderReviewLegacyApiAdapter.getOrderConfirmations` |

**Source columns confirmed from DDL (2026-05-17):**

| Column | Maps to | Status |
|--------|---------|--------|
| `CONFIRMATION_ID` | `confirmationId` | confirmed-ddl |
| `PROCESS_ORDER_PHASE_ID` | `operationId` | confirmed-ddl — matches operations operationId |
| `CONFIRMED_QUANTITY` | `confirmedYield` | confirmed-ddl |
| `CONFIRMED_QUANTITY_UOM` | `uom` | confirmed-ddl |
| `COALESCE(END_TIMESTAMP, START_TIMESTAMP, __CREATED_ON)` | `confirmedAt` | confirmed-ddl |
| `SET_UP_DURATION_S` ÷ 60 | `setupDurationMinutes` | confirmed-ddl |
| `MACHINE_DURATION_S` ÷ 60 | `machineDurationMinutes` | confirmed-ddl |
| `CLEANING_DURATION_S` ÷ 60 | `cleaningDurationMinutes` | confirmed-ddl |

**Contract fields not in view (schema relaxed to optional):**
- `operationText` → absent; `z.string()` → `.optional()` — re-require when view exposes phase description
- `isFinalConfirmation` → absent; `z.boolean()` → `.optional()` — re-require when view exposes flag
- `scrapQuantity`, `reworkQuantity`, `confirmedBy`, `variancePercent` → absent (already optional)

**Decision: IMPLEMENTED.** Browser verification required — see `docs/deployment/poh-native-slices-browser-verification.md`.

---

## 3. `getOrderGoodsMovements` — IMPLEMENTED

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Goods Movements tab |
| Mock method | `ProcessOrderReviewAdapter.getOrderGoodsMovements` |
| Contract | `ProcessOrderGoodsMovement[]` |
| Source view | `vw_gold_adp_movement` |
| QuerySpec | `poh.get_order_goods_movements` |
| FastAPI route | `GET /api/por/order-goods-movements?process_order_id=...` |
| Frontend wiring | `ProcessOrderReviewLegacyApiAdapter.getOrderGoodsMovements` |

**Source columns confirmed from DDL (2026-05-17):** 39 columns — ADP (Tulip) movements, not standard SAP MIGO.

| Column | Maps to | Status |
|--------|---------|--------|
| `ID` | `movementId` | confirmed-ddl |
| `MOVEMENT_TYPE` | `movementType` | confirmed-ddl — Tulip codes |
| `MOVEMENT_TYPE` via map | `direction` | confirmed-ddl — 101/261/262/531 mapped; 711/712/999/null direction-unknown |
| `MATERIAL_ID` | `materialId` | confirmed-ddl — string; leading zeros preserved |
| `QUANTITY` | `quantity` | confirmed-ddl |
| `UOM` | `uom` | confirmed-ddl |
| `DATE_TIME_OF_ENTRY` | `postedAt` | confirmed-ddl |
| `BATCH_ID` | `batchId` | confirmed-ddl — optional |
| `USER` | `postedBy` | confirmed-ddl — optional |
| `MATERIAL_DOCUMENT` | `referenceDocument` | confirmed-ddl — optional |
| `STORAGE_ID` | `storageLocation` | confirmed-ddl — optional |

**Contract fields not in view (schema relaxed to optional):**
- `materialDescription` → absent (no material master join); `z.string()` → `.optional()` — re-require when available

**Confirmed MOVEMENT_TYPE values (2026-05-17 live query):** 101 (Goods Receipts), 261 (Goods Issues + Unplanned), 262 (reversal), 531 (by-product, ITEM_TYPE=B), 711/712 (Write-On/Off — unmapped), 999 (unmapped), null (unmapped). Rows without a mapped direction are excluded by the frontend adapter filter.

**Decision: IMPLEMENTED.** Browser verification required — see `docs/deployment/poh-native-slices-browser-verification.md`.

---

## 4. `getExecutionTimeline` — DEFERRED

| Field | Value |
|---|---|
| V2 panel | Process Order Review — Execution Timeline panel |
| Candidate source | Derivable from `vw_gold_process_order_phase` (same as operations) |
| Decision | Deferred — timeline would be derived from start/end data not present in the phase view |

No date columns exist in `vw_gold_process_order_phase`. Without `plannedStart`/`plannedFinish` from the operations, a timeline cannot be constructed. Deferred until a richer operations view is confirmed.

---

## Implementation Order

1. ~~`getOrderOperations`~~ — **DONE** (2026-05-17) — browser-verified
2. ~~`getOrderConfirmations`~~ — **DONE** (2026-05-17) — executable, awaiting browser verification
3. ~~`getOrderGoodsMovements`~~ — **DONE** (2026-05-17) — executable, awaiting browser verification
4. `getExecutionTimeline` — deferred; blocked on date columns in phase view

---

## No SPN/PAT Fallback

All implemented and future slices execute as end-user OAuth. No service-principal or PAT fallback paths exist or will be added. If OAuth is unavailable, the route returns 401.
