# QM Usage-Decision Source — Grain and Join Assessment

**Status:** grain verified 2026-05-21; join to inspection_lot verified; two-hop join to batch confirmed; leading-zero and counter-string edge cases pending
**Created:** 2026-05-21
**Evidence captured via:** Databricks CLI using user-authorised workspace access, 2026-05-21 (warehouse `connected_plant_uat` / `e76480b94bea6ed5`)
**Related:** `qm-usage-decision-source-verification.md`, `quality-databricks-source-verification.md`

This document defines the grain hypotheses and join assessment for the QM usage-decision source.

---

## 1. Grain Hypotheses

| Hypothesis | Description | Status | Notes |
|---|---|---|---|
| One row per inspection lot | Each inspection lot has exactly one usage-decision row (current-state) | **refuted** | Multiple rows per lot confirmed. Lots with up to 6 rows observed. |
| One row per inspection lot + operation | Multiple UD rows per lot, one per operation | **refuted** | USAGE_DECISION_COUNTER discriminates rows, not operation. No operation column in UD table. |
| One row per material + batch + plant | UD source is batch-centric, not lot-centric | **not applicable** | UD table has no MATERIAL_ID/BATCH_ID/PLANT_ID columns. Grain is inspection-lot-centric. |
| One row per process order + batch | UD linked through process order, not inspection lot | **not applicable** | UD table has no PROCESS_ORDER_ID column. Join through gold_inspection_lot. |
| Historical rows per decision/version | Multiple rows per lot, one per decision version/timestamp | **confirmed** | Grain is (INSPECTION_LOT_ID, USAGE_DECISION_COUNTER). USAGE_DECISION_COUNTER is blank for first decision, then '1', '2', '3'... Max observed counter = 5. |
| Unknown | Grain is not determinable from available evidence | resolved | Grain is confirmed as (INSPECTION_LOT_ID, USAGE_DECISION_COUNTER). |

**Confirmed grain:** `(INSPECTION_LOT_ID, USAGE_DECISION_COUNTER)` — unique composite key with 0 duplicate rows in 15,473,693 total rows.

**Query note for latest UD per lot:** USAGE_DECISION_COUNTER is a STRING column. Blank = first decision; subsequent values are '1', '2', '3', etc. Ordering by string value is safe for single-digit counters only. For any adapter query that selects the "current" usage decision, use `CAST(NULLIF(USAGE_DECISION_COUNTER, '') AS INT)` or equivalent — do not use `MAX(USAGE_DECISION_COUNTER)` on the raw string.

---

## 2. Grain Verification SQL Templates

Replace `<verified_usage_decision_object>` and all column names with the actual names found in `DESCRIBE` output. Do not run these with assumed column names.

```sql
-- Total row count
SELECT COUNT(*) AS row_count
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- H1: one row per inspection lot
SELECT
  inspection_lot_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- H3: one row per material + batch + plant
SELECT
  material_id,
  batch_id,
  plant_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY material_id, batch_id, plant_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- H3 extended: one row per material + batch + plant + inspection lot
SELECT
  material_id,
  batch_id,
  plant_id,
  inspection_lot_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY material_id, batch_id, plant_id, inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- H5: historical — multiple rows per lot
SELECT
  inspection_lot_id,
  COUNT(*) AS decision_rows,
  MIN(usage_decision_created_date) AS first_decision,
  MAX(usage_decision_created_date) AS last_decision
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY decision_rows DESC
LIMIT 50;

-- Null key frequency (understand completeness)
SELECT
  COUNT(*) AS total_rows,
  COUNT(inspection_lot_id) AS rows_with_lot_id,
  COUNT(material_id) AS rows_with_material_id,
  COUNT(batch_id) AS rows_with_batch_id,
  COUNT(plant_id) AS rows_with_plant_id
FROM connected_plant_uat.gold.<verified_usage_decision_object>;
```

---

## 3. Plant Handling

SAP QM inspection lots are plant-scoped. Verification results (2026-05-21):

| Question | Expected | Actual (2026-05-21) | Verified? |
|---|---|---|---|
| Does the source contain a `PLANT_ID` or equivalent column? | Yes | No — PLANT_ID not in `gold_inspection_usage_decision`. It is in `gold_inspection_lot`. | verified |
| Is plant required for a unique key (material + batch + plant = one row)? | Likely yes | Not applicable — UD has no material/batch/plant columns. Key is (lot_id, counter). | verified |
| Does the source return rows across multiple plants for the same material/batch? | Possible | Via inspection_lot join: lots can be plant-specific. Some lots not batch-linked (MATERIAL_ID null). | verified |
| Is plant preserved in leading-zero format (e.g. `C061`, `P132`)? | Yes | UAT candidate: plant C061 confirmed via lot join. | verified for UAT candidate |

**Key finding:** PLANT_ID is not in the UD table itself. It must be obtained by joining to `gold_inspection_lot.PLANT_ID`. Any adapter query that needs plant filtering must join to the lot table first.

---

## 4. Leading-Zero Preservation

SAP IDs commonly contain leading zeros in storage (`000000000020052009`, `0008602411`). The Databricks gold views may or may not strip them.

| ID Type | V1 Format | Verified UAT Format | Verified? |
|---|---|---|---|
| Material ID | 18-char with leading zeros | **Unpadded** — `gold_inspection_lot.MATERIAL_ID` = `20052009` for UAT candidate | verified for UAT candidate |
| Batch ID | 10-char with leading zeros | **Padded** — `gold_inspection_lot.BATCH_ID` = `0008602411` (10-char) for UAT candidate | verified for UAT candidate |
| Inspection Lot ID | Typically 10-12 chars | `030005059533` (12-char) for UAT candidate | verified for UAT candidate |
| Plant ID | 4-char alphanumeric | `C061` — confirmed | verified |

**Cross-object note:** `gold_batch_lineage.material_id` was also observed as unpadded in prior traceability verification. Cross-object leading-zero consistency across ALL materials and plants has not been formally tested — only the UAT candidate was checked. Verify before asserting a universal join pattern.

**Join safety:** For the UAT candidate, `gold_inspection_lot.MATERIAL_ID = '20052009'` joins correctly to Traceability usage of `material_id = '20052009'`. Do not assume the batch header join uses padded material IDs.

---

## 5. Join Assessment Table

| Target Domain | Required Join | Verified Join Path | Verified? | Risk | Recommendation |
|---|---|---|---|---|---|
| Quality Evidence | inspection lot / material / batch / plant | UD.INSPECTION_LOT_ID → gold_inspection_lot.INSPECTION_LOT_ID → MATERIAL_ID/BATCH_ID/PLANT_ID | **verified** | Some lots not batch-linked (MATERIAL_ID null) | LEFT JOIN; filter out non-batch-linked lots for batch display |
| Traceability Batch Header | material + batch + plant | Two-hop: UD → inspection_lot → batch | **partially verified** | Fan-out if multiple lots per batch (each with a UD) | Determine which lot is authoritative per batch before wiring |
| Traceability Supplier Exposure | supplier receipt lineage to batch quality evidence | UD not a direct supplier join; batch → lot → UD path via inspection_lot | **not run** | Cannot derive supplier risk from UD alone | Supplier risk rules must be separately governed; UD is evidence only |
| Traceability Production History | process order / material / batch / plant | gold_inspection_lot.PROCESS_ORDER_ID exists — PO→lot→UD path possible | **not run** | `quality_status` from production history is not UD; must remain distinct | Show UD evidence separately; do not replace `quality_status` with UD code |
| POH | process order / inspection lot | gold_inspection_lot.PROCESS_ORDER_ID confirmed; PO→lot→UD chain unverified end-to-end | **not run** | PO may have multiple inspection lots | Verify PO→lot→UD path before wiring |
| SPC | MIC/result/spec context — not release status | Not applicable — UD is not SPC control status | n/a | Risk of conflation: UD ≠ control status | Do not use UD in SPC context |

---

## 6. Join Verification SQL Templates

```sql
-- Verify join to inspection lot source
SELECT
  ud.inspection_lot_id,
  ud.usage_decision_code,
  il.MATERIAL_ID AS lot_material,
  il.BATCH_ID AS lot_batch,
  il.PLANT_ID AS lot_plant,
  il.PROCESS_ORDER_ID AS lot_po,
  il.USAGE_DECISION_LONG_TEXT
FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
LEFT JOIN connected_plant_uat.gold.gold_inspection_lot il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE ud.inspection_lot_id IS NOT NULL
LIMIT 50;

-- Verify join to batch header (via inspection_lot)
SELECT
  il.MATERIAL_ID,
  il.BATCH_ID,
  il.PLANT_ID,
  ud.inspection_lot_id,
  ud.usage_decision_code,
  s.UNRESTRICTED,
  s.BLOCKED,
  s.QUALITY_INSPECTION
FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
JOIN connected_plant_uat.gold.gold_inspection_lot il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
LEFT JOIN connected_plant_uat.gold.gold_batch_stock_v s
  ON s.MATERIAL_ID = il.MATERIAL_ID
 AND s.BATCH_ID = il.BATCH_ID
 AND s.PLANT_ID = il.PLANT_ID
WHERE il.MATERIAL_ID IS NOT NULL
  AND il.BATCH_ID IS NOT NULL
LIMIT 50;

-- Verify join for UAT traceability candidate
SELECT
  ud.inspection_lot_id,
  ud.usage_decision_code,
  ud.valuation_code,
  ud.usage_decision_counter,
  ud.usage_decision_created_date,
  il.MATERIAL_ID,
  il.BATCH_ID,
  il.PLANT_ID,
  il.USAGE_DECISION_LONG_TEXT
FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
JOIN connected_plant_uat.gold.gold_inspection_lot il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE il.MATERIAL_ID IN ('000000000020052009', '20052009')
  AND il.BATCH_ID IN ('0008602411', '8602411')
LIMIT 25;

-- Check for POH join path (process order → inspection lot → usage decision)
SELECT
  ud.inspection_lot_id,
  ud.usage_decision_code,
  il.PROCESS_ORDER_ID
FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
JOIN connected_plant_uat.gold.gold_inspection_lot il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE il.PROCESS_ORDER_ID = '7006965038'  -- Golden POH candidate
LIMIT 25;
```

---

## 7. Fan-Out Risk Assessment

**Implementation gate:** Before wiring usage-decision evidence to batch-level panels, verify whether a material + batch + plant can have multiple inspection lots, each with its own usage-decision history. If multiple lots exist, do not collapse to one batch decision — either surface lot-level evidence or require a governed rule for selecting the authoritative lot. Do not synthesise a "batch release status" from multiple lot decisions. Supplier risk must remain blocked until supplier/batch causality and risk rules are separately governed.

| Fan-out Risk | Why it matters | Observed Status | Required Decision Before Wiring |
|---|---|---|---|
| Multiple UD rows per inspection lot (historical) | Historical decisions exist — naïve SELECT returns all rows | **Confirmed** — max 6 rows per lot observed | Select latest row per lot using verified counter/date logic (see §9 SQL template) |
| Multiple inspection lots per material/batch/plant | Batch may have several inspection outcomes | Not yet checked — possible for multi-operation orders | Surface lot-level evidence or obtain governed selection rule; do not silently aggregate |
| Non-batch-linked inspection lots | Not all lots join to material/batch | **Confirmed** — lot 140000004071 has PLANT_ID=P790 but no material/batch | Exclude null-material/batch rows from batch-header display or show separately |
| Null inspection lot ID | UD row exists but cannot be joined to a lot | **Not found** — 0 null lot IDs in 15.47M rows | No action required |
| Multiple batches per process order | POH may have several batch/lot paths | Not yet checked | Keep evidence at lot/batch level; do not roll up to order level |

---

## 8. Summary Table

| Item | Verified? | Result | Date |
|---|---|---|---|
| Object name confirmed | verified | `gold_inspection_usage_decision` | 2026-05-21 |
| Object type (table/view/other) | verified | Delta table (DESCRIBE confirmed; SHOW CREATE not run) | 2026-05-21 |
| Column names captured | verified | 13 columns — see §4 of `qm-usage-decision-source-verification.md` | 2026-05-21 |
| Grain: unique per (lot_id, counter) | verified | 0 duplicates on composite key | 2026-05-21 |
| Grain: historical or current-state | verified | Historical — multiple rows per lot; blank counter = first, then '1','2',... | 2026-05-21 |
| Plant column present in UD table | verified | No — PLANT_ID not in UD table; obtained via gold_inspection_lot join | 2026-05-21 |
| Join to inspection_lot confirmed | verified | Works; returns MATERIAL_ID/BATCH_ID/PLANT_ID/USAGE_DECISION_LONG_TEXT | 2026-05-21 |
| Join to batch header (via lot) confirmed | partially verified | Two-hop join reachable; fan-out from multiple lots per batch not yet assessed | 2026-05-21 |
| Join to process order confirmed | not run | gold_inspection_lot.PROCESS_ORDER_ID column exists; end-to-end PO→lot→UD not verified | — |
| Leading-zero format documented | verified for UAT candidate | Material unpadded (20052009); batch padded (0008602411); lot 12-char; plant 4-char | 2026-05-21 |
| Fan-out risk assessed | partially assessed | Multiple UD rows per lot confirmed (historical); multiple lots per batch not yet checked | 2026-05-21 |

---

## 9. Proposed Latest-Usage-Decision SQL Template

**Status: proposed implementation template — requires validation before use in any adapter or route.**

This pattern selects the latest usage-decision row per inspection lot using a safe counter cast. It is not yet wired in any V2 adapter.

```sql
WITH usage_decision_ranked AS (
  SELECT
    ud.*,
    ROW_NUMBER() OVER (
      PARTITION BY ud.INSPECTION_LOT_ID
      ORDER BY
        COALESCE(CAST(NULLIF(ud.USAGE_DECISION_COUNTER, '') AS INT), 0) DESC,
        ud.USAGE_DECISION_CREATED_DATE DESC,
        ud.USAGE_DECISION_UPDATED_TIME DESC
    ) AS rn
  FROM connected_plant_uat.gold.gold_inspection_usage_decision ud
)
SELECT *
FROM usage_decision_ranked
WHERE rn = 1;
```

**Caveats before production use:**

- Validate behaviour if `USAGE_DECISION_COUNTER` ever exceeds 9 — the max observed is 5 (single digit). String ordering is safe for single-digit counters only; if counters can reach two digits, `CAST(NULLIF(..., '') AS INT)` is the safe path (already used above), but the ordering semantics must be confirmed.
- Validate blank counter semantics with the QM/data owner. Blank is treated as 0 (first decision); confirm this is correct before relying on the ordering for any authoritative "current decision" display.
- Do not use `MAX(USAGE_DECISION_COUNTER)` on the raw string column — string MAX breaks at counter '10' vs '9'.
- If `USAGE_DECISION_CREATED_DATE` or `USAGE_DECISION_UPDATED_TIME` semantics conflict with counter order (e.g., a later date but lower counter), escalate before implementation rather than choosing a tiebreak silently.
