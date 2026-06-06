# Browser Verification Backlog

**Date:** 2026-05-17  
**App URL:** `https://connectio-v2-604667594731808.8.azure.databricksapps.com`  
**Status:** UAT RUNNING — `BACKEND_ADAPTER_MODE=databricks-api`  
**Test anchor:** material_id=000000000020052009, batch_id=0008602411, process_order_id=7006965038

A route is "browser-verified" only when manually tested in a live UAT browser session and the result is recorded here. Do not mark any route as passed based on test-suite passes or code review alone.

---

## Priority 1 — Executable (code complete, DDL confirmed, immediate)

These routes are fully implemented and DDL-confirmed. No implementation work required. Test in order.

### BV-01 — GET /api/por/order-confirmations

**Status:** [ ] not yet verified  
**Prerequisite:** UAT app RUNNING; authenticated as Databricks user with `sql` scope

```http
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-confirmations?process_order_id=7006965038
```

**Expected response headers:**
```http
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_order_confirmations
```

**Expected response body shape:**
```json
[
  {
    "confirmationId": "<string>",
    "operationId": "<string>",
    "confirmedYield": <number>,
    "uom": "<string>",
    "confirmedAt": "<ISO 8601 string>",
    "setupDurationMinutes": <number or absent>,
    "machineDurationMinutes": <number or absent>,
    "cleaningDurationMinutes": <number or absent>
  }
]
```

**Note:** `operationText` and `isFinalConfirmation` are absent by design — not in `vw_gold_confirmation`.

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_confirmations` header present
- [ ] Response is a JSON array (may be empty if PO has no confirmations)
- [ ] Each item has `confirmationId`, `operationId`, `confirmedYield`, `uom`, `confirmedAt`
- [ ] No 401/403/502/503

**Manual result:**

| Status | Date | Row count | Notes |
|---|---|---|---|
| [ ] not yet tested | — | — | — |

---

### BV-02 — GET /api/por/order-goods-movements

**Status:** [ ] not yet verified  
**Prerequisite:** BV-01 not required first, but run in sequence

```http
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-goods-movements?process_order_id=7006965038
```

**Expected response headers:**
```http
X-Data-Source: databricks-api
X-Adapter-Mode: databricks-api
X-Query-Name: poh.get_order_goods_movements
```

**Expected response body shape:**
```json
[
  {
    "movementId": "<string>",
    "movementType": "101" | "261" | "262" | "531" | "711" | "712" | "999" | "",
    "direction": "input" | "output" | "unknown",
    "materialId": "<string>",
    "quantity": <number>,
    "uom": "<string>",
    "postedAt": "<ISO 8601 string>",
    "batchId": "<string or absent>",
    "postedBy": "<string or absent>",
    "referenceDocument": "<string or absent>",
    "storageLocation": "<string or absent>"
  }
]
```

**Note:** `materialDescription` is absent by design — no material master join in `vw_gold_adp_movement`. `direction: 'unknown'` is valid and expected for MOVEMENT_TYPE 711/712/999/null.

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_goods_movements` header present
- [ ] Response is a JSON array
- [ ] All `direction` values are `"input"`, `"output"`, or `"unknown"` — never null
- [ ] All `movementId` values are non-empty strings
- [ ] `materialId` values preserve leading zeros (string, not numeric)
- [ ] No 401/403/502/503

**Manual result:**

| Status | Date | Row count | Unknown-direction rows | Notes |
|---|---|---|---|---|
| [ ] not yet tested | — | — | — | — |

---

## Priority 2 — DDL Verification Required First

These routes cannot be wired until DDL verification completes. After DDL is confirmed and routes are implemented, add browser verification steps here.

### BV-03 — POST /api/trace2/batch-header (databricks-api)

**Status:** [ ] not yet implemented — blocked on DDL  
**Prerequisite:** Complete `docs/audit/trace-native-column-verification-checklist.md` (items 1–2)

When implemented:
```http
POST .../api/trace2/batch-header
Content-Type: application/json
{ "material_id": "000000000020052009", "batch_id": "0008602411" }
```
Expected: `X-Query-Name: trace2.get_batch_header_summary`  
Pass checklist: see `docs/deployment/trace-native-browser-verification.md` (Check T1)

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] blocked — DDL unverified | — | Run DESCRIBE TABLE gold_batch_summary_v |

---

### BV-04 — POST /api/trace2/trace-graph (depth=1)

**Status:** [ ] not yet implemented — blocked on DDL and BV-03  
**Prerequisite:** BV-03 must pass first (language_id confirmed as part of BV-03 work)

When implemented:
```http
POST .../api/trace2/trace-graph
Content-Type: application/json
{ "material_id": "000000000020052009", "batch_id": "0008602411" }
```
Expected: `X-Query-Name: trace2.get_trace_graph`  
Pass checklist: see `docs/deployment/trace-native-browser-verification.md` (Check T2)

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] blocked — BV-03 prerequisite | — | — |

---

### BV-05 — POST /api/trace2/mass-balance

**Status:** [ ] not yet implemented — blocked on WHERE column DDL  
**Prerequisite:** `DESCRIBE TABLE gold_batch_mass_balance_v` confirms WHERE column names

When implemented:
```http
POST .../api/trace2/mass-balance
Content-Type: application/json
{ "material_id": "000000000020052009", "batch_id": "0008602411" }
```
Expected: `X-Query-Name: trace2.get_mass_balance`  
Pass checklist: see `docs/deployment/trace-native-browser-verification.md` (Check T3)

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] blocked — DDL unverified | — | Run DESCRIBE TABLE gold_batch_mass_balance_v |

---

## Priority 3 — V1 Restart Required (Legacy-Api Routes)

These routes are V1 proxies that have never been browser-verified in the current deployment. Run only after V1 apps are restarted.

### BV-06 — POST /api/trace2/batch-header (legacy-api)

**Status:** [ ] not yet verified (V1 STOPPED)

```http
POST .../api/trace2/batch-header
Content-Type: application/json
{ "material_id": "000000000020052009", "batch_id": "0008602411" }
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] Response shape matches `BatchHeaderSummarySchema`
- [ ] `X-Data-Source` absent or `legacy-api` (V1 proxy does not set this header currently)

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] blocked — V1 STOPPED | — | — |

---

### BV-07 — GET /api/cq/lab/fails (legacy-api)

**Status:** [ ] not yet verified (V1 STOPPED)

```http
GET .../api/cq/lab/fails?plant_id=C061
```

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] blocked — V1 STOPPED | — | Also blocked for databricks-api: vw_gold_process_order_plan missing |

---

### BV-08 — POST /api/wh360/warehouse-summary (legacy-api)

**Status:** [ ] not yet verified (V1 STOPPED)

```http
POST .../api/wh360/warehouse-summary
Content-Type: application/json
{ "plant_id": "C061" }
```

**Manual result:**

| Status | Date | Notes |
|---|---|---|
| [ ] blocked — V1 STOPPED | — | V1 restart required |

---

## Completed Verifications

| Route | Method | Domain | Verified | Notes |
|---|---|---|---|---|
| `GET /api/cq/lab/plants` | GET | CQ Lab | 2026-05-17 | `X-Data-Source: databricks-api`; real plant list returned |
| `POST /api/por/order-header` | POST | POH | 2026-05-17 | PO 7006965038; real data; some fields empty by design |
| `GET /api/por/order-operations` | GET | POH | 2026-05-17 | 11 operations for PO 7006965038 |
| `GET /api/por/order-confirmations` | GET | POH | 2026-05-18 | PO 7006967130; 2 confirmations; `confirmationId=100001669`, `confirmedYield=646.88 KG` |
| `GET /api/por/order-goods-movements` | GET | POH | 2026-05-18 | PO 7006965479; 901 movements; `direction=input` for MOVEMENT_TYPE=261 |
| `GET /api/envmon/site-summary` | GET | EnvMon | 2026-05-18 | C061; all 12 schema keys; `highestSeverity:"low"`, `riskStatus:"unknown"` |
| `GET /api/envmon/swab-results` | GET | EnvMon | 2026-05-18 | C061, limit=100; HTTP 200; numeric schema widened (f.txt) |
| `POST /api/trace2/trace-graph` | POST | Trace | 2026-05-18 | `material_id=20052009`, `batch_id=0008602411`; iterative multi-hop; real graph returned |
| `?workspace=trace-graph-verify` (UI) | GET | Trace | 2026-05-18 | C14 — TraceGraphPanel + source badge + link-type legend; green `databricks-api` badge |
| `?workspace=traceability-workspace` (UI) | GET | Trace | 2026-05-18 | C15 — TraceQueryForm embedded; same data as C14; default view `trace-tree` |
| `?workspace=envmon-monitoring` (UI) | GET | EnvMon | 2026-05-18 | C11a — NativeMonitoringView; site summary + swab results table from Databricks; routing fix (f.txt) |

---

## How to Update This Document

When a route passes browser verification:
1. Move it to the "Completed Verifications" table above
2. Update `docs/audit/adapter-source-status-matrix.md` — change `✓ E` or `✓ W` to `✓ BV` with the date
3. Update `docs/audit/current-state-after-native-databricks-work.md` — move from "Executable" to "Browser-Verified"
4. If the route also satisfies a parity claim, update `docs/audit/functional-parity-gap-analysis.md`
