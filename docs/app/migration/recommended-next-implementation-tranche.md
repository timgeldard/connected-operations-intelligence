# Recommended Next Implementation Tranche

**Date:** 2026-05-17  
**Basis:** Current state after e.txt and f.txt tranches; all POH native routes wired; Trace QuerySpecs written but routes blocked on DDL  
**Reference:** `docs/migration/next-native-databricks-candidate-ranking.md`, `docs/deployment/browser-verification-backlog.md`

---

## Recommendation: Tranche h.txt — Browser-Verify POH Confirmations and Goods Movements

**Goal:** Move `getOrderConfirmations` and `getOrderGoodsMovements` from "executable" to "browser-verified" status. No implementation work required — this tranche is verification-only.

**Why this tranche:**
1. Zero implementation risk. Both routes are wired, DDL-confirmed, and all tests pass.
2. Fastest path to a validated end-to-end POH story: header (BV) → operations (BV) → confirmations (BV) → goods movements (BV).
3. Unblocks frontend integration for the Confirmations and Goods Movements panels in the POH workspace.
4. The only thing between the current state and "browser-verified" is 10 minutes of manual testing in UAT.

---

## h.txt Task List

### H-01: Pre-flight check

- [ ] Confirm UAT app is RUNNING: `databricks apps get connectio-v2` → state = RUNNING
- [ ] Confirm `BACKEND_ADAPTER_MODE=databricks-api` in `app.yaml`
- [ ] Confirm authenticated as a Databricks user with `sql` scope in `effective_user_api_scopes`
- [ ] Confirm process order `7006965038` exists (or identify an alternate with known confirmations)

---

### H-02: Browser-verify GET /api/por/order-confirmations

```http
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-confirmations?process_order_id=7006965038
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_confirmations` header present
- [ ] Response is a JSON array
- [ ] Each item has `confirmationId`, `operationId`, `confirmedYield`, `uom`, `confirmedAt`
- [ ] Duration fields present where view has data (seconds ÷ 60 conversion applied)
- [ ] `operationText` and `isFinalConfirmation` absent (by design — not in view)
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Cause | Fix |
|---|---|---|
| 401 | OAuth missing or `sql` scope absent | Re-authenticate; check `user_api_scopes: [sql]` |
| 403 | No SELECT on `vw_gold_confirmation` | `GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_confirmation TO <user>` |
| 503 (mode) | `BACKEND_ADAPTER_MODE` not `databricks-api` | Check `app.yaml` |
| 502 | Query error | Check `databricks apps logs connectio-v2` |
| Empty array | PO 7006965038 has no confirmations | Try alternate process order with known production history |

**Manual result:**

| Status | Date | Row count | Notes |
|---|---|---|---|
| [ ] not yet tested | — | — | — |

---

### H-03: Browser-verify GET /api/por/order-goods-movements

```http
GET https://connectio-v2-604667594731808.8.azure.databricksapps.com/api/por/order-goods-movements?process_order_id=7006965038
```

**Pass criteria:**
- [ ] HTTP 200
- [ ] `X-Data-Source: databricks-api` header present
- [ ] `X-Query-Name: poh.get_order_goods_movements` header present
- [ ] Response is a JSON array
- [ ] All `direction` values are `"input"`, `"output"`, or `"unknown"` (never null)
- [ ] `materialId` values are strings with leading zeros preserved
- [ ] `materialDescription` absent (by design — no material master join in view)
- [ ] Any `direction: 'unknown'` rows are present and have complete other fields
- [ ] No 401/403/502/503

**Troubleshooting:**

| Status | Cause | Fix |
|---|---|---|
| 401 | OAuth missing | Re-authenticate |
| 403 | No SELECT on `vw_gold_adp_movement` | `GRANT SELECT ON VIEW connected_plant_uat.csm_process_order_history.vw_gold_adp_movement TO <user>` |
| 502 | Query error (column mismatch unlikely — DDL confirmed) | Check logs |
| Empty array | PO 7006965038 has no ADP movements | Try alternate process order |

**Manual result:**

| Status | Date | Row count | Unknown-direction rows | Notes |
|---|---|---|---|---|
| [ ] not yet tested | — | — | — | — |

---

### H-04: Update documentation (post-verification)

After both routes pass:

- [ ] Update `docs/audit/adapter-source-status-matrix.md`:
  - `getOrderConfirmations`: change `✓ E` to `✓ BV <date>`
  - `getOrderGoodsMovements`: change `✓ E` to `✓ BV <date>`
- [ ] Update `docs/audit/current-state-after-native-databricks-work.md`:
  - Move both methods from "Executable" to "Browser-Verified" section
- [ ] Update `docs/deployment/browser-verification-backlog.md`:
  - Move BV-01 and BV-02 to "Completed Verifications" table
- [ ] Update `docs/audit/functional-parity-gap-analysis.md`:
  - Mark confirmations and goods movements as partial parity achieved

---

## After h.txt — Recommended i.txt

Once h.txt is complete (both routes browser-verified), the next tranche depends on whether Trace DDL verification has been run:

### Path A: DDL verification done → Implement Trace batch header

If `gold_batch_summary_v` columns and `gold_material.language_id` are confirmed:

1. Update `get_batch_header_summary_spec` with confirmed column names (replace 6 TODOs)
2. Wire `POST /api/trace2/batch-header` with databricks-api mode gate (dual-mode)
3. Write tests following `test_process_order_routes.py` pattern
4. Deploy and browser-verify with anchor batch

### Path B: DDL verification not done → Run DDL queries manually

Run the following in the Databricks SQL editor against `connected_plant_uat`:

```sql
-- 1. gold_batch_summary_v columns
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_summary_v;

-- 2. gold_material language_id
SELECT DISTINCT language_id, COUNT(*) AS cnt
FROM connected_plant_uat.gold.gold_material
GROUP BY language_id ORDER BY cnt DESC LIMIT 10;

-- 3. gold_batch_mass_balance_v WHERE columns
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v;
```

Update `docs/audit/trace-native-column-verification-checklist.md` with results.  
Then proceed with Path A.

---

## What This Tranche Does NOT Include

- No new implementation (all code is already written)
- No schema changes
- No new FastAPI routes
- No frontend changes
- No SPN/PAT fallback
- No mock data claims
- No recursive trace traversal
- No CQ lab fails implementation (blocked on `vw_gold_process_order_plan`)
