# Native Databricks Column Verification Checklist

**Date:** 2026-05-17 (updated — confirmations + movements DDL confirmed; all four POH slices implemented)
**Status:** POH header + operations + confirmations + goods movements columns confirmed-ddl; CQ lab plants confirmed-v1
**Reference:** ADR-025, `apps/api/adapters/poh/poh_databricks_adapter.py`, `apps/api/adapters/cq/cq_databricks_adapter.py`

**Legend:**
- `confirmed-ddl` — verified via `DESCRIBE TABLE` or `SHOW COLUMNS IN` in the live workspace
- `confirmed-v1` — field name confirmed from V1 source only (not Unity Catalog DDL)
- `assumed` — inferred from SAP naming convention or prior knowledge; not verified
- `missing` — expected field not found in any available source
- `blocked` — cannot verify until a prerequisite view/table exists

---

## POH — `getProcessOrderHeader`

**QuerySpec:** `poh.get_process_order_header` in `apps/api/adapters/poh/poh_databricks_adapter.py`
**Source view:** `connected_plant_uat.vw_gold_process_order`
**FastAPI route:** `POST /api/por/order-header`

Verify columns with:
```sql
DESCRIBE TABLE connected_plant_uat.vw_gold_process_order;
-- or
SELECT * FROM connected_plant_uat.vw_gold_process_order LIMIT 1;
```

| Contract field | SQL alias | Source column | Status | Verified date |
|---------------|-----------|--------------|--------|--------------|
| `processOrderId` | `process_order_id` | `PROCESS_ORDER_ID` | **confirmed-ddl** | 2026-05-17 |
| `orderType` | — | not in view | **missing** | 2026-05-17 |
| `materialId` | `material_id` | `MATERIAL_ID` | **confirmed-ddl** | 2026-05-17 |
| `materialDescription` | `material_description` | `MATERIAL_DESCRIPTION` | **confirmed-ddl** | 2026-05-17 |
| `plantId` | `plant_id` | `PLANT_ID` | **confirmed-ddl** | 2026-05-17 |
| `productionLine` | — | not in view | **missing** | 2026-05-17 |
| `plannedQuantity` | — | not in view | **missing** | 2026-05-17 |
| `uom` | — | not in view | **missing** | 2026-05-17 |
| `confirmedQuantity` | — | not in view | **missing** | 2026-05-17 |
| `plannedStart` | — | not in view | **missing** | 2026-05-17 |
| `plannedFinish` | — | not in view | **missing** | 2026-05-17 |
| `actualStart` | — | not in view | **missing** | 2026-05-17 |
| `actualFinish` | — | not in view | **missing** | 2026-05-17 |
| `orderStatus` | `order_status_raw` → mapped | `STATUS` | **confirmed-ddl** | 2026-05-17 |
| `inspectionLotId` | `inspection_lot_id` | `INSPECTION_LOT_ID` | **confirmed-ddl** | 2026-05-17 |

**DDL evidence:** `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_process_order` run 2026-05-17. Columns present: `PROCESS_ORDER_ID`, `STATUS`, `MATERIAL_ID`, `MATERIAL_DESCRIPTION`, `PLANT_ID`, `INSPECTION_LOT_ID`. Missing fields return empty/zero defaults by design until a richer view is available.

**Status mapping:** `STATUS` text values (e.g. `"IN PROGRESS"`, `"CLOSED"`) → V2 enum via `_ORDER_STATUS_MAP`. Browser-verified: `"CLOSED"` returned as `"closed"` for process order 7006965038 (2026-05-17).

---

## POH — `getOrderOperations`

**QuerySpec:** `poh.get_order_operations` in `apps/api/adapters/poh/poh_databricks_adapter.py`
**Source view:** `connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase`
**FastAPI route:** `GET /api/por/order-operations?process_order_id=...`

**DDL evidence:** `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase` run 2026-05-17. All columns below are confirmed-ddl.

| Contract field | SQL alias | Source column | Status | Verified date |
|---------------|-----------|--------------|--------|--------------|
| `operationId` | `operation_id` | `PROCESS_ORDER_PHASE_ID` | **confirmed-ddl** | 2026-05-17 |
| `operationNumber` | `operation_number` | `PHASE_ID` | **confirmed-ddl** | 2026-05-17 |
| `operationText` | `operation_text` | `PHASE_DESCRIPTION` | **confirmed-ddl** | 2026-05-17 |
| `workCentre` | — | not in view | **missing** | 2026-05-17 |
| `plannedStart` | — | not in view | **missing** | 2026-05-17 |
| `plannedFinish` | — | not in view | **missing** | 2026-05-17 |
| `plannedDurationMinutes` | — | not in view | **missing** | 2026-05-17 |
| `status` | inferred | `START_USER` + `END_USER` | **confirmed-ddl** | 2026-05-17 |
| `confirmationStatus` | inferred | `START_USER` + `END_USER` | **confirmed-ddl** | 2026-05-17 |
| `confirmed` | inferred | `END_USER` presence | **confirmed-ddl** | 2026-05-17 |
| `hasException` | — | not in view | **missing** | 2026-05-17 |

**Status inference logic:** `END_USER` populated → `confirmed` / `final-confirmed`; `START_USER` only → `in-progress` / `partially-confirmed`; neither → `pending` / `unconfirmed`. This is a conservative inference, not a direct SAP status field.

**Browser verification:** PASSED 2026-05-17 — 11 operations returned for PO 7006965038; `X-Data-Source: databricks-api` and `X-Query-Name: poh.get_order_operations` confirmed in response headers.

---

## POH — `getOrderConfirmations`

**QuerySpec:** `poh.get_order_confirmations` in `apps/api/adapters/poh/poh_databricks_adapter.py`
**Source view:** `connected_plant_uat.csm_process_order_history.vw_gold_confirmation`
**FastAPI route:** `GET /api/por/order-confirmations?process_order_id=...`
**Implementation status:** Implemented 2026-05-17 — executable, **not yet browser-verified**

**DDL evidence:** `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_confirmation` run 2026-05-17. View has 16 columns.

| Contract field | SQL alias | Source column | Status | Notes |
|---------------|-----------|--------------|--------|-------|
| `confirmationId` | `confirmation_id` | `CONFIRMATION_ID` | **confirmed-ddl** | 2026-05-17 |
| `operationId` | `operation_id` | `PROCESS_ORDER_PHASE_ID` | **confirmed-ddl** | 2026-05-17 — matches `getOrderOperations` operationId key |
| `operationText` | — | not in view | **missing — schema relaxed to optional** | No description column; re-require when view exposes PHASE_DESCRIPTION join |
| `confirmedYield` | `confirmed_yield` | `CONFIRMED_QUANTITY` | **confirmed-ddl** | 2026-05-17 — decimal(13,3) cast to float |
| `uom` | `uom` | `CONFIRMED_QUANTITY_UOM` | **confirmed-ddl** | 2026-05-17 |
| `confirmedAt` | `confirmed_at` | `COALESCE(END_TIMESTAMP, START_TIMESTAMP, __CREATED_ON)` | **confirmed-ddl** | 2026-05-17 — coalesce guards against null END_TIMESTAMP on in-progress confirmations |
| `isFinalConfirmation` | — | not in view | **missing — schema relaxed to optional** | No final-confirmation flag; re-require when view exposes it |
| `scrapQuantity` | — | not in view | optional — missing | |
| `reworkQuantity` | — | not in view | optional — missing | |
| `confirmedBy` | — | not in view | optional — missing | |
| `setupDurationMinutes` | `setup_duration_s` ÷ 60 | `SET_UP_DURATION_S` | **confirmed-ddl** | 2026-05-17 — int seconds converted to float minutes |
| `machineDurationMinutes` | `machine_duration_s` ÷ 60 | `MACHINE_DURATION_S` | **confirmed-ddl** | 2026-05-17 |
| `cleaningDurationMinutes` | `cleaning_duration_s` ÷ 60 | `CLEANING_DURATION_S` | **confirmed-ddl** | 2026-05-17 |
| `variancePercent` | — | not in view | optional — missing | |

**Additional confirmed columns (not in contract, not selected):** `PHASE_ID`, `PLANT_ID`, `GROSS_DURATION_S`, `__BATCH_ID`, `__CREATED_ON`, `__UPDATED_ON`

**Schema relaxations (2026-05-17):** `operationText` and `isFinalConfirmation` changed from `z.string()` / `z.boolean()` to `.optional()` in `ProcessOrderConfirmationSchema`. Re-require once the upstream view exposes these fields.

---

## POH — `getOrderGoodsMovements`

**QuerySpec:** `poh.get_order_goods_movements` in `apps/api/adapters/poh/poh_databricks_adapter.py`
**Source view:** `connected_plant_uat.csm_process_order_history.vw_gold_adp_movement`
**FastAPI route:** `GET /api/por/order-goods-movements?process_order_id=...`
**Implementation status:** Implemented 2026-05-17 — executable, **not yet browser-verified**

**DDL evidence:** `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_adp_movement` run 2026-05-17. View has 39 columns (ADP / Tulip movements — not standard SAP MIGO).

| Contract field | SQL alias | Source column | Status | Notes |
|---------------|-----------|--------------|--------|-------|
| `movementId` | `movement_id` | `ID` | **confirmed-ddl** | 2026-05-17 |
| `movementType` | `movement_type` | `MOVEMENT_TYPE` | **confirmed-ddl** | 2026-05-17 — Tulip codes, not standard SAP BWART |
| `direction` | derived | `MOVEMENT_TYPE` via map | **confirmed-ddl** | 2026-05-17 — mapped codes: 101→output, 261→input, 262→input, 531→output; 711/712/999/null → direction absent |
| `materialId` | `material_id` | `MATERIAL_ID` | **confirmed-ddl** | 2026-05-17 — string; leading zeros preserved |
| `materialDescription` | — | not in view | **missing — schema relaxed to optional** | No material master join in this view; re-require when available |
| `quantity` | `quantity` | `QUANTITY` | **confirmed-ddl** | 2026-05-17 — decimal(18,6) cast to float |
| `uom` | `uom` | `UOM` | **confirmed-ddl** | 2026-05-17 |
| `postedAt` | `posted_at` | `DATE_TIME_OF_ENTRY` | **confirmed-ddl** | 2026-05-17 — timestamp |
| `batchId` | `batch_id` | `BATCH_ID` | **confirmed-ddl** | 2026-05-17 — optional; omitted when null |
| `postedBy` | `posted_by` | `USER` | **confirmed-ddl** | 2026-05-17 — optional; omitted when null |
| `referenceDocument` | `reference_document` | `MATERIAL_DOCUMENT` | **confirmed-ddl** | 2026-05-17 — optional; omitted when null |
| `storageLocation` | `storage_location` | `STORAGE_ID` | **confirmed-ddl** | 2026-05-17 — optional; omitted when null |

**Confirmed MOVEMENT_TYPE values (from `SELECT DISTINCT MOVEMENT_TYPE, MOVEMENT, ITEM_TYPE`, 2026-05-17):**

| MOVEMENT_TYPE | MOVEMENT | ITEM_TYPE | direction |
|---|---|---|---|
| 101 | Goods Receipts | — | `output` |
| 261 | Goods Issues | — | `input` |
| 261 | Unplanned Goods Issues | — | `input` |
| 262 | Goods Issues | — | `input` |
| 531 | Goods Receipts | B (by-product) | `output` |
| 711 | Write-On/Off | — | unmapped — direction ambiguous |
| 712 | Write-On/Off | — | unmapped — direction ambiguous |
| 999 | — | Goods Movements | unmapped |
| null | Productions / Write-On/Off / null | — | unmapped |

Rows with unmapped MOVEMENT_TYPE return `direction: "unknown"` and are included in the response — never dropped. Frontend renders them as "Unclassified" with a grey badge. These are Tulip ADP movements, not standard SAP MIGO.

**Schema relaxation (2026-05-17):** `materialDescription` changed from `z.string()` to `.optional()` in `ProcessOrderGoodsMovementSchema`. Re-require once a material master join is available.

---

## CQ Lab — `getLabPlants`

**QuerySpec:** `cq.get_lab_plants` in `apps/api/adapters/cq/cq_databricks_adapter.py`
**Source table:** `` `{CQ_CATALOG}`.`gold`.`gold_plant` `` (e.g. `connected_plant_uat.gold.gold_plant`)
**FastAPI route:** `GET /api/cq/lab/plants`

Verify columns with:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_plant;
-- or
SELECT * FROM connected_plant_uat.gold.gold_plant LIMIT 5;
```

| Contract field | SQL alias | Source column | Status | Verified date |
|---------------|-----------|--------------|--------|--------------|
| `plantId` | `plant_id` | `PLANT_ID` | **confirmed-v1** | 2026-05-17 |
| `plantName` | `plant_name` | `PLANT_NAME` | **confirmed-v1** | 2026-05-17 |

**Confirmation source:** V1 DAL query — `` SELECT PLANT_ID AS plant_id, PLANT_NAME AS plant_name FROM `{CQ_CATALOG}`.`gold`.`gold_plant` WHERE PLANT_ID IS NOT NULL ORDER BY PLANT_ID ``.

**Verification SQL to run (live DDL confirmation):**
```sql
-- Step 1: confirm columns
DESCRIBE TABLE connected_plant_uat.gold.gold_plant;

-- Step 2: test the full query
SELECT
    PLANT_ID   AS plant_id,
    PLANT_NAME AS plant_name
FROM connected_plant_uat.gold.gold_plant
WHERE PLANT_ID IS NOT NULL
ORDER BY PLANT_ID
LIMIT 100;
```

---

## Trace — QuerySpec-only slices (route not wired)

These slices have QuerySpec factories in `apps/api/adapters/trace/` but no FastAPI route wiring yet. Column names are not confirmed.

### `getBatchHeaderSummary`

**Source view:** `gold_batch_summary_v` (assumed) in `csm_process_order_history` or equivalent
**QuerySpec:** `trace.get_batch_header_summary`

| Contract field | Assumed source column | Status |
|---------------|----------------------|--------|
| `batchId` | `charg` | **assumed** |
| `materialId` | `matnr` | **assumed** |
| `materialDescription` | `maktx` | **assumed** |
| `plantId` | `werks` | **assumed** |
| `status` | (view-specific) | **assumed** |
| `quantity` | (view-specific) | **assumed** |

### `getTraceGraph` (depth=1)

**Source view:** `gold_batch_lineage`

| Contract field | Assumed source column | Status |
|---------------|----------------------|--------|
| Node/edge structure | (view-specific) | **assumed** |

### `getMassBalanceSummary`

**Source view:** `gold_batch_mass_balance_v`

| Contract field | Assumed source column | Status |
|---------------|----------------------|--------|
| Input/output quantities | (view-specific) | **assumed** |

---

## How to update this checklist

When a column is verified:

1. Run `DESCRIBE TABLE <catalog>.<schema>.<view>` in the Databricks workspace.
2. Confirm the column name matches the SQL alias in the QuerySpec.
3. Update the `Status` column to `confirmed-ddl` and add the `Verified date`.
4. If a column name differs from the assumed value, update the `poh_databricks_adapter.py` or `cq_databricks_adapter.py` SQL.
5. Remove the `-- TODO: verify` comment from the SQL in the adapter file.
6. Re-run tests: `python -m pytest apps/api/tests/ -q`.

Do not mark any field `confirmed-ddl` unless you have run the DDL command and seen the column name in the output. Do not infer from V1 field names alone.
