# Process Order History / Manufacturing Operations Investigation Screen Notes

This document provides a concise catalog of existing POH native integrations, routes, adapters, and the UAT validation boundaries as of May 18, 2026.

## 1. Existing Native Backend Routes
FastAPI endpoints registered under `apps/api/routes/process_order.py`:
- `POST /api/por/order-header`: Fetches process order header metadata. Supports `legacy-api` (upstream proxy) and `databricks-api` (native Databricks Unity Catalog query).
- `GET /api/por/order-operations`: Fetches operation phases. Supports `databricks-api` only (throws 503 in other modes).
- `GET /api/por/order-confirmations`: Fetches confirmed operation yields. Supports `databricks-api` only.
- `GET /api/por/order-goods-movements`: Fetches raw material receipts and issues. Supports `databricks-api` only.

## 2. Existing Frontend Adapter Methods
In `ProcessOrderReviewLegacyApiAdapter` (`domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts`):
- `getProcessOrderHeader(request)`: Calls `POST /api/por/order-header`.
- `getOrderOperations(request)`: Calls `GET /api/por/order-operations`.
- `getOrderConfirmations(request)`: Calls `GET /api/por/order-confirmations`.
- `getOrderGoodsMovements(request)`: Calls `GET /api/por/order-goods-movements`.

## 3. Existing Mock-Only Areas
Methods inside `ProcessOrderReviewAdapter` that only return mock data and lack native backend proxy mappings:
- `getProcessOrderReviewContext(request)`
- `getOrderProgressSummary(request)`
- `getExecutionTimeline(request)`
- `getOrderQualityContext(request)`
- `getOrderStagingContext(request)`
- `getRelatedBatchContext(request)`

## 4. Existing Source Objects
Unity Catalog (UC) tables and views referenced by native backend queries:
- `connected_plant_uat.csm_process_order_history.vw_gold_process_order` (Header data)
- `connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase` (Operations phases)
- `connected_plant_uat.csm_process_order_history.vw_gold_confirmation` (Confirmations)
- `connected_plant_uat.csm_process_order_history.vw_gold_adp_movement` (Goods movements)

## 5. Current Workspace Route
- Workspace ID: `process-order-review`
- URL Context Parameter: `?workspace=process-order-review`
- Default view is set to `order-history`.

## 6. What Can Be Built Safely Without UAT
- Reusable, robust `ProcessOrderQueryForm` with input validations, limit slider (1-500), and demo preset buttons.
- A fully populated read-only Cockpit view with derived metrics (movement totals, mixed UOM verification, distinct batches/materials).
- Interactive timeline derived directly from loaded operations, confirmations, and goods movements (omitting invented events).
- Exception and Data Quality diagnostics panel showing unclassified movements, missing batches, or blank dates.
- Collapsible technical detail drawers showing actual URLs called and payloads.
- Local mock presets allowing full offline review.
- High-coverage Vitest tests asserting on sorting logic, forms, and mappings.

## 7. What Must Wait for Claude / UAT Verification
- End-to-end browser smoke testing against a live Databricks environment.
- Resolution of Databricks config settings (e.g. real OAuth login redirection, user credentials).
- Restoring schema requirements to optional/nullable fields if Claude discovers those columns were omitted or populated in UAT.
