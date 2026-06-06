# POH Adapter Migration Strategy

**Date:** 2026-05-16
**Domain:** `di-operations`
**Reference:** `docs/adapters/adapter-migration-strategy.md` (general lifecycle)

---

## Lifecycle Overview

```
mock
  → legacy-api (FastAPI proxy → V1 POH backend)
  → databricks-api (direct Databricks SQL / Unity Catalog)
```

The `ProcessOrderReviewLegacyApiAdapter` class extends `ProcessOrderReviewAdapter` and overrides methods one at a time as V1 endpoints are confirmed and browser-verified. The `OperationsPlanRiskAdapter` currently has no legacy-api override.

---

## Current State (2026-05-17, updated a.txt/b.txt tranche)

### ProcessOrderReviewAdapter

| Method | V2 tier | Databricks route | Browser verified | QuerySpec | Row mapper |
|---|---|---|---|---|---|
| `getProcessOrderReviewContext` | mock | — | No | No | No |
| `getProcessOrderHeader` | **databricks-api** (mode-gated) | `POST /api/por/order-header` | **Yes 2026-05-17** (PO 7006965038) | `get_process_order_header_spec` | `map_process_order_header_rows` |
| `getOrderProgressSummary` | mock | — | No | No | No |
| `getExecutionTimeline` | mock | — | No | No | No |
| `getOrderQualityContext` | mock | — | No | No | No |
| `getOrderStagingContext` | mock | — | No | No | No |
| `getRelatedBatchContext` | mock | — | No | No | No |
| `getOrderOperations` | **databricks-api** (mode-gated) | `GET /api/por/order-operations` | **Yes 2026-05-17** (PO 7006965038, 11 ops) | `get_order_operations_spec` | `map_order_operations_rows` |
| `getOrderConfirmations` | ✓ | — | — | **✓ E 2026-05-17** — DDL confirmed; `operationText`/`isFinalConfirmation` absent (optional) | `get_order_confirmations_spec` | `map_order_confirmations_rows` |
| `getOrderGoodsMovements` | ✓ | — | — | **✓ E 2026-05-17** — DDL confirmed; `materialDescription` absent (optional); Tulip movement types mapped | `get_order_goods_movements_spec` | `map_order_goods_movements_rows` |

### OperationsPlanRiskAdapter

| Method | V2 tier | V1 endpoint | Proxy route | Browser verified |
|---|---|---|---|---|
| `getOperationsPlanRiskContext` | mock | — | No | No |
| `getPlanRiskSummary` | mock | — | No | No |
| `getLateOrders` | mock | — | No | No |
| `getMaterialShortages` | mock | — | No | No |
| `getLineStatuses` | mock | — | No | No |
| `getScheduleAdherence` | mock | — | No | No |
| `getYieldVariances` | mock | — | No | No |
| `getShiftHandover` | mock | — | No | No |
| `getOperationsActionQueue` | mock | — | No | No |

---

## What Can Remain Mock Temporarily

| Method | Reason acceptable at mock |
|---|---|
| `getProcessOrderReviewContext` | Context frame; operators know their order |
| `getExecutionTimeline` | Derived event feed; operators have source records |
| `getOrderProgressSummary` | Directional — computed from operations/confirmations |
| `getOrderQualityContext` | QM data visible in SAP directly |
| `getOrderStagingContext` | Staging operators know their zone |
| All `OperationsPlanRisk*` methods | Plan-level aggregates; operators verify at source |

---

## What Must Use V1/Legacy API to Prove Parity

| Method | Why V1 is required | V1 endpoint |
|---|---|---|
| `getProcessOrderHeader` | Order header drives release and production decisions; unverified mapping may silently show wrong quantities | `POST /por/order-header` |
| `getOrderOperations` | Operations are the execution record; mock operations show wrong phase state | `GET /por/order-phases` |
| `getOrderConfirmations` | Confirmations are the yield/scrap audit trail; mock data is misleading | `GET /por/confirmations` |
| `getOrderGoodsMovements` | Goods movements are the material flow record; mock shows wrong materials | `GET /por/goods-movements` |
| `getRelatedBatchContext` | Batch tracing drives recall and quality decisions | `GET /por/related-batches` |

---

## What Should Eventually Be Native Databricks API

| Method | Likely Databricks source |
|---|---|
| `getProcessOrderHeader` | `vw_gold_process_order` |
| `getOrderOperations` | `vw_gold_process_order_phase` |
| `getOrderConfirmations` | `vw_gold_confirmation` |
| `getOrderGoodsMovements` | `vw_gold_adp_movement` (types 101, 261) |
| `getRelatedBatchContext` | `vw_gold_batch_material` |
| `getOrderQualityContext` | `vw_gold_inspection_lot` + `vw_gold_inspection_usage_decision` |
| `getExecutionTimeline` | Derived from multiple gold views (order, confirmation, movement, inspection) |
| `getOrderProgressSummary` | Computed from `vw_gold_process_order_phase` aggregate |

---

## Required Tests Before Advancing to Legacy-API

Each method must satisfy the following before a FastAPI proxy route is added:

1. **V1 endpoint confirmed** — URL, HTTP method, request and response field names verified from V1 source code.
2. **Proxy route created** in `apps/api/routes/por.py`.
3. **Browser-verified** — end-to-end call from V2 workspace to V1 backend confirmed for at least one plant and one process order.
4. **Contract tests written** in `process-order-review-legacy-api-adapter.test.ts`:
   - Success case with representative data
   - 401 Unauthorized
   - 404 Not Found (order does not exist)
   - 500 Internal Server Error
   - Network failure / timeout
   - Fallback to mock when `processOrderId` is missing

**Do not advance to legacy-api based on field name assumptions.** The V1 POH backend uses snake_case; V2 schemas use camelCase. The mapping layer must be verified against live V1 responses.

---

## Required Tests Before Advancing to Databricks-API

1. V1 POH backend retired or scheduled for retirement.
2. `csm_process_order_history` gold views confirmed queryable in Unity Catalog.
3. V2 `@connectio/data-contracts` Zod schemas validated against Databricks query responses without field renames.
4. Pilot sign-off on legacy-api tier for at least `getProcessOrderHeader` and `getOrderOperations`.
5. `process-order-review-databricks-api-adapter.test.ts` created covering same cases as legacy adapter tests.

---

## Advance Order Recommendation

Priority order for V1 wiring:

1. **Browser-verify `getProcessOrderHeader`** — already wired, just needs verification
2. **`getOrderOperations`** — core execution record; highest daily visibility
3. **`getOrderConfirmations`** — yield/scrap audit trail; required for quality release
4. **`getOrderGoodsMovements`** — material flow record; needed for goods-issue reconciliation
5. **`getRelatedBatchContext`** — batch tracing; required for recall readiness
6. **`getOrderQualityContext`** — inspection lot detail; linked to QM
7. **`getExecutionTimeline`** — derived; lowest priority since composed from above

---

## FastAPI Routes (current state)

```python
# apps/api/routes/process_order.py
POST /api/por/order-header           # mode-gated: legacy-api (proxy) or databricks-api — browser-verified 2026-05-17
GET  /api/por/order-operations       # databricks-api only — browser-verified 2026-05-17 (11 ops for PO 7006965038)
GET  /api/por/order-confirmations    # databricks-api only — executable, not browser-verified; vw_gold_confirmation DDL confirmed 2026-05-17
GET  /api/por/order-goods-movements  # databricks-api only — executable, not browser-verified; vw_gold_adp_movement DDL confirmed 2026-05-17
# All others (related-batches, quality-context, staging-context, etc.) — mock only
```

## Databricks Column Verification Status

| View | Columns | Status |
|------|---------|--------|
| `vw_gold_process_order` | `PROCESS_ORDER_ID`, `STATUS`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `PLANT_ID`, `INSPECTION_LOT_ID` | **confirmed-ddl 2026-05-17** |
| `vw_gold_process_order_phase` | `PROCESS_ORDER_PHASE_ID`, `PHASE_ID`, `PHASE_DESCRIPTION`, `PHASE_TEXT`, `OPERATION_QUANTITY`, `OPERATION_QUANTITY_UOM`, `SORT_NUMBER`, `START_USER`, `END_USER` | **confirmed-ddl 2026-05-17** |
| `vw_gold_confirmation` | `CONFIRMATION_ID`, `PROCESS_ORDER_PHASE_ID`, `CONFIRMED_QUANTITY`, `CONFIRMED_QUANTITY_UOM`, `END_TIMESTAMP`, `START_TIMESTAMP`, `SET_UP_DURATION_S`, `MACHINE_DURATION_S`, `CLEANING_DURATION_S`, `__CREATED_ON` | **confirmed-ddl 2026-05-17** |
| `vw_gold_adp_movement` | `ID`, `PROCESS_ORDER_ID`, `MOVEMENT_TYPE`, `MATERIAL_ID`, `QUANTITY`, `UOM`, `DATE_TIME_OF_ENTRY`, `BATCH_ID`, `USER`, `MATERIAL_DOCUMENT`, `STORAGE_ID` (39 cols total) | **confirmed-ddl 2026-05-17** |
