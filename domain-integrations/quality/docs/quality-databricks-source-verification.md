# Quality Databricks Source Verification Pack

**Status:** not run
**Created:** 2026-05-21
**Purpose:** Prepare source verification before any native V2 Quality read-only evidence implementation.

These are V1-discovered candidate sources. This document does not claim they exist or are authoritative in the current UAT workspace until the evidence table is populated.

## 1. Purpose

This pack gives a Databricks-connected tester the checks needed to verify the Quality evidence sources identified during V1 discovery. It is deliberately conservative:

- No native Quality route should be implemented from this pack until the evidence table is populated.
- Missing usage-decision data must not be interpreted as accepted or released.
- Missing deviation/notification data must not be interpreted as no deviations.
- CoA-like result rows must not be interpreted as official CoA document approval.
- Result valuation must not be treated as SAP release status without governed mapping.

## 2. Known V1-Discovered Candidate Sources

| Candidate Source | V1 Evidence | Candidate Purpose | Verification Status |
|---|---|---|---|
| `vw_gold_inspection_result` | ConnectedQuality Lab Board, POH order detail | MIC / characteristic result rows | not run |
| `vw_gold_inspection_specification` | ConnectedQuality Lab Board, POH order detail | MIC specification / tolerance metadata | not run |
| `vw_gold_inspection_lot` | POH order detail | Inspection lot to process-order usage decision join | not run |
| `vw_gold_inspection_usage_decision` | ConnectedQuality, POH order detail | Usage-decision code, valuation, score, created by/date | not run |
| `vw_gold_quality_result_enriched` | POH Quality Analytics | Plant/date quality analytics rows | not run |
| `metric_quality_daily` | POH Quality Analytics | Pre-computed daily accepted/rejected counts | not run |
| `gold_batch_quality_lot_v` | Trace2 quality record | Batch quality inspection lot evidence | not run |
| `gold_batch_quality_result_v` | Trace2 quality record | Batch MIC / result / tolerance evidence | not run |
| `gold_batch_quality_summary_v` | Trace2 quality record | Batch-level quality result counts | not run |
| `gold_batch_coa_results_v` | Trace2 CoA page | CoA-like result evidence | not run |

## 3. What Is Not Verified Yet

The following are not verified by V1 discovery alone:

- Current UAT object existence in `connected_plant_uat.gold`.
- Current column names and types.
- Primary grain and uniqueness.
- Whether source rows are complete enough for V2 Quality UAT.
- Governed mappings for `INSPECTION_RESULT_VALUATION`, `USAGE_DECISION_CODE`, or `VALUATION_CODE`.
- Any release-approved, can-release, accepted, rejected, or conditional semantics.
- Official CoA document status, PDF generation, approval, sign-off, or versioning.
- Deviation, nonconformance, defect, or quality-notification source availability.

## 4. Object Inventory SQL

Run these first to discover the actual UAT object names. Do not assume the candidate names exist.

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*inspection*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*quality*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*usage*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*decision*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*coa*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*certificate*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*deviation*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*notification*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*qmel*';
```

Record every matching table or view in the evidence table at the end of this document.

## 5. DESCRIBE / SHOW CREATE SQL

Run these only for objects found in the inventory step.

```sql
DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_result;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_inspection_result;

DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_specification;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_inspection_specification;

DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_lot;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_inspection_lot;

DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_usage_decision;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_inspection_usage_decision;

DESCRIBE TABLE connected_plant_uat.gold.vw_gold_quality_result_enriched;
SHOW CREATE TABLE connected_plant_uat.gold.vw_gold_quality_result_enriched;

DESCRIBE TABLE connected_plant_uat.gold.metric_quality_daily;
SHOW CREATE TABLE connected_plant_uat.gold.metric_quality_daily;

DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_lot_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_lot_v;

DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;

DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_summary_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_quality_summary_v;

DESCRIBE TABLE connected_plant_uat.gold.gold_batch_coa_results_v;
SHOW CREATE TABLE connected_plant_uat.gold.gold_batch_coa_results_v;
```

## 6. Column Verification SQL

Use `DESCRIBE` output to populate the column evidence before running any row-level checks.

```sql
-- Inspection result candidate columns
DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_result;

-- Specification candidate columns
DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_specification;

-- Inspection lot candidate columns
DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_lot;

-- Usage decision candidate columns
DESCRIBE TABLE connected_plant_uat.gold.vw_gold_inspection_usage_decision;

-- Batch result / lot / summary / CoA candidate columns
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_lot_v;
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_summary_v;
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_coa_results_v;
```

Expected evidence to capture:

| Concept | Candidate Column Names From V1 | Required For Native V2? | Actual Verified Column(s) |
|---|---|---:|---|
| Inspection lot ID | `INSPECTION_LOT_ID` | Yes | TBD |
| Plant ID | `PLANT_ID` | Yes | TBD |
| Material ID | `MATERIAL_ID` | Yes | TBD |
| Batch ID | `BATCH_ID` | Yes | TBD |
| Process order ID | `PROCESS_ORDER_ID` | Optional / useful | TBD |
| MIC / characteristic ID | `MIC_ID`, `MIC_CODE`, `INSPECTION_CHARACTERISTIC_ID` | Yes | TBD |
| MIC name | `MIC_NAME`, `characteristic_name`, `characteristic_description` | Useful | TBD |
| Result value | `QUANTITATIVE_RESULT`, `QUALITATIVE_RESULT`, `actual_result` | Yes | TBD |
| Unit | `UNIT_OF_MEASURE`, `uom` | Useful | TBD |
| Specification | `TARGET_VALUE`, `UPPER_TOLERANCE`, `LOWER_TOLERANCE`, `TOLERANCE`, `specification` | Useful | TBD |
| Valuation | `INSPECTION_RESULT_VALUATION`, `valuation`, `result_status`, `valuation_code` | Yes, display only | TBD |
| Usage decision | `USAGE_DECISION_CODE`, `USAGE_DECISION_LONG_TEXT`, `VALUATION_CODE` | Display after mapping verified | TBD |
| CoA result | `mic_code`, `actual_result`, `within_spec` | Optional read-only evidence | TBD |

## 7. Grain Verification SQL

Run after the column names are confirmed. Replace column names if the verified names differ.

```sql
-- Candidate inspection-result grain.
-- Expected: one row per inspection lot / operation / MIC / sample, if these columns exist.
SELECT
  INSPECTION_LOT_ID,
  OPERATION_ID,
  MIC_ID,
  SAMPLE_ID,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY INSPECTION_LOT_ID, OPERATION_ID, MIC_ID, SAMPLE_ID
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 50;

-- Candidate lot grain.
-- Expected: one row per inspection lot, or documented multiple rows if source is denormalized.
SELECT
  INSPECTION_LOT_ID,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.gold_batch_quality_lot_v
GROUP BY INSPECTION_LOT_ID
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 50;

-- Candidate batch-result coverage by material/batch.
SELECT
  MATERIAL_ID,
  BATCH_ID,
  COUNT(DISTINCT INSPECTION_LOT_ID) AS inspection_lot_count,
  COUNT(*) AS mic_result_count
FROM connected_plant_uat.gold.gold_batch_quality_result_v
WHERE MATERIAL_ID IS NOT NULL
  AND BATCH_ID IS NOT NULL
GROUP BY MATERIAL_ID, BATCH_ID
ORDER BY mic_result_count DESC
LIMIT 100;
```

If any column does not exist, do not rewrite business logic from memory. Record the actual available columns and update the proposed mapper later.

## 8. Usage-Decision Verification SQL

These checks are for source discovery, not release mapping. Do not map usage decisions to accepted/released until Quality/SAP owners confirm semantics.

```sql
-- Inventory available usage-decision columns and sample rows.
SELECT *
FROM connected_plant_uat.gold.vw_gold_inspection_usage_decision
LIMIT 25;

-- Candidate usage-decision value distribution.
-- Run only if these columns exist.
SELECT
  USAGE_DECISION_CODE,
  VALUATION_CODE,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.vw_gold_inspection_usage_decision
GROUP BY USAGE_DECISION_CODE, VALUATION_CODE
ORDER BY row_count DESC
LIMIT 100;

-- Candidate lot-to-usage-decision join.
-- Run only after DESCRIBE confirms join keys.
SELECT
  il.INSPECTION_LOT_ID,
  il.PLANT_ID,
  il.MATERIAL_ID,
  il.BATCH_ID,
  il.PROCESS_ORDER_ID,
  ud.USAGE_DECISION_CODE,
  ud.VALUATION_CODE,
  ud.QUALITY_SCORE,
  ud.USAGE_DECISION_CREATED_BY,
  ud.USAGE_DECISION_CREATED_DATE
FROM connected_plant_uat.gold.vw_gold_inspection_lot il
LEFT JOIN connected_plant_uat.gold.vw_gold_inspection_usage_decision ud
  ON ud.INSPECTION_LOT_ID = il.INSPECTION_LOT_ID
WHERE il.INSPECTION_LOT_ID IS NOT NULL
ORDER BY ud.USAGE_DECISION_CREATED_DATE DESC NULLS LAST
LIMIT 100;
```

Evidence to capture:

- Does a usage-decision object exist?
- Is the join key `INSPECTION_LOT_ID`, or something else?
- Are code/text/valuation/date/created-by fields present?
- Are there null decision rows for open lots?
- Which code values appear, without interpreting them as release statuses?

## 9. MIC / Result / Specification Verification SQL

```sql
-- MIC/result sample from candidate batch quality result view.
SELECT *
FROM connected_plant_uat.gold.gold_batch_quality_result_v
WHERE MATERIAL_ID IS NOT NULL
  AND BATCH_ID IS NOT NULL
LIMIT 50;

-- MIC/result value and valuation distribution.
SELECT
  MIC_ID,
  MIC_CODE,
  MIC_NAME,
  UNIT_OF_MEASURE,
  INSPECTION_RESULT_VALUATION,
  COUNT(*) AS row_count,
  COUNT(QUANTITATIVE_RESULT) AS quantitative_count,
  COUNT(QUALITATIVE_RESULT) AS qualitative_count
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY MIC_ID, MIC_CODE, MIC_NAME, UNIT_OF_MEASURE, INSPECTION_RESULT_VALUATION
ORDER BY row_count DESC
LIMIT 100;

-- Specification fields present on batch quality result rows.
SELECT
  MIC_ID,
  MIC_CODE,
  MIC_NAME,
  TARGET_VALUE,
  UPPER_TOLERANCE,
  LOWER_TOLERANCE,
  TOLERANCE,
  UNIT_OF_MEASURE,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY MIC_ID, MIC_CODE, MIC_NAME, TARGET_VALUE, UPPER_TOLERANCE, LOWER_TOLERANCE, TOLERANCE, UNIT_OF_MEASURE
ORDER BY row_count DESC
LIMIT 100;

-- Candidate POH-style result/spec join.
-- Run only if these objects and columns exist.
SELECT
  ir.INSPECTION_LOT_ID,
  ir.PROCESS_ORDER_ID,
  ir.INSPECTION_CHARACTERISTIC_ID,
  ir.SAMPLE_ID,
  ir.QUANTITATIVE_RESULT,
  ir.QUALITATIVE_RESULT,
  ir.INSPECTION_RESULT_VALUATION,
  spec.MIC_NAME,
  spec.TOLERANCE,
  spec.UNIT_OF_MEASURE
FROM connected_plant_uat.gold.vw_gold_inspection_result ir
LEFT JOIN connected_plant_uat.gold.vw_gold_inspection_specification spec
  ON spec.INSPECTION_CHARACTERISTIC_ID = ir.INSPECTION_CHARACTERISTIC_ID
 AND spec.INSPECTION_OPERATION_ID = ir.INSPECTION_OPERATION_ID
LIMIT 100;
```

Evidence to capture:

- Whether MIC identifiers are stable and whether leading zeros occur.
- Whether result values are numeric, qualitative, both, or nullable.
- Whether specification limits are present on the result view or require a specification join.
- Whether result valuation is source-provided and what raw values occur.

## 10. CoA Result Evidence Verification SQL

These queries verify CoA-like result evidence only. They do not verify official CoA document approval, download, versioning, or sign-off.

```sql
-- CoA-like result row sample.
SELECT *
FROM connected_plant_uat.gold.gold_batch_coa_results_v
LIMIT 50;

-- CoA-like result coverage by batch.
SELECT
  batch_id,
  COUNT(*) AS coa_result_count,
  COUNT(DISTINCT mic_code) AS distinct_mic_count
FROM connected_plant_uat.gold.gold_batch_coa_results_v
GROUP BY batch_id
ORDER BY coa_result_count DESC
LIMIT 100;

-- CoA-like result status distribution.
SELECT
  result_status,
  within_spec,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.gold_batch_coa_results_v
GROUP BY result_status, within_spec
ORDER BY row_count DESC
LIMIT 100;
```

Evidence to capture:

- Does the source contain only result rows, or document metadata as well?
- Is there a certificate/document number, approval timestamp, approver, version, or PDF pointer?
- If document metadata is absent, V2 must label this as CoA result evidence only.

## 11. Deviation / Notification Source-Discovery SQL

No live deviation/nonconformance/QM notification source was proven during V1 discovery. Use these checks only to discover candidate objects.

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*deviation*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*nonconformance*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*non_conformance*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*notification*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*qmel*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*defect*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*hold*';
```

For any discovered object:

```sql
DESCRIBE TABLE connected_plant_uat.gold.<candidate_object_name>;
SHOW CREATE TABLE connected_plant_uat.gold.<candidate_object_name>;
SELECT * FROM connected_plant_uat.gold.<candidate_object_name> LIMIT 25;
```

Do not interpret "no matching objects" as "no deviations exist." Record source as not found or blocked.

## 12. Golden Candidate Discovery SQL

The goal is to find candidate batches/lots with enough source evidence for read-only UAT. Do not invent expected counts.

```sql
-- Candidate batches with inspection lots and MIC result rows.
SELECT
  MATERIAL_ID,
  BATCH_ID,
  PLANT_ID,
  PROCESS_ORDER_ID,
  COUNT(DISTINCT INSPECTION_LOT_ID) AS inspection_lot_count,
  COUNT(*) AS mic_result_count,
  COUNT(CASE WHEN INSPECTION_RESULT_VALUATION IS NOT NULL THEN 1 END) AS valued_result_count
FROM connected_plant_uat.gold.gold_batch_quality_result_v
WHERE MATERIAL_ID IS NOT NULL
  AND BATCH_ID IS NOT NULL
GROUP BY MATERIAL_ID, BATCH_ID, PLANT_ID, PROCESS_ORDER_ID
HAVING COUNT(*) > 0
ORDER BY mic_result_count DESC
LIMIT 100;

-- Candidate batches with both lot and usage-decision evidence.
-- Run only after usage-decision columns are verified.
SELECT
  l.MATERIAL_ID,
  l.BATCH_ID,
  l.PLANT_ID,
  l.PROCESS_ORDER_ID,
  COUNT(DISTINCT l.INSPECTION_LOT_ID) AS inspection_lot_count,
  COUNT(DISTINCT ud.USAGE_DECISION_CODE) AS distinct_usage_decision_code_count
FROM connected_plant_uat.gold.gold_batch_quality_lot_v l
LEFT JOIN connected_plant_uat.gold.vw_gold_inspection_usage_decision ud
  ON ud.INSPECTION_LOT_ID = l.INSPECTION_LOT_ID
WHERE l.MATERIAL_ID IS NOT NULL
  AND l.BATCH_ID IS NOT NULL
GROUP BY l.MATERIAL_ID, l.BATCH_ID, l.PLANT_ID, l.PROCESS_ORDER_ID
ORDER BY inspection_lot_count DESC
LIMIT 100;

-- Candidate batches with CoA-like result evidence.
SELECT
  batch_id,
  COUNT(*) AS coa_result_count,
  COUNT(DISTINCT mic_code) AS distinct_mic_count
FROM connected_plant_uat.gold.gold_batch_coa_results_v
GROUP BY batch_id
HAVING COUNT(*) > 0
ORDER BY coa_result_count DESC
LIMIT 100;
```

Candidate capture fields:

| Field | Source |
|---|---|
| `plantId` | Verified lot/result source |
| `materialId` | Verified lot/result source |
| `batchId` | Verified lot/result/CoA source |
| `inspectionLotId` | Verified lot source |
| `processOrderId` | Verified lot/result source, if present |
| `micResultCount` | Verified result source count |
| `usageDecisionCode/Text` | Verified usage-decision source, if present |
| `coaResultCount` | Verified CoA-like result source count |
| `deviationCount` | Only if a deviation/notification source is verified |

## 13. Evidence Capture Table

| Check | SQL Run | Expected Evidence | Actual Result | Verified By | Date | Status | Notes |
|---|---|---|---|---|---|---|---|
| Object inventory: inspection | `SHOW TABLES ... '*inspection*'` | Candidate inspection objects listed | TBD | TBD | TBD | not run |  |
| Object inventory: quality | `SHOW TABLES ... '*quality*'` | Candidate quality objects listed | TBD | TBD | TBD | not run |  |
| Object inventory: usage/decision | `SHOW TABLES ... '*usage*'`, `'*decision*'` | Usage-decision candidate found or marked not found | TBD | TBD | TBD | not run |  |
| Object inventory: CoA/certificate | `SHOW TABLES ... '*coa*'`, `'*certificate*'` | CoA/certificate candidate found or marked not found | TBD | TBD | TBD | not run |  |
| Object inventory: deviation/notification | `SHOW TABLES ... '*deviation*'`, `'*notification*'`, `'*qmel*'` | Deviation source found or marked not found | TBD | TBD | TBD | not run |  |
| DESCRIBE candidate sources | `DESCRIBE TABLE ...` | Columns and types captured | TBD | TBD | TBD | not run |  |
| SHOW CREATE candidate sources | `SHOW CREATE TABLE ...` | Source object definitions captured | TBD | TBD | TBD | not run |  |
| Grain: inspection results | Group by lot/operation/MIC/sample | Grain confirmed or exceptions recorded | TBD | TBD | TBD | not run |  |
| Grain: inspection lots | Group by lot | Lot grain confirmed or exceptions recorded | TBD | TBD | TBD | not run |  |
| Usage decision distribution | Group by raw code/valuation | Raw values captured with no release mapping | TBD | TBD | TBD | not run |  |
| MIC/result/spec sample | Result/spec sample and distributions | MIC/result/spec fields confirmed | TBD | TBD | TBD | not run |  |
| CoA-like result sample | CoA result sample/distribution | Result evidence vs document metadata classified | TBD | TBD | TBD | not run |  |
| Golden candidate discovery | Candidate batch/lot queries | Candidate recorded or explicitly not found | TBD | TBD | TBD | not run |  |

Status values:

- `not run`
- `verified`
- `partially verified`
- `not found`
- `blocked`
- `unexpected`

## 14. Go / No-Go Criteria For Native Implementation

### Go

A native V2 read-only Quality implementation may begin when:

- At least one inspection lot source is verified with stable lot/material/batch/plant keys.
- At least one MIC/result source is verified with result and valuation fields.
- Specification/tolerance fields are verified or explicitly classified as unavailable.
- Usage-decision fields are verified if usage-decision display is in scope.
- At least one golden candidate is identified with source-backed evidence.
- The mapper design preserves SAP/source identifiers as strings.
- No release decision mapping is required for the first slice.

### No-Go

Do not implement native runtime behavior if:

- Candidate objects are not found or cannot be queried.
- Column names/types are not captured.
- The result grain is unknown.
- Usage-decision code semantics are unknown but release status is requested.
- CoA document approval/sign-off is requested but only result rows are verified.
- Deviation/notification source is missing but no-deviation claims are requested.
- The proposed route would need service-principal fallback, app-side plant authorization, or mock fallback in `databricks-api` mode.

## 15. Recommended First Native Slice After Verification

After this pack is populated, the first implementation should be:

**Read-only inspection lot + MIC result evidence for a verified material/batch/plant candidate.**

Keep usage-decision display optional until mapping is governed. Keep CoA-like result evidence separate from CoA document approval. Keep SPC links advisory only.
