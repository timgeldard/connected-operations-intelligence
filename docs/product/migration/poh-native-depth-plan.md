# POH Native Databricks Depth Plan

**Date:** 2026-05-17  
**Status:** `getOrderOperations` implemented; confirmations + movements blocked pending DDL  
**References:** ADR-024, `docs/audit/adapter-source-status-matrix.md`, `docs/audit/native-databricks-column-verification-checklist.md`

---

## Proven Baseline (as of 2026-05-17)

| Fact | Status |
|------|--------|
| V2 app deployed to UAT | RUNNING — `https://connectio-v2-604667594731808.8.azure.databricksapps.com` |
| `BACKEND_ADAPTER_MODE` | `databricks-api` |
| End-user OAuth headers | Confirmed — `x-forwarded-access-token`, `x-forwarded-user`, `x-forwarded-email` |
| `user_api_scopes: sql` | Set in `databricks.yml` and confirmed in `effective_user_api_scopes` |
| Statement API read path | Browser-verified — CQ plants and POH order header |
| `GET /api/cq/lab/plants` | Browser-verified 2026-05-17 |
| `POST /api/por/order-header` | Browser-verified 2026-05-17 with PO 7006965038 |
| No SPN/PAT fallback | Confirmed in logs — zero service_principal/client_secret/DATABRICKS_TOKEN entries |
| SQL only in QuerySpec | Confirmed — no SQL in routes or React |
| QuerySpec/QueryExecutor only path | Confirmed |

---

## Selected Slices

### A. `getOrderOperations` — IMPLEMENTED (2026-05-17)

**Panel:** `OrderOperationsPanel` in Execution Timeline view  
**Contract:** `ProcessOrderOperation[]`  
**Source view:** `vw_gold_process_order_phase`  
**Route:** `GET /api/por/order-operations?process_order_id=...` (databricks-api only)  
**Frontend:** `ProcessOrderReviewLegacyApiAdapter.getOrderOperations`

**DDL-confirmed columns:** `PROCESS_ORDER_PHASE_ID`, `PHASE_ID`, `PHASE_DESCRIPTION`, `PHASE_TEXT`, `OPERATION_QUANTITY`, `OPERATION_QUANTITY_UOM`, `SORT_NUMBER`, `START_USER`, `END_USER`

**Known gaps (returned as empty/zero — not faked):**
- `workCentre` → `""`
- `plannedStart` → `""`
- `plannedFinish` → `""`
- `plannedDurationMinutes` → `0`
- `hasException` → `false`

**Status/confirmationStatus inference:** conservative — derived from START_USER/END_USER presence only.

**Browser verification:** PENDING. Use PO 7006965038.

---

### B. `getOrderConfirmations` — DEFERRED (BLOCKED)

**Blocker:** `vw_gold_confirmation` DDL not captured. Column names unknown.  
**Action:** Run `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_confirmation`.  
**Do not implement until columns are confirmed-ddl.**

---

### C. `getOrderGoodsMovements` — DEFERRED (BLOCKED)

**Blocker:** `vw_gold_adp_movement` DDL not captured. Column names unknown.  
**Action:** Run `DESCRIBE TABLE connected_plant_uat.csm_process_order_history.vw_gold_adp_movement`.  
**Additional risk:** `movementCategory` (input/output/receipt/issue) may require BWART code mapping — confirm BWART values in the view before implementing the category map.  
**Do not implement until columns are confirmed-ddl.**

---

### D. `getExecutionTimeline` — DEFERRED

**Blocker:** `vw_gold_process_order_phase` has no date columns. Timeline events cannot be constructed without `plannedStart`/`plannedFinish` from operations, confirmation timestamps, or movement posting dates.  
**Deferred until B and C are implemented and confirmed.**

---

## Implementation Order

1. ~~`getOrderOperations`~~ — **DONE 2026-05-17**
2. `getOrderConfirmations` — next, once `vw_gold_confirmation` DDL confirmed
3. `getOrderGoodsMovements` — after confirmations, once `vw_gold_adp_movement` DDL confirmed
4. `getExecutionTimeline` — after all three above are working in UAT

---

## Files Changed (operations slice)

| File | Change |
|------|--------|
| `apps/api/adapters/poh/poh_databricks_adapter.py` | Fix endpoint bug; add `PROCESS_ORDER_PHASE_ID` to SQL; add `map_order_operations_rows` |
| `apps/api/routes/process_order.py` | Add `GET /api/por/order-operations` route |
| `apps/api/tests/adapters/poh/test_poh_databricks_adapter.py` | Fix endpoint test; add `TestMapOrderOperationsRows` (27 tests) |
| `apps/api/tests/routes/test_process_order_routes.py` | Add `TestOrderOperationsDatabricksMode` (8 tests) |
| `domain-integrations/operations/src/adapters/process-order-review-legacy-api-adapter.ts` | Add `getOrderOperations` override |
| `docs/audit/adapter-source-status-matrix.md` | Updated |
| `docs/audit/native-databricks-column-verification-checklist.md` | POH header confirmed-ddl; operations confirmed-ddl; confirmations/movements blocked |
| `docs/audit/native-databricks-execution-readiness.md` | Route table updated; test count updated |
| `docs/migration/databricks-vertical-slices-poh-next.md` | New — candidate analysis |
| `docs/deployment/poh-native-slices-browser-verification.md` | New — browser verification checklist |

---

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Full `apps/api` pytest | 360 | **All passing** |
| `di-operations` typecheck | — | **Pass** |

---

## Browser Verification Still Required

| Route | Sample PO | Status |
|-------|-----------|--------|
| `GET /api/por/order-operations` | 7006965038 | **NOT YET VERIFIED** |

See `docs/deployment/poh-native-slices-browser-verification.md` for the full checklist.

---

## Databricks Grants That May Be Required

If browser verification returns 403:
```sql
GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase
  TO `<user-email>`;
```

If `getOrderConfirmations` is unblocked:
```sql
GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_confirmation
  TO `<user-email>`;
```

If `getOrderGoodsMovements` is unblocked:
```sql
GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_adp_movement
  TO `<user-email>`;
```

---

## No SPN/PAT Fallback Confirmation

All implemented routes require an active end-user OAuth token. No service-principal token, PAT, or `DATABRICKS_TOKEN` environment variable is used. If OAuth is absent: HTTP 401. No silent fallback to legacy-api or mock.
