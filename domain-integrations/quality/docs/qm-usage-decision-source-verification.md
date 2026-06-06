# QM Usage-Decision Source Verification Pack

**Status:** schema + grain + join key verified 2026-05-21; code/text semantics governance from QM process owner required before any accepted/released/rejected mapping
**Created:** 2026-05-21
**Evidence captured via:** Databricks CLI using user-authorised workspace access, 2026-05-21 (warehouse `connected_plant_uat` / `e76480b94bea6ed5`)
**Open blocker:** TRACE-P1-012
**Related doc:** `quality-databricks-source-verification.md` covers the broader inspection/MIC/lot/CoA/deviation universe; this document is scoped to usage-decision source verification only.

These are candidate sources. This document does not claim that any source is authoritative until object existence, schema, grain, join keys, and business semantics are verified.

---

## 1. Purpose

Establish whether the QM usage-decision source in `connected_plant_uat.gold` can safely support read-only display in V2.

This pack must answer:

1. Which Databricks object is the authoritative usage-decision source?
2. What is the object type: table, view, metric view, or other?
3. What columns exist?
4. What is the grain?
5. How does it join to material, batch, plant, inspection lot, process order, and traceability data?
6. What do the usage-decision codes and texts mean?
7. Is the source current-state only or historical?
8. Can it support read-only evidence display?
9. Can it support release-status semantics? Assume no unless a governed mapping exists.
10. Which V2 domains can safely consume it, and with what caveats?

---

## 2. Known Candidate Sources

From V1 source discovery (`quality-v1-source-discovery.md`), TRACE-P1-012, and live verification 2026-05-21:

| Candidate Object | V1 Evidence | Catalog Status (2026-05-21) | Notes |
|---|---|---|---|
| `gold_inspection_usage_decision` | TRACE-P1-012 | **Confirmed. Schema verified.** 13 columns. Grain: (INSPECTION_LOT_ID, USAGE_DECISION_COUNTER). 15.47M rows. | No MATERIAL_ID/BATCH_ID/PLANT_ID — join through `gold_inspection_lot`. No `USAGE_DECISION_TEXT` column — long text is in `gold_inspection_lot.USAGE_DECISION_LONG_TEXT`. |
| `vw_gold_inspection_usage_decision` | V1: ConnectedQuality, POH order detail | **Not found.** `SHOW TABLES LIKE '*usage*'` and `'*decision*'` returned only `gold_inspection_usage_decision`. | V1 `vw_` prefix view name does not exist in current UAT catalog. The `gold_inspection_usage_decision` table is the current equivalent. |
| `gold_batch_quality_lot_v` | V1: Trace2 quality record | **Confirmed.** 13 columns. | Contains INSPECTION_LOT_ID, PLANT_ID, MATERIAL_ID, BATCH_ID, PROCESS_ORDER_ID, USAGE_DECISION_LONG_TEXT, CREATED_BY. No usage-decision code in this view. |
| `gold_batch_quality_summary_v` | V1: Trace2 quality record | **Confirmed.** 7 columns. | MATERIAL_ID, BATCH_ID, lot_count, latest_inspection_date, accepted_result_count, rejected_result_count, failed_mic_count. No usage-decision code. `accepted_result_count` = inspection result valuation count, NOT a usage decision. |
| `vw_gold_quality_result_enriched` | V1: POH Quality Analytics | Not found. | `gold_batch_quality_result_v` (27 cols) exists with `INSPECTION_RESULT_VALUATION` but no `USAGE_DECISION_CODE`. Separate concept: result valuation is not usage decision. |

**Additional objects discovered:** `SHOW TABLES LIKE '*inspection*'` returned 7 tables in `connected_plant_uat.gold`: `gold_inspection_activity`, `gold_inspection_individual_result`, `gold_inspection_lot`, `gold_inspection_point`, `gold_inspection_result`, `gold_inspection_specification`, `gold_inspection_usage_decision`. `gold_inspection_lot` is the bridge table for material/batch/plant joins (34 cols, clustered on MATERIAL_ID + PLANT_ID, includes USAGE_DECISION_LONG_TEXT).

---

## 3. Current Open Blocker: TRACE-P1-012

**Defect:** TRACE-P1-012 in `domain-integrations/traceability/docs/traceability-defect-backlog.md`

**Summary:** Several Traceability and Quality panels need a verified QM usage-decision source. The source is now schema + grain + join key verified (2026-05-21). The remaining block is code/text semantics governance from the Kerry QM process owner — no code may be mapped to accepted/released/rejected/conditional until a governed mapping is confirmed.

**Affected panels:**
- `MaterialSupplierExposurePanel` — `openSupplierActions` and `highestRiskSupplier` remain absent until QM source verified
- `ProductionHistoryPanel` — Pass/Fail labels from the gold view are not the SAP QM release decision
- `BatchHeaderPanel` — `qualityStatus` is conservative (`pending`/`unknown` only)
- Quality `QualityReadOnlyEvidencePanel` — returns `pending-source-verification`

**Current status:** schema + grain + join key verified 2026-05-21. Code/text semantics governance from QM process owner still required before any accepted/released/rejected display. See §13 for full evidence table.

---

## 4. What Is Known from V1/V2 Discovery and Live Verification (2026-05-21)

| Known Fact | Source | Confidence |
|---|---|---|
| `gold_inspection_usage_decision` exists in `connected_plant_uat.gold` | DESCRIBE TABLE 2026-05-21 | **Verified** |
| 13 columns: INSPECTION_LOT_ID, INSPECTION_LOT_TYPE, USAGE_DECISION_COUNTER, USAGE_DECISION_CODE, VALUATION_CODE, QUALITY_SCORE (decimal 3,0), USAGE_DECISION_CREATED_BY, USAGE_DECISION_CREATED_DATE (date), USAGE_DECISION_CREATED_TIME, USAGE_DECISION_UPDATED_TIME, __BATCH_ID, __CREATED_ON, __UPDATED_ON | DESCRIBE TABLE 2026-05-21 | **Verified** |
| No MATERIAL_ID, BATCH_ID, or PLANT_ID column in this table | DESCRIBE TABLE 2026-05-21 | **Verified** |
| No USAGE_DECISION_TEXT or USAGE_DECISION_LONG_TEXT column in this table | DESCRIBE TABLE 2026-05-21 | **Verified** — long text lives in `gold_inspection_lot.USAGE_DECISION_LONG_TEXT` |
| Grain is (INSPECTION_LOT_ID, USAGE_DECISION_COUNTER) — unique; 0 duplicates | Grain check 2026-05-21 | **Verified** |
| Source is historical: multiple rows per inspection lot; USAGE_DECISION_COUNTER is string (blank for first decision, then '1', '2', ...) | Grain + multi-decision sample 2026-05-21 | **Verified** — use MAX(CAST(USAGE_DECISION_COUNTER AS INT)) or equivalent to get latest; naïve MAX() on a string column is unsafe beyond counter=9 |
| Total row count: 15,473,693; 0 null INSPECTION_LOT_IDs | Count + null check 2026-05-21 | **Verified** |
| Join `gold_inspection_usage_decision.INSPECTION_LOT_ID` → `gold_inspection_lot.INSPECTION_LOT_ID` returns MATERIAL_ID, BATCH_ID, PLANT_ID, USAGE_DECISION_LONG_TEXT | Join query 2026-05-21 | **Verified** |
| Some inspection lots are not batch-linked: MATERIAL_ID/BATCH_ID null after join (e.g., lot 140000004071, PLANT_ID=P790) | Join sample 2026-05-21 | **Observed** — affects which UD rows can join to traceability batch header |
| UAT traceability candidate (material 20052009, batch 0008602411, plant C061) has a usage decision: lot 030005059533, code=A, valuation=A, date=2024-08-27 | Join query 2026-05-21 | **Verified** |
| Date range: 1900-01-01 to 2026-05-15, 4,739 distinct dates | Date range query 2026-05-21 | **Verified** — 1900-01-01 is a data quality anomaly (SAP default date for records without an entered decision date); do not filter without business owner confirmation |
| 9 distinct usage-decision codes observed: A (13.97M), AE (1.15M), AC (178K), R (97K), ACE (36K), RE (29K), A9 (6K), RR (3K), '' empty string (269) | Code distribution query 2026-05-21 | **Verified — raw observed values. No mapping to accepted/released/rejected exists until QM process owner governance is obtained.** |
| 3 distinct valuation codes: A (15.34M), R (130K), '' empty string (269) | Valuation distribution query 2026-05-21 | **Verified — raw values only.** |
| 269 rows have empty-string USAGE_DECISION_CODE (not NULL) | Null/empty check 2026-05-21 | **Verified** |
| `vw_gold_inspection_usage_decision` used in V1 POH and ConnectedQuality | `quality-v1-source-discovery.md` | V1 confirmed — but this `vw_` name **does not exist** in current UAT catalog |
| V1 code uses broad heuristics (`LIKE 'A%' => accepted`) — not a governed release mapping | `quality-v1-source-discovery.md` | Confirmed V1 anti-pattern — must not be promoted to V2 |
| No V1 usage-decision write-back, release/reject posting, or e-signature found | `quality-v1-source-discovery.md` | Confirmed absence |
| SAP code assumptions (`A`/`R`/`C`) in `quality-decision-source-plan.md` are engineering assumptions | `quality-decision-source-plan.md` | Unverified assumptions — do not treat as confirmed mapping |

---

## 5. What Is Still Unverified

The following items remain unverified after the 2026-05-21 session. Object, schema, grain, and join key checks are complete; governance and data-quality checks remain.

- **Governed SAP QM code/text semantics** — codes A, AE, AC, R, ACE, RE, A9, RR are observed raw values; their business meaning cannot be inferred without Kerry QM process owner confirmation. This is a governance gate, not a SQL gate.
- **USAGE_DECISION_CODE suffix semantics** — what `E` (AE, RE), `C` (AC, ACE), `9` (A9), `RR` mean in Kerry's SAP QM configuration is unknown.
- **QUALITY_SCORE value distribution** — column exists (decimal 3,0); no value distribution run.
- **VALUATION_CODE semantics** — observed raw values A and R; business meaning unconfirmed.
- **Leading-zero consistency across joins** — `gold_inspection_lot.MATERIAL_ID` uses unpadded form (e.g., `20052009`) for the UAT candidate; `gold_batch_lineage.material_id` was also unpadded in prior verification. Cross-object consistency has not been formally verified for all plants and materials.
- **INSPECTION_LOT_TYPE distribution** — column exists; which lot types carry usage decisions vs. not has not been checked.
- **Counter > 9 safety** — the maximum counter observed was `5`; no lot with counter `10`+ was tested. String ordering is safe up to single-digit counters; if counter can reach two digits, ordering on the string form breaks.
- **SHOW CREATE source definition** — not run; column definitions confirmed via DESCRIBE only.
- **Null/absent UD semantics** — a lot with no row in `gold_inspection_usage_decision` means either no decision was taken or the lot type does not require one; distinguishing these requires QM process owner input.

---

## 6. Object Discovery SQL

Run these first to discover actual UAT object names. Do not assume the candidate names exist.

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*usage*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*inspection*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*quality*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*qave*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*ud*';
```

Also run the broader inspection and quality inventories from `quality-databricks-source-verification.md` §4 to identify all candidate objects in one pass.

Record every matching table or view in the evidence table (§13).

---

## 7. DESCRIBE / SHOW CREATE SQL

Run these only for objects found in the discovery step above. Replace placeholder names with actual verified names.

```sql
-- Primary candidate (catalog-confirmed by TRACE-P1-012)
DESCRIBE EXTENDED connected_plant_uat.gold.gold_inspection_usage_decision;
SHOW CREATE TABLE connected_plant_uat.gold.gold_inspection_usage_decision;

-- V1-discovered view candidate
DESCRIBE EXTENDED connected_plant_uat.gold.vw_gold_inspection_usage_decision;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_inspection_usage_decision;

-- Batch quality lot candidate (contains USAGE_DECISION_LONG_TEXT per V1)
DESCRIBE EXTENDED connected_plant_uat.gold.gold_batch_quality_lot_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_lot_v;

-- Batch quality summary candidate
DESCRIBE EXTENDED connected_plant_uat.gold.gold_batch_quality_summary_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_summary_v;
```

Capture for each object:

- Object name and type (table, view, metric view, or other)
- All column names and data types
- Nullable status where available
- Column comments if available
- Source owner if available
- Freshness/update columns if available

Look specifically for fields corresponding to:
- inspection lot ID
- material ID
- batch ID
- plant ID
- process order ID
- usage decision code
- usage decision text
- valuation code
- quality score
- decision date/time
- created by / changed by
- current/final indicator
- status
- source system
- load/update timestamp

---

## 8. Grain Verification SQL

Run after column names are confirmed. Replace `<verified_usage_decision_object>` with the actual object name.

```sql
-- Total row count
SELECT COUNT(*) AS row_count
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- Check for multiple rows per inspection lot (expected: 0 duplicates if grain = one per lot)
SELECT
  inspection_lot_id,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY inspection_lot_id
HAVING COUNT(*) > 1
ORDER BY rows DESC
LIMIT 50;

-- Check for multiple rows per material + batch + plant
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

-- Check for multiple rows per material + batch + plant + inspection lot
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

-- Null inspection lot frequency
SELECT
  COUNT(*) AS total_rows,
  COUNT(inspection_lot_id) AS rows_with_lot,
  COUNT(*) - COUNT(inspection_lot_id) AS rows_without_lot
FROM connected_plant_uat.gold.<verified_usage_decision_object>;
```

Replace column names if the actual verified names differ. Do not rewrite SQL from memory.

---

## 9. Join-Key Verification SQL

Run after grain is established and column names confirmed.

```sql
-- Verify join to inspection lot source (if vw_gold_inspection_lot or equivalent exists)
SELECT
  ud.*,
  il.MATERIAL_ID AS lot_material,
  il.BATCH_ID AS lot_batch,
  il.PLANT_ID AS lot_plant
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
LEFT JOIN connected_plant_uat.gold.<verified_inspection_lot_object> il
  ON il.INSPECTION_LOT_ID = ud.inspection_lot_id
WHERE ud.inspection_lot_id IS NOT NULL
LIMIT 50;

-- Verify join to batch header (gold_batch_stock_v or equivalent)
SELECT
  ud.material_id,
  ud.batch_id,
  ud.inspection_lot_id,
  ud.usage_decision_code,
  s.PLANT_ID
FROM connected_plant_uat.gold.<verified_usage_decision_object> ud
LEFT JOIN connected_plant_uat.gold.gold_batch_stock_v s
  ON s.MATERIAL_ID = ud.material_id
 AND s.BATCH_ID = ud.batch_id
WHERE ud.material_id IS NOT NULL
  AND ud.batch_id IS NOT NULL
LIMIT 50;

-- Check for batches in traceability UAT candidate that have a usage decision
-- (Reference candidate: MATERIAL_ID=000000000020052009, BATCH_ID=0008602411, PLANT_ID=C061)
SELECT *
FROM connected_plant_uat.gold.<verified_usage_decision_object>
WHERE material_id IN ('000000000020052009', '20052009')
  AND batch_id IN ('0008602411', '8602411')
LIMIT 25;
```

---

## 10. Code/Text Semantics Verification

Run after column names and object existence are confirmed.

```sql
-- Distinct usage decision codes and texts (raw values — do not interpret as release statuses)
SELECT
  usage_decision_code,
  usage_decision_text,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY usage_decision_code, usage_decision_text
ORDER BY rows DESC
LIMIT 100;

-- Distinct valuation codes
SELECT
  valuation_code,
  COUNT(*) AS rows
FROM connected_plant_uat.gold.<verified_usage_decision_object>
GROUP BY valuation_code
ORDER BY rows DESC
LIMIT 100;

-- Null/empty code frequency
SELECT
  COUNT(*) AS total_rows,
  COUNT(usage_decision_code) AS rows_with_code,
  COUNT(CASE WHEN usage_decision_code = '' THEN 1 END) AS rows_empty_code,
  COUNT(*) - COUNT(usage_decision_code) AS rows_null_code
FROM connected_plant_uat.gold.<verified_usage_decision_object>;
```

These queries capture raw values only. The mapping of any code to accepted/released/rejected/conditional must not be inferred — it must come from a governed SAP QM process owner confirmation.

---

## 11. Current-vs-Historical Verification

```sql
-- Check whether decision date column exists and has variance
SELECT
  MIN(usage_decision_created_date) AS earliest_decision,
  MAX(usage_decision_created_date) AS latest_decision,
  COUNT(DISTINCT usage_decision_created_date) AS distinct_dates
FROM connected_plant_uat.gold.<verified_usage_decision_object>;

-- Check whether an inspection lot has multiple decision rows over time
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
```

A source that returns multiple rows per inspection lot over time is historical. A source that returns exactly one row per lot is current-state. Record actual result — do not assume.

---

## 12. Cross-Domain Consumption Rules

See `qm-usage-decision-cross-domain-consumption-plan.md` for the full per-domain rules. Summary:

| Domain | Safe Use (post-verification) | Blocked Until |
|---|---|---|
| Traceability batch header | Display source code/text as read-only evidence | Code/text semantics governance from QM process owner |
| Traceability supplier exposure | No supplier risk calculation from UD | Supplier/batch causality and risk rules defined separately |
| Traceability production history | Show UD evidence alongside `quality_status`; keep them distinct | Code/text semantics governance |
| Quality read-only evidence panel | Display source code/text as read-only evidence | Code/text semantics governance |
| POH | Display UD for process order if join to inspection lot/PO verified | PO → lot → UD join path not yet run |
| SPC | Not applicable — UD is not SPC control status | n/a |
| Genie | Cite source UD code/text; block "Can this batch be released?" | n/a — always blocked |

---

## 13. Evidence Capture Table

| Check | SQL Run | Expected Evidence | Actual Result | Verified By | Date | Status | Notes |
|---|---|---|---|---|---|---|---|
| Object inventory: `*usage*` | `SHOW TABLES ... '*usage*'` | Candidate objects listed | 1 row: `gold_inspection_usage_decision` | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Object inventory: `*decision*` | `SHOW TABLES ... '*decision*'` | Candidate objects listed | 1 row: `gold_inspection_usage_decision` | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Object inventory: `*inspection*decision*` | `SHOW TABLES ... '*inspection*decision*'` | Candidate objects listed | Inferred from `*decision*` result: only `gold_inspection_usage_decision` | Databricks CLI (user-authorised) | 2026-05-21 | verified (inferred) | `*decision*` is a superset; no additional objects expected |
| Object inventory: `*quality*decision*` | `SHOW TABLES ... '*quality*decision*'` | Candidate objects listed | Inferred: 0 rows (`gold_inspection_usage_decision` does not match `*quality*decision*`) | Databricks CLI (user-authorised) | 2026-05-21 | verified (inferred) | |
| Object existence: `gold_inspection_usage_decision` | `DESCRIBE TABLE ...` | Schema captured | 13 columns captured — see §4 | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Object existence: `vw_gold_inspection_usage_decision` | `SHOW TABLES` | Schema captured or not found | **Not found.** `*usage*` and `*decision*` patterns returned 0 matches for this name. | Databricks CLI (user-authorised) | 2026-05-21 | not found | V1 view name does not exist in current UAT catalog |
| Object existence: `gold_batch_quality_lot_v` | `DESCRIBE TABLE ...` | Schema captured or not found | 13 columns: INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, INSPECTION_LOT_ORIGIN, CREATED_DATE, INSPECTION_END_DATE, PROCESS_ORDER_ID, MATERIAL_ID, BATCH_ID, INSPECTION_SHORT_TEXT, MATERIAL_SHORT_TEXT, USAGE_DECISION_LONG_TEXT, CREATED_BY | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Object existence: `gold_batch_quality_summary_v` | `DESCRIBE TABLE ...` | Schema captured or not found | 7 columns: MATERIAL_ID, BATCH_ID, lot_count, latest_inspection_date, accepted_result_count, rejected_result_count, failed_mic_count | Databricks CLI (user-authorised) | 2026-05-21 | verified | No usage-decision code in this view |
| SHOW CREATE: primary candidate | `SHOW CREATE TABLE ...` | Source definition captured | Not run | — | — | not run | DESCRIBE confirms columns; SHOW CREATE deferred |
| Grain: unique per (inspection_lot_id, usage_decision_counter) | Duplicate check on composite key | 0 duplicates | 0 duplicates — confirmed unique | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Grain: multiple rows per inspection_lot_id | Duplicate check on lot_id alone | duplicates expected if historical | 20+ lots with 2–6 rows each; max observed = 6 (lot 120000052483) | Databricks CLI (user-authorised) | 2026-05-21 | verified | Source is historical. Counter blank = first decision, '1','2',... |
| Null inspection_lot_id | Count(null lot) | 0 nulls expected | 0 null INSPECTION_LOT_IDs (15,473,693 / 15,473,693 with lot) | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Join key: to inspection_lot | Join to `gold_inspection_lot` | MATERIAL_ID/BATCH_ID/PLANT_ID returned | Join works. Returns MATERIAL_ID, BATCH_ID, PLANT_ID, USAGE_DECISION_LONG_TEXT. Some lots not batch-linked (MATERIAL_ID/BATCH_ID null, e.g., lot 140000004071 PLANT_ID=P790) | Databricks CLI (user-authorised) | 2026-05-21 | verified | Non-batch lots cannot join to traceability batch header |
| Join key: to batch header (via lot) | Join to gold_inspection_lot then batch | Material/batch reachable | Reachable via inspection_lot join. Direct gold_batch_stock_v join not run (UD has no MATERIAL_ID/BATCH_ID columns) | Databricks CLI (user-authorised) | 2026-05-21 | partially verified | Two-hop join required: UD → inspection_lot → batch |
| Code/text distribution | Distinct code query | Raw values captured, no release mapping | 9 codes: A (13.97M, 90.3%), AE (1.15M, 7.5%), AC (178K, 1.2%), R (97K, 0.6%), ACE (36K), RE (29K), A9 (6K), RR (3K), '' (269) | Databricks CLI (user-authorised) | 2026-05-21 | verified | Raw codes only. No mapping to release status. |
| Valuation code distribution | Distinct valuation query | Raw values captured | 3 values: A (15.34M, 99.2%), R (130K, 0.8%), '' (269) | Databricks CLI (user-authorised) | 2026-05-21 | verified | Raw values only. |
| Null/empty code frequency | Null/empty check | Null rate documented | 0 null codes; 269 empty-string codes | Databricks CLI (user-authorised) | 2026-05-21 | verified | |
| Historical vs. current-state | Multi-row per lot check + date range | Source type documented | Historical. Date range 1900-01-01 to 2026-05-15. Multiple rows per lot; counter blank → '1' → '2'... | Databricks CLI (user-authorised) | 2026-05-21 | verified | 1900-01-01 rows are data quality anomaly (SAP default date). Do not filter without business owner confirmation. |
| UAT traceability candidate match | Join via inspection_lot for mat=20052009, batch=0008602411 | Row found or explicitly absent | **Found.** Lot 030005059533, code=A, valuation=A, counter=blank, date=2024-08-27, plant=C061 | Databricks CLI (user-authorised) | 2026-05-21 | verified | USAGE_DECISION_LONG_TEXT empty for this batch |

Status values:
- `not run`
- `verified`
- `verified (inferred)`
- `partially verified`
- `not found`
- `blocked`
- `unexpected`

---

## 14. Go/No-Go Criteria

### Go — usage-decision display may be added when

All of these are now met as of 2026-05-21 (except the governance gate):

- [x] The authoritative object is confirmed with `DESCRIBE` evidence. (`gold_inspection_usage_decision`, 13 columns)
- [x] Column names are captured (not assumed from V1). (All 13 columns verified)
- [x] Grain is verified: one row per (inspection_lot_id, usage_decision_counter), historical source. (Verified)
- [x] At least one join key to material/batch or inspection lot is verified without fan-out. (Join to `gold_inspection_lot` works; two-hop join required)
- [x] At least one raw code/text value is captured from the actual object. (9 codes captured)
- [ ] **No release-status mapping is required for the first display slice.** Still blocked on governance — raw code/text display only until QM process owner confirms mapping.

### No-Go — do not wire until

- Object does not exist or cannot be queried. *(cleared)*
- Column names are not captured. *(cleared)*
- Grain is unknown. *(cleared — grain is (lot_id, counter), historical)*
- Join key produces fan-out or unexpected row counts. *(cleared — join to inspection_lot confirmed)*
- **Usage-decision code semantics are unknown but release status is requested.** *(ACTIVE — governance required)*
- Any release/reject action, SAP QM write-back, e-signature, or GxP workflow is requested. *(permanent constraint)*
- Service-principal fallback would be needed. *(permanent constraint)*

---

## 15. Backlog Items

| Priority | Item | Notes |
|---|---|---|
| P0 | Get governed SAP QM code mapping from Kerry Quality/QM process owner | Required before any accepted/released/rejected display. Codes A, AE, AC, R, ACE, RE, A9, RR observed — meanings unconfirmed. |
| P0 | Clarify 1900-01-01 date anomaly with QM process owner | Likely SAP default; confirm before filtering |
| P1 | Verify USAGE_DECISION_CODE suffix semantics (E, C, 9) | E = electronic? C = conditional? 9 = restricted? — requires process owner input |
| P1 | Determine null/absent UD semantics | Does no row = no decision taken or lot type does not require UD? |
| P1 | Verify QUALITY_SCORE distribution and display meaning | Column exists; value distribution not run |
| P1 | Verify INSPECTION_LOT_TYPE distribution | Which lot types carry usage decisions vs. not? |
| P1 | Verify leading-zero consistency across `gold_inspection_lot` and `gold_batch_lineage` | UAT candidate used unpadded form in both; formal cross-object check pending |
| P2 | Run SHOW CREATE TABLE for source definition | DESCRIBE covers columns; CREATE may reveal view definition and lineage |
| P2 | Verify USAGE_DECISION_COUNTER > 9 behaviour | Max observed = 5; string ordering breaks at two digits |
| P3 | Cross-domain consumption plan review once evidence is populated | See `qm-usage-decision-cross-domain-consumption-plan.md` |
