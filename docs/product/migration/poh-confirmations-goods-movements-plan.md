# POH Confirmations and Goods Movements — Native Databricks Plan

**Date:** 2026-05-17  
**Status:** DDL confirmed — implementation in progress  
**Principle:** DDL first. Implement only what confirmed Databricks views actually support.  

**Schema relaxation (2026-05-17):** Three required fields temporarily made optional in `ProcessOrderConfirmationSchema` / `ProcessOrderGoodsMovementSchema` because the gold views do not expose them:
- `operationText` — not in `vw_gold_confirmation`; can be re-required once a JOIN to `vw_gold_process_order_phase` is verified
- `isFinalConfirmation` — not in `vw_gold_confirmation`; re-require once upstream view exposes a final-confirmation flag
- `materialDescription` — not in `vw_gold_adp_movement`; re-require once material master join is available  
**References:** `docs/audit/native-databricks-column-verification-checklist.md`, `docs/migration/poh-native-depth-plan.md`

---

## Proven Baseline (as of 2026-05-17)

| Route | Status |
|-------|--------|
| `POST /api/por/order-header` | **browser-verified** — PO 7006965038 |
| `GET /api/por/order-operations` | **browser-verified** — 11 operations for PO 7006965038 |
| `GET /api/cq/lab/plants` | **browser-verified** |

Source views confirmed from live DDL:
- `vw_gold_process_order` — 6 columns confirmed
- `vw_gold_process_order_phase` — 9 columns confirmed

No SPN/PAT fallback exists. QuerySpec/QueryExecutor is the only native execution path.

---

## Slice 1: `getOrderConfirmations` — BLOCKED

**Contract:** `ProcessOrderConfirmation[]` (`packages/data-contracts/src/schemas/process-order-review.ts`)  
**Candidate view:** `connected_plant_uat.csm_process_order_history.vw_gold_confirmation`  
**Candidate route:** `GET /api/por/order-confirmations?process_order_id=...`

### Required contract fields

| Field | Required? | Notes |
|-------|-----------|-------|
| `confirmationId` | **required** | Stable identifier — may be AFBNR or derived |
| `operationId` | **required** | FK to phase/operation |
| `operationText` | **required** | Operation description |
| `confirmedYield` | **required** | Yield quantity |
| `uom` | **required** | Unit of measure |
| `confirmedAt` | **required** | ISO datetime — must be real, not defaulted |
| `isFinalConfirmation` | **required** | Boolean final-confirmation flag |
| `scrapQuantity` | optional | |
| `reworkQuantity` | optional | |
| `confirmedBy` | optional | |
| `setupDurationMinutes` | optional | |
| `machineDurationMinutes` | optional | |
| `cleaningDurationMinutes` | optional | |
| `variancePercent` | optional | |

### Minimum viable implementation criteria

To implement (not defer), `vw_gold_confirmation` must provide at minimum:
1. A stable row identifier (confirmationId)
2. A linkage to process order (`PROCESS_ORDER_ID` or equivalent)
3. A confirmed yield quantity and UOM
4. A confirmation timestamp

If any of these are absent, document as blocked.

### Blocker

`vw_gold_confirmation` DDL not captured. Cannot confirm any column names.

**Action required:** Run the DDL check SQL below, then update the column verification checklist.

---

## Slice 2: `getOrderGoodsMovements` — BLOCKED

**Contract:** `ProcessOrderGoodsMovement[]` (`packages/data-contracts/src/schemas/process-order-review.ts`)  
**Candidate view:** `connected_plant_uat.csm_process_order_history.vw_gold_adp_movement`  
**Candidate route:** `GET /api/por/order-goods-movements?process_order_id=...`

### Required contract fields

| Field | Required? | Notes |
|-------|-----------|-------|
| `movementId` | **required** | Stable identifier — may be MBLNR/ZEILE or derived |
| `movementType` | **required** | SAP BWART code (e.g. 101, 261) |
| `direction` | **required** | `'input'` or `'output'` — derived from movement type |
| `materialId` | **required** | MATNR — preserve leading zeros |
| `materialDescription` | **required** | Material short text |
| `quantity` | **required** | Movement quantity |
| `uom` | **required** | Unit of measure |
| `postedAt` | **required** | ISO datetime posting date |
| `batchId` | optional | CHARG |
| `postedBy` | optional | USNAM |
| `referenceDocument` | optional | AUFNR or source document |
| `storageLocation` | optional | LGORT |

### Movement type → direction mapping (if implemented)

| SAP BWART | Meaning | V2 direction |
|-----------|---------|-------------|
| 101 | Goods receipt from production | `output` |
| 261 | Goods issue to order | `input` |
| 102 | Reversal of 101 | `output` (reversal) |
| 262 | Reversal of 261 | `input` (reversal) |
| others | Unknown | document only, do not guess |

### Minimum viable implementation criteria

To implement (not defer), `vw_gold_adp_movement` must provide at minimum:
1. A linkage to process order
2. A material ID
3. A movement type (BWART or equivalent)
4. A quantity and UOM
5. A posting date

If `PROCESS_ORDER_ID` is not a column in the view, document the actual key column before implementing.

### Blocker

`vw_gold_adp_movement` DDL not captured. Cannot confirm any column names.

**Action required:** Run the DDL check SQL below, then update the column verification checklist.

---

## DDL Discovery SQL

Run these in the Databricks SQL editor (as the UAT user or a workspace admin):

```sql
-- Step 1: Confirm view exists and list all columns
DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_confirmation;

-- Step 2: Inspect sample rows for known process order
SELECT *
FROM connected_plant_uat.csm_process_order_history.vw_gold_confirmation
WHERE PROCESS_ORDER_ID = '7006965038'
LIMIT 20;

-- If PROCESS_ORDER_ID is not a column, find the linkage:
-- SELECT * FROM connected_plant_uat.csm_process_order_history.vw_gold_confirmation LIMIT 5;
```

```sql
-- Step 1: Confirm view exists and list all columns
DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_adp_movement;

-- Step 2: Inspect sample rows for known process order
SELECT *
FROM connected_plant_uat.csm_process_order_history.vw_gold_adp_movement
WHERE PROCESS_ORDER_ID = '7006965038'
LIMIT 50;

-- If PROCESS_ORDER_ID is not a column, find the linkage:
-- SELECT * FROM connected_plant_uat.csm_process_order_history.vw_gold_adp_movement LIMIT 5;
```

---

## Stop Conditions

Stop and document rather than implement if:
- The view does not exist
- The view has no rows for PO 7006965038
- The view cannot be linked to a process order
- A required field is absent and cannot be safely derived
- The mapper would require invented values
- SQL would need to go in a route or React component

---

## Implementation Order (once DDL confirmed)

1. `getOrderConfirmations` — confirm `vw_gold_confirmation` first
2. `getOrderGoodsMovements` — confirm `vw_gold_adp_movement` first
3. `getExecutionTimeline` — only after both above are proven in UAT

Each slice follows the established pattern:
- QuerySpec factory in `apps/api/adapters/poh/poh_databricks_adapter.py`
- Row mapper in same file
- Route in `apps/api/routes/process_order.py`
- Frontend override in `process-order-review-legacy-api-adapter.ts`
- Tests in `apps/api/tests/`
- Docs updated
