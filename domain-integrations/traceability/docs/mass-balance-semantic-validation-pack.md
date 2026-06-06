# Mass Balance Semantic Validation Pack

**Status:** Pack ready — no SQL run; all questions open; requires Databricks access to execute
**Created:** 2026-05-21
**Open issues:** TRACE-P1-010 (MOVEMENT_CATEGORY direction), TRACE-P1-011 (BALANCE_QTY semantics)
**Related:** `mass-balance-source-mapping.md`, `mass-balance-movement-category-register.md`

This pack can be handed to a data-platform or business owner with Databricks access. Its purpose is to resolve the two open correctness gaps in the V2 mass balance panel before the panel's output can be trusted for investigative conclusions.

**Hard constraint:** Do not assign direction to any MOVEMENT_CATEGORY in V2 without business or data-platform confirmation. Do not display BALANCE_QTY as a verified running balance until TRACE-P1-011 is resolved. Mass balance is not production-ready.

---

## 1. Current State

The V2 `POST /api/trace2/mass-balance` route is live and queries `connected_plant_uat.gold.gold_batch_mass_balance_v`. Eleven columns are confirmed. The panel displays results with two explicit amber caveats:

1. **TRACE-P1-010:** MOVEMENT_CATEGORY mapping is incomplete. Only `Production` and `Shipment` are mapped; all other live categories fall through to `adjustment`. The panel shows an unresolved-movement count and warns the user that the variance figure is not a verified mass-balance result.
2. **TRACE-P1-011:** BALANCE_QTY was `0.000` for all 10 sample rows from the UAT candidate batch (20035129 / 8000049668 / C061). The semantics of this column are unknown — it may be a placeholder, a column populated by a job that has not run, or a different kind of balance. V2 does not display it as a running balance.

Both gaps require data-platform or business owner input. No SQL in this pack should be treated as having been run.

---

## 2. TRACE-P1-010 — MOVEMENT_CATEGORY Direction Mapping

### 2.1 Questions for the Data Platform / Business Owner

1. What does `MOVEMENT_CATEGORY` represent in `gold_batch_mass_balance_v`? Is it derived from SAP movement types, or is it an independent gold-view enrichment?
2. Is the `QUANTITY` column in `gold_batch_mass_balance_v` already directionally signed (negative for outbound movements)? Or is it always positive, with direction implied by the category?
3. For the categories below, what is the correct direction for a batch query (material + batch, no plant filter)?

   - `STO Receipt` — when this batch receives stock from another plant, should it count as inbound for this batch's balance?
   - `STO Transfer` — when this batch is transferred to another plant, should it count as outbound, inbound, or transfer?
   - `Other (261)` — SAP movement type 261 is typically "goods issue for order." Should this be outbound for the queried batch?
   - `Other (262)` — SAP 262 is typically "return from order." Should this be inbound (reversal of 261)?
   - `Other (321)` — what is this in Kerry's SAP configuration?
   - `Write-Off` — should this always be outbound?
   - `Other (Z01)`, `Other (Z61)`, `Other (Z62)`, `Other (Z12)` — what do Kerry-local Z-prefix types represent?

4. Should the mass balance include all plants for a batch (current approach: no plant filter), or should it be plant-scoped?
5. Is plant context required to determine direction? (e.g. STO Receipt is inbound for the receiving plant but outbound for the sending plant)

### 2.2 SQL Templates

**Do not run with assumed column names. Verify against live DDL first.**

```sql
-- Check QUANTITY sign for known movement types
-- Run for a batch with confirmed inbound and outbound events
SELECT
  MOVEMENT_TYPE,
  MOVEMENT_CATEGORY,
  QUANTITY,
  ABS_QUANTITY,
  UOM,
  POSTING_DATE
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE MATERIAL_ID = '20035129'
  AND BATCH_ID = '8000049668'
ORDER BY POSTING_DATE, MOVEMENT_CATEGORY
LIMIT 100;

-- Distribution of QUANTITY sign by MOVEMENT_CATEGORY
SELECT
  MOVEMENT_CATEGORY,
  COUNT(*) AS total_rows,
  SUM(CASE WHEN QUANTITY > 0 THEN 1 ELSE 0 END) AS positive_qty_rows,
  SUM(CASE WHEN QUANTITY < 0 THEN 1 ELSE 0 END) AS negative_qty_rows,
  SUM(CASE WHEN QUANTITY = 0 THEN 1 ELSE 0 END) AS zero_qty_rows
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE MATERIAL_ID = '20035129'
  AND BATCH_ID = '8000049668'
GROUP BY MOVEMENT_CATEGORY
ORDER BY total_rows DESC;

-- STO Receipt rows — are these inbound for the queried batch?
SELECT
  MOVEMENT_TYPE,
  MOVEMENT_CATEGORY,
  PLANT_ID,
  QUANTITY,
  ABS_QUANTITY,
  UOM,
  POSTING_DATE,
  PROCESS_ORDER_ID
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE MATERIAL_ID = '20035129'
  AND BATCH_ID = '8000049668'
  AND MOVEMENT_CATEGORY = 'STO Receipt'
ORDER BY POSTING_DATE
LIMIT 50;

-- Other (261) rows — goods issue for order
SELECT
  MOVEMENT_TYPE,
  MOVEMENT_CATEGORY,
  PLANT_ID,
  QUANTITY,
  ABS_QUANTITY,
  PROCESS_ORDER_ID,
  POSTING_DATE
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE MATERIAL_ID = '20035129'
  AND BATCH_ID = '8000049668'
  AND MOVEMENT_CATEGORY = 'Other (261)'
ORDER BY POSTING_DATE
LIMIT 50;

-- Z-prefix custom movement types — what are these?
SELECT
  MOVEMENT_TYPE,
  MOVEMENT_CATEGORY,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE MOVEMENT_CATEGORY LIKE 'Other (Z%)'
GROUP BY MOVEMENT_TYPE, MOVEMENT_CATEGORY
ORDER BY rows DESC
LIMIT 50;
```

### 2.3 Approval Table

Fill in after data-platform or business owner review. Do not invent entries.

| MOVEMENT_CATEGORY | Approved Direction | Approved By | Approval Date | Notes |
|---|---|---|---|---|
| `Production` | — | — | — | |
| `Shipment` | — | — | — | |
| `STO Receipt` | — | — | — | |
| `STO Transfer` | — | — | — | |
| `Other (261)` | — | — | — | |
| `Other (262)` | — | — | — | |
| `Other (321)` | — | — | — | |
| `Write-Off` | — | — | — | |
| `Other (Z01)` | — | — | — | |
| `Other (Z61)` | — | — | — | |
| `Other (Z62)` | — | — | — | |
| `Other (Z12)` | — | — | — | |

Once all rows are filled, update `_MOVEMENT_CATEGORY_MAP` in the backend adapter and close TRACE-P1-010.

---

## 3. TRACE-P1-011 — BALANCE_QTY Semantics

### 3.1 Questions for the Data Platform

1. What does `BALANCE_QTY` represent in `gold_batch_mass_balance_v`? Is it a:
   - Running balance (cumulative sum of directional quantities up to each row)?
   - Snapshot balance at the time of the gold view refresh?
   - Placeholder / default column not yet populated?
   - Something else?
2. Why is `BALANCE_QTY` = `0.000` for all observed rows of the UAT candidate batch (20035129 / 8000049668)?
3. Is `BALANCE_QTY` populated by a scheduled job? If so, when did it last run for the UAT environment?
4. If `BALANCE_QTY` is not a reliable running balance, should V2 compute its own balance by summing directionally mapped quantities?
5. If V2 should compute its own balance, must the QUANTITY sign be confirmed first (see TRACE-P1-010, question 2)?

### 3.2 SQL Templates

```sql
-- Check BALANCE_QTY across multiple batches (not just the UAT candidate)
SELECT
  MATERIAL_ID,
  BATCH_ID,
  COUNT(*) AS rows,
  SUM(CASE WHEN BALANCE_QTY = 0 THEN 1 ELSE 0 END) AS zero_balance_rows,
  SUM(CASE WHEN BALANCE_QTY <> 0 THEN 1 ELSE 0 END) AS non_zero_balance_rows,
  MIN(BALANCE_QTY) AS min_balance,
  MAX(BALANCE_QTY) AS max_balance
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
GROUP BY MATERIAL_ID, BATCH_ID
HAVING SUM(CASE WHEN BALANCE_QTY <> 0 THEN 1 ELSE 0 END) > 0
LIMIT 50;

-- If non-zero BALANCE_QTY rows exist — inspect them
SELECT
  MATERIAL_ID,
  BATCH_ID,
  MOVEMENT_CATEGORY,
  QUANTITY,
  ABS_QUANTITY,
  BALANCE_QTY,
  POSTING_DATE
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE BALANCE_QTY <> 0
ORDER BY POSTING_DATE
LIMIT 50;

-- Attempt to verify if BALANCE_QTY matches a cumulative sum of QUANTITY
-- (only meaningful after QUANTITY sign semantics are confirmed)
SELECT
  POSTING_DATE,
  MOVEMENT_CATEGORY,
  QUANTITY,
  ABS_QUANTITY,
  BALANCE_QTY,
  SUM(QUANTITY) OVER (
    PARTITION BY MATERIAL_ID, BATCH_ID
    ORDER BY POSTING_DATE
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS computed_running_balance
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE MATERIAL_ID = '20035129'
  AND BATCH_ID = '8000049668'
ORDER BY POSTING_DATE
LIMIT 50;
```

### 3.3 BALANCE_QTY Decision Table

| Question | Evidence Needed | Owner Decision | Status |
|---|---|---|---|
| Is BALANCE_QTY a precomputed running balance? | SQL check above + data platform explanation | Data platform | Open |
| Is BALANCE_QTY always 0 across all batches? | Spot-check multiple batches | Data platform | Open — only UAT candidate checked |
| Is BALANCE_QTY populated by a batch job not yet run for UAT data? | Check ETL schedule | Data platform | Open |
| Should V2 compute its own running balance from QUANTITY? | Depends on QUANTITY sign confirmation | Engineering + data platform | Open — requires TRACE-P1-010 resolution first |

---

## 4. Implementation Gate

**Before removing the mass balance caveat banners, ALL of the following must be confirmed:**

- [ ] All MOVEMENT_CATEGORY direction assignments confirmed and recorded in the approval table (§2.3).
- [ ] BALANCE_QTY semantics confirmed (§3.3 decisions all resolved).
- [ ] QUANTITY column sign semantics confirmed (positive always, or directionally signed).
- [ ] V2 `_MOVEMENT_CATEGORY_MAP` updated with approved directions.
- [ ] Plant-scope decision made (no filter vs plant filter for mass balance query).
- [ ] At least one UAT run of the mass balance panel with correct category mapping against a batch with known input/output history.

Until all items are checked, the mass balance panel must continue to show amber caveat banners and must not claim a verified mass-balance result.
