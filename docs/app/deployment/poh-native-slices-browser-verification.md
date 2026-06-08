# POH Native Slices — Browser Verification Checklist

**Date:** 2026-05-17  
**Status:** C7 (order-operations) PASSED 2026-05-17; C8 (confirmations) PASSED 2026-05-18; C9 (goods-movements) PASSED 2026-05-18  
**App URL:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`  
**Reference:** `docs/audit/adapter-source-status-matrix.md`

---

## Prerequisites

Before running any check:
- UAT app must be RUNNING: `databricks apps get connectio-v2` → state = RUNNING
- `BACKEND_ADAPTER_MODE=databricks-api` confirmed in `apps/api/app.yaml`
- Authenticated as a Databricks user with `sql` scope in `effective_user_api_scopes`
- Browser DevTools → Network panel open

---

## 1. `GET /api/por/order-operations` — PASSED 2026-05-17

**UI route:** Navigate to a process order in Process Order Review, then to the Operations/Phases tab.

**Direct API call (DevTools or curl):**
```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-operations?process_order_id=7006965038
```
No request body required. OAuth cookie/header forwarded automatically by the browser when using the Databricks Apps URL.

**Expected response headers:**
```
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_order_operations
```

**Expected response body shape:**
```json
[
  {
    "operationId": "<string — from PROCESS_ORDER_PHASE_ID>",
    "operationNumber": "<string — from PHASE_ID e.g. '0010'>",
    "operationText": "<string — from PHASE_DESCRIPTION>",
    "workCentre": "",
    "plannedStart": "",
    "plannedFinish": "",
    "plannedDurationMinutes": 0,
    "status": "pending" | "in-progress" | "confirmed",
    "confirmationStatus": "unconfirmed" | "partially-confirmed" | "final-confirmed",
    "confirmed": true | false,
    "hasException": false
  }
]
```

**Known acceptable gaps:**
- `workCentre`, `plannedStart`, `plannedFinish`, `plannedDurationMinutes`, `hasException` will be empty/zero — this is by design, not an error. `vw_gold_process_order_phase` does not expose these columns.
- An empty array `[]` is a valid response if process order 7006965038 has no phase rows in the view.

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_operations` header present
- [ ] Response is a JSON array (may be empty)
- [ ] If non-empty: `operationId`, `operationNumber`, `operationText` are non-empty strings
- [ ] No 401/403/502/503

**Manual result:**

| Status | Date | Notes |
|--------|------|-------|
| [x] passed | 2026-05-17 | 11 operations returned for PO 7006965038; `x-data-source: databricks-api`; `x-query-name: poh.get_order_operations` |
| [ ] failed 401 | | |
| [ ] failed 403 | | |
| [ ] failed 502 | | |
| [ ] failed 503 | | |
| [ ] failed 504 | | |

---

---

## 2. `GET /api/por/order-confirmations` — BROWSER-VERIFIED 2026-05-18

**Status: PASSED** — HTTP 200 confirmed in UAT 2026-05-18.

**UI navigation path:** Would appear in the Execution Timeline view → Confirmations panel (`OrderConfirmationsPanel`).

**Direct API call:**
```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-confirmations?process_order_id=7006965038
```

**Expected response headers:**
```
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_order_confirmations
```

**Expected response body shape:**
```json
[
  {
    "confirmationId": "<string — from CONFIRMATION_ID>",
    "operationId": "<string — from PROCESS_ORDER_PHASE_ID>",
    "confirmedYield": "<number — from CONFIRMED_QUANTITY>",
    "uom": "<string — from CONFIRMED_QUANTITY_UOM>",
    "confirmedAt": "<ISO datetime — from COALESCE(END_TIMESTAMP, START_TIMESTAMP, __CREATED_ON)>",
    "setupDurationMinutes": "<number — SET_UP_DURATION_S ÷ 60, if not null>",
    "machineDurationMinutes": "<number — MACHINE_DURATION_S ÷ 60, if not null>",
    "cleaningDurationMinutes": "<number — CLEANING_DURATION_S ÷ 60, if not null>"
  }
]
```

**Known acceptable gaps (not errors):**
- `operationText` — absent from `vw_gold_confirmation`; field omitted from response; schema relaxed to optional
- `isFinalConfirmation` — absent from `vw_gold_confirmation`; field omitted from response; schema relaxed to optional
- `scrapQuantity`, `reworkQuantity`, `confirmedBy`, `variancePercent` — absent from view; optional fields omitted

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_confirmations` header present
- [ ] Response is a JSON array (may be empty)
- [ ] If non-empty: `confirmationId`, `operationId`, `confirmedYield`, `uom`, `confirmedAt` are present
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|--------|-------------|-----|
| 401 | OAuth token missing or `sql` scope not in user token | Re-deploy bundle |
| 403 | User lacks SELECT on `vw_gold_confirmation` | `GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_confirmation TO <user>` |
| 503 | `BACKEND_ADAPTER_MODE` not `databricks-api` | Check `app.yaml` |
| 502 | Databricks query error | Check `databricks apps logs connectio-v2` |

**Manual result:**

| Status | Date | Notes |
|--------|------|-------|
| [x] **PASSED** | 2026-05-18 | HTTP 200, 2.6s. PO=7006967130 → 2 confirmations. `confirmationId=100001669`, `confirmedYield=646.88 KG`. `X-Data-Source: databricks-api`, `X-Query-Name: poh.get_order_confirmations`. |

---

## 3. `GET /api/por/order-goods-movements` — BROWSER-VERIFIED 2026-05-18

**Status: PASSED** — HTTP 200 confirmed in UAT 2026-05-18.

**UI navigation path:** Would appear in the Execution Timeline view → Goods Movements panel (`ProcessOrderGoodsMovementsPanel`).

**Direct API call:**
```
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-goods-movements?process_order_id=7006965038
```

**Expected response headers:**
```
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_order_goods_movements
```

**Expected response body shape:**
```json
[
  {
    "movementId": "<string — from ID>",
    "movementType": "<string — Tulip code e.g. '101', '261', '531'>",
    "direction": "input" | "output" | "unknown",
    "materialId": "<string — from MATERIAL_ID; leading zeros preserved>",
    "quantity": "<number — from QUANTITY>",
    "uom": "<string — from UOM>",
    "postedAt": "<ISO datetime — from DATE_TIME_OF_ENTRY>",
    "batchId": "<string — if present>",
    "postedBy": "<string — if present>",
    "referenceDocument": "<string — if present>",
    "storageLocation": "<string — if present>"
  }
]
```

**Known acceptable gaps (not errors):**
- `materialDescription` — absent from `vw_gold_adp_movement` (no material master join); field omitted from response; schema relaxed to optional
- Rows with MOVEMENT_TYPE 711, 712, 999, or null return `direction: "unknown"` and are displayed in the panel as "unclassified"
- An empty array is valid if PO 7006965038 has no movements at all

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_goods_movements` header present
- [ ] Response is a JSON array (may be empty)
- [ ] If non-empty: `movementId`, `movementType`, `direction`, `materialId`, `quantity`, `uom`, `postedAt` are present
- [ ] `direction` is `"input"`, `"output"`, or `"unknown"` for all items
- [ ] If any `direction: "unknown"` rows: panel shows grey `?` badge and "N unclassified" count
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Likely cause | Fix |
|--------|-------------|-----|
| 401 | OAuth token missing or `sql` scope not in user token | Re-deploy bundle |
| 403 | User lacks SELECT on `vw_gold_adp_movement` | `GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_adp_movement TO <user>` |
| 503 | `BACKEND_ADAPTER_MODE` not `databricks-api` | Check `app.yaml` |
| 502 | Databricks query error | Check `databricks apps logs connectio-v2` |
| All movements `direction: "unknown"` | PO 7006965038 only has 711/712/999/null movement types | Extend `_MOVEMENT_DIRECTION_MAP` when direction is confirmed; panel shows "N unclassified" |
| Empty array | No movements at all for this PO | Verify PO has been processed using Tulip ADP |

**Manual result:**

| Status | Date | Notes |
|--------|------|-------|
| [x] **PASSED** | 2026-05-18 | HTTP 200, 1.6s. PO=7006965479 → 901 movements. `direction=input` confirmed for MOVEMENT_TYPE=261. `X-Data-Source: databricks-api`, `X-Query-Name: poh.get_order_goods_movements`. |

---

## Troubleshooting

| Status | Likely cause | Fix |
|--------|-------------|-----|
| 401 | OAuth token missing or `sql` scope not in user token | Run `databricks bundle deploy --target uat` to re-apply `user_api_scopes: [sql]` |
| 403 | User lacks SELECT on `vw_gold_process_order_phase` | Grant: `GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase TO <user>` |
| 503 (databricks-api message) | `BACKEND_ADAPTER_MODE` is not `databricks-api` | Check `apps/api/app.yaml` env section |
| 503 (DATABRICKS_HOST) | `DATABRICKS_HOST` or `SQL_WAREHOUSE_ID` not set | Check `apps/api/app.yaml` literals |
| 502 | Databricks SQL warehouse unreachable or query error | Check `databricks apps logs connectio-v2` for exception details |
| Empty array | Process order 7006965038 has no phases in `vw_gold_process_order_phase` | Try another process order, or run `SELECT COUNT(*) FROM connected_plant_uat.csm_process_order_history.vw_gold_process_order_phase WHERE PROCESS_ORDER_ID = '7006965038'` in the workspace |

---

## Already verified (for reference)

| Route | Status | Date | Process order |
|-------|--------|------|--------------|
| `POST /api/por/order-header` | **PASS** | 2026-05-17 | 7006965038 |
| `GET /api/cq/lab/plants` | **PASS** | 2026-05-17 | N/A |
