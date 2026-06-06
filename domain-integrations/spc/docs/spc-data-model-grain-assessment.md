# SPC Data Model Grain Assessment

**Date:** 2026-05-21
**Status:** Partially verified 2026-05-21 — grain confirmed for primary objects; see Evidence Captured section
**Catalog target:** `connected_plant_uat.gold`

> **IMPORTANT:** All grain candidates below were derived from V1 source code analysis.
> Live Databricks evidence was captured on 2026-05-21 by tim.geldard@kerry.com.
> See "## Evidence Captured 2026-05-21" section below for verified grain conclusions.

---

## 1. Purpose

This document defines the expected data grain for each primary SPC object in
`connected_plant_uat.gold`, explains why grain matters for V2 implementation, and provides SQL
queries to verify the grain claims before native V2 SPC routes are implemented.

Grain errors (incorrect grain assumptions) lead to:
- Silent row duplication or fan-out in aggregates
- Navigation model breakage (too many/too few rows per drill-down step)
- Incorrect capability calculations (if rows are not deduplicated correctly)
- Control chart rendering issues (plotting duplicate or missing points)

---

## 2. Grain Candidates by Object

### 2.1 `spc_quality_metric_subgroup_v`

**Expected grain (from V1 source):** One row per measurement sample point within a subgroup,
keyed by `(material_id, plant_id, mic_id, operation_id, batch_id, sample_id)`.

**Why grain matters for V2:**
- The V2 `ControlChartPoint` contract expects one point per timestamp per chart. If the grain is
  at a sub-sample level (e.g., one row per individual observation within a subgroup), then V2
  must group by `sample_id` or `batch_id` before plotting.
- If `subgroup_mean` is already aggregated per subgroup, a second GROUP BY in V2 would cause
  errors.
- The `subgroup_mean`, `subgroup_range`, and `subgroup_sd` columns suggest subgroup statistics
  have already been computed — implying the grain is per-subgroup, not per-individual-observation.
  This needs confirmation.

**Grain check queries:**

```sql
-- 1. Total row count
SELECT COUNT(*) AS total_rows
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v;

-- 2. Unique (material_id, plant_id, mic_id) combinations
SELECT COUNT(DISTINCT CONCAT(material_id, '|', plant_id, '|', mic_id))
  AS distinct_material_plant_mic_combinations
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v;

-- 3. Check if (material_id, plant_id, mic_id, operation_id, batch_id, sample_id) is unique
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id,
  batch_id,
  sample_id,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
GROUP BY material_id, plant_id, mic_id, operation_id, batch_id, sample_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 20;
-- If this returns rows: grain is NOT unique on this key combination
-- If this returns no rows: grain confirmed unique on this key combination

-- 4. Check subgroup sizes (are multiple result_values present per subgroup?)
SELECT
  material_id,
  plant_id,
  mic_id,
  batch_id,
  COUNT(*) AS samples_in_subgroup
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
GROUP BY material_id, plant_id, mic_id, batch_id
ORDER BY samples_in_subgroup DESC
LIMIT 20;
-- This tells us whether subgroup_mean is already aggregated or if individual rows need grouping

-- 5. Date range of available data
SELECT
  material_id,
  plant_id,
  mic_id,
  MIN(sample_timestamp) AS earliest_sample,
  MAX(sample_timestamp) AS latest_sample,
  COUNT(*) AS total_samples,
  COUNT(DISTINCT batch_id) AS distinct_batches
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
GROUP BY material_id, plant_id, mic_id
ORDER BY total_samples DESC
LIMIT 20;
```

### 2.2 `spc_locked_limits`

**Expected grain (from V1 source):** One row per `(material_id, mic_id, plant_id, operation_id, chart_type)`.
Multiple limit sets may exist for the same MIC if effective date ranges do not overlap.

**Why grain matters for V2:**
- The V2 `ControlChartSeries` expects a single set of control limits (UCL, LCL, CL) per chart.
  If multiple rows exist for the same (material, mic, plant, chart_type), V2 must select by
  effective date or version to avoid ambiguity.
- If `effective_from`/`effective_to` (or `baseline_from`/`baseline_to`) are present and allow
  multiple active rows, the V2 query must filter by current timestamp.

**Grain check queries:**

```sql
-- 1. Total row count
SELECT COUNT(*) AS total_rows
FROM connected_plant_uat.gold.spc_locked_limits;

-- 2. Check if PK (material_id, mic_id, plant_id, operation_id, chart_type) is unique
SELECT
  material_id,
  mic_id,
  plant_id,
  operation_id,
  chart_type,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.spc_locked_limits
GROUP BY material_id, mic_id, plant_id, operation_id, chart_type
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 20;
-- If rows returned: multiple limit sets per (material, mic, chart_type) exist
-- V2 query must filter by effective date

-- 3. Range of locked limits (check if any are expired)
SELECT
  COUNT(*) AS total_limit_rows,
  COUNT(DISTINCT material_id) AS distinct_materials,
  COUNT(DISTINCT mic_id) AS distinct_mics,
  COUNT(DISTINCT plant_id) AS distinct_plants
FROM connected_plant_uat.gold.spc_locked_limits;

-- 4. Sample the PK values
SELECT material_id, mic_id, plant_id, operation_id, chart_type, locked_at
FROM connected_plant_uat.gold.spc_locked_limits
ORDER BY locked_at DESC
LIMIT 20;
```

### 2.3 `spc_capability_detail_mv`

**Expected grain (from V1 source):** One row per `(material_id, plant_id, mic_id)`.
Represents the most recent computed capability metrics for that characteristic.

**Why grain matters for V2:**
- The V2 `CharacteristicCapability` contract expects a single Cp/Cpk/Pp/Ppk value per
  characteristic. If the MV has multiple rows per MIC (e.g., one per time window), V2 must
  select the most recent.
- The MV refresh cycle is 4 hours — values may be stale relative to subgroup data.

**Grain check queries:**

```sql
-- 1. Total row count
SELECT COUNT(*) AS total_rows
FROM connected_plant_uat.gold.spc_capability_detail_mv;

-- 2. Check if (material_id, plant_id, mic_id) is unique
SELECT
  material_id,
  plant_id,
  mic_id,
  COUNT(*) AS row_count
FROM connected_plant_uat.gold.spc_capability_detail_mv
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 20;

-- 3. Sample with capability values
SELECT
  material_id,
  plant_id,
  mic_id,
  cp,
  cpk,
  pp,
  ppk
FROM connected_plant_uat.gold.spc_capability_detail_mv
WHERE cpk IS NOT NULL
ORDER BY cpk DESC
LIMIT 20;
```

### 2.4 `spc_material_dim_mv`

**Expected grain:** One row per `material_id` that has SPC data.

```sql
SELECT COUNT(*) AS total_rows FROM connected_plant_uat.gold.spc_material_dim_mv;

SELECT material_id, COUNT(*) AS count
FROM connected_plant_uat.gold.spc_material_dim_mv
GROUP BY material_id
HAVING COUNT(*) > 1;
-- Should return no rows if grain is correct
```

### 2.5 `spc_characteristic_dim_mv`

**Expected grain:** One row per `(material_id, plant_id, mic_id)`.

```sql
SELECT COUNT(*) AS total_rows FROM connected_plant_uat.gold.spc_characteristic_dim_mv;

SELECT material_id, plant_id, mic_id, COUNT(*) AS count
FROM connected_plant_uat.gold.spc_characteristic_dim_mv
GROUP BY material_id, plant_id, mic_id
HAVING COUNT(*) > 1;
```

### 2.6 `spc_nelson_rule_flags_mv`

**Expected grain (from V1 source):** One row per `(material_id, plant_id, mic_id, batch_id)`.
This is a batch-level rule flag summary, not a point-level signal.

```sql
SELECT COUNT(*) AS total_rows FROM connected_plant_uat.gold.spc_nelson_rule_flags_mv;

SELECT material_id, plant_id, mic_id, batch_id, COUNT(*) AS count
FROM connected_plant_uat.gold.spc_nelson_rule_flags_mv
GROUP BY material_id, plant_id, mic_id, batch_id
HAVING COUNT(*) > 1;
```

---

## 3. Grain Conclusion Table

| Object | Candidate Grain | Evidence Query | Result | Grain Confidence | V2 Impact |
|--------|----------------|----------------|--------|-----------------|-----------|
| `spc_quality_metric_subgroup_v` / `spc_quality_metric_subgroup_mv` | Measurement-level: one row per individual quality measurement within a batch | Grain analysis 2026-05-21 | `(material_id, plant_id, mic_id, operation_id, batch_id)` is NOT unique; multiple rows per batch (one per measurement); `batch_n` = sample count; `value` = individual measurement; `subgroup_rep` is NOT a reliable discriminator; `P999` is a sentinel plant with blank material_id | medium | V2 must NOT assume pre-aggregated subgroup statistics. `subgroup_mean` must be derived as `sum_value / batch_n`; `subgroup_range` is `batch_range`. One point per batch for chart rendering requires aggregation or use of MV-level aggregates. |
| `spc_locked_limits` | `(material_id, mic_id, plant_id, operation_id, chart_type)` | HAVING COUNT(*) > 1 on PK | 1 row total in UAT; PK unique confirmed | high | No filtering by effective date needed for current UAT data. Single row per MIC. |
| `spc_capability_detail_mv` | `(material_id, plant_id, mic_id)` most recent | HAVING COUNT(*) > 1 | Object NOT FOUND in UAT — migration 013 not applied | N/A | Capability grain cannot be confirmed; object absent. See capability verification doc. |
| `spc_material_dim_mv` | `material_id` | HAVING COUNT(*) > 1 | 138,051 rows confirmed | high | Navigation layer. Grain matches expectation. |
| `spc_plant_material_dim_mv` | `(plant_id, material_id)` | HAVING COUNT(*) > 1 | 87,336 rows confirmed | high | Navigation layer. |
| `spc_characteristic_dim_mv` | `(material_id, plant_id, mic_id)` | HAVING COUNT(*) > 1 | 3,017,410 rows confirmed | high | MIC list navigation. Schema confirmed. |
| `spc_nelson_rule_flags_mv` | `(material_id, plant_id, mic_id, batch_id)` | HAVING COUNT(*) > 1 | Object NOT FOUND in UAT — migration 012 not applied | N/A | Object absent; batch-level rule flag summaries unavailable from Databricks. |

Grain confidence levels: `high` | `medium` | `low` | `unknown`

---

## 4. Grain Findings and V2 Recommendations

> This section is blank until evidence is captured. Do not fill in speculatively.

### 4.1 `spc_quality_metric_subgroup_v`

- **Verified grain:** — pending —
- **Subgroup mean pre-computed?** — pending —
- **V2 recommendation:** — pending —

### 4.2 `spc_locked_limits`

- **Verified grain:** — pending —
- **Multiple rows per MIC?** — pending —
- **Effective date filtering needed?** — pending —
- **V2 recommendation:** — pending —

### 4.3 `spc_capability_detail_mv`

- **Verified grain:** — pending —
- **Values populated?** — pending —
- **V2 recommendation:** — pending —

## 5. Evidence Captured 2026-05-21

**Verified by:** tim.geldard@kerry.com via Databricks CLI, warehouse `e76480b94bea6ed5` (`connected_plant_uat`)
**Date:** 2026-05-21

### 5.1 `spc_quality_metric_subgroup_mv` — Grain Conclusion

**Conclusion:** Measurement-level grain. One row per individual quality measurement within a batch.

Key findings:
- The combination `(material_id, plant_id, mic_id, operation_id, batch_id)` is NOT unique — same batch has multiple measurement rows (one per individual sample within the batch)
- `batch_n` = total number of samples in the batch (same value on all rows for that batch)
- `value` = individual measurement value
- `subgroup_rep` = meaning unclear; observed values 0, 0, 0, 0, 1 for a batch_n=5 (inconsistent with a 0-based row index, which would yield 0–4); may be a repetition flag or non-unique counter — NOT a reliable unique discriminator
- `P999` is a sentinel/aggregate plant ID with blank `material_id` — large volume of rows; not real production material data
- **Grain confidence: medium** — data is measurement-level but the discriminating column for individual observations is not formally documented in the schema

**V2 recommendation:**
- For control chart rendering: group by `(material_id, plant_id, mic_id, operation_id, batch_id)` and use `sum_value / batch_n` as the subgroup mean, `batch_range` as the range
- Do NOT attempt to plot individual `value` rows as separate chart points without understanding the batch aggregation
- Use `spc_quality_metric_subgroup_mv` (not the view) for queries due to volume (73,452,925 rows)
- Filter out sentinel plant `P999` and blank `material_id` rows

### 5.2 `spc_locked_limits` — Grain Conclusion

**Conclusion:** Grain is `(material_id, mic_id, plant_id, operation_id, chart_type)` — confirmed unique (1 row in UAT).

Key findings:
- 1 row total in UAT (UAT test fixture, not production-representative)
- PK combination confirmed unique
- `baseline_from` / `baseline_to` are empty in the UAT row — no effective date filtering needed in current UAT data
- No duplicate limit sets per MIC
- **Grain confidence: high** — per V1 source analysis plus live evidence

**V2 recommendation:**
- Query is straightforward: single row per `(material_id, mic_id, plant_id, operation_id, chart_type)`
- No effective-date filtering required in current UAT, but V2 should be designed to handle it if future rows have `baseline_from`/`baseline_to` set

### 5.3 `spc_capability_detail_mv` — Not Available

Object NOT FOUND in `connected_plant_uat.gold`. Migration 013 not applied in UAT.
Grain cannot be assessed. See spc-capability-verification.md for full classification.

### 5.4 Row Counts Confirmed (2026-05-21)

| Object | Row Count | Notes |
|--------|-----------|-------|
| `spc_quality_metric_subgroup_mv` | 73,452,925 | Includes sentinel P999 rows |
| `spc_quality_metric_subgroup_v` | timed out (large view) | Use MV instead |
| `spc_locked_limits` | 1 | UAT test fixture |
| `spc_characteristic_dim_mv` | 3,017,410 | |
| `spc_material_dim_mv` | 138,051 | |
| `spc_plant_material_dim_mv` | 87,336 | |
| `spc_batch_dim_mv` | 2,164,058 | |
| `spc_exclusions` | 6 | |
| `spc_mic_chart_config` | 0 | |
