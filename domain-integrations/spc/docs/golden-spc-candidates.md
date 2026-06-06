# Golden SPC Candidates — UAT Data Register

**Date updated:** 2026-05-21
**Status:** 2 primary candidates + 1 multi-MIC candidate found 2026-05-21 via Databricks CLI.
All partially verified — see Section 5.
**UAT Target Catalog:** `connected_plant_uat.gold`

> **IMPORTANT:** No candidate values (material IDs, plant IDs, MIC IDs) have been invented,
> assumed, or pre-populated. Every field in the candidate evidence template must be populated
> from actual `connected_plant_uat.gold` query results by a person with live Databricks access.
> Do NOT add a candidate based on documentation guesswork.

---

## 1. Current Status

| Item | Status |
|------|--------|
| V1 source objects discovered | Complete (code analysis only) |
| Confirmed candidates in UAT | 3 found 2026-05-21 (partially verified) — see Section 5 |
| Candidate discovery queries ready | Yes — see Section 2 |
| Evidence template ready | Yes — see Section 3 |
| Validation checklist ready | Yes — see Section 4 |

SPC data exists in `connected_plant_uat.gold` per V1 source code and migration scripts.
However, whether any specific material/plant/MIC combination has real SPC data in the UAT
environment is unknown until the discovery queries below are run.

---

## 2. Candidate Discovery SQL

### 2.1 Primary candidate discovery query

Run this in a Databricks SQL Editor with access to `connected_plant_uat`:

```sql
-- Primary candidate discovery: find material/plant/MIC combinations with >= 20 batches
-- of SPC data in the last 90 days
SELECT
  s.material_id,
  s.plant_id,
  s.mic_id,
  s.operation_id,
  COUNT(DISTINCT s.batch_id)  AS batch_count,
  COUNT(*)                    AS sample_point_count,
  MIN(s.sample_timestamp)     AS date_from,
  MAX(s.sample_timestamp)     AS date_to,
  -- Check if locked limits exist for this combination
  CASE WHEN l.material_id IS NOT NULL THEN 'locked_limits_exist' ELSE 'live_only' END
    AS limit_source
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v s
LEFT JOIN connected_plant_uat.gold.spc_locked_limits l
  ON  s.material_id = l.material_id
  AND s.mic_id      = l.mic_id
  AND (s.plant_id   = l.plant_id  OR l.plant_id IS NULL)
WHERE s.sample_timestamp >= DATEADD(day, -90, CURRENT_TIMESTAMP())
GROUP BY
  s.material_id,
  s.plant_id,
  s.mic_id,
  s.operation_id,
  CASE WHEN l.material_id IS NOT NULL THEN 'locked_limits_exist' ELSE 'live_only' END
HAVING COUNT(DISTINCT s.batch_id) >= 20
ORDER BY sample_point_count DESC
LIMIT 20;
```

> Note: Column names `sample_timestamp`, `material_id`, `plant_id`, `mic_id`, `operation_id`,
> `batch_id` in `spc_quality_metric_subgroup_v` are from V1 migration source analysis. Verify
> against live `DESCRIBE TABLE` output before running this query.

> Note: Column names `material_id`, `mic_id`, `plant_id` in `spc_locked_limits` are from V1
> source. Verify similarly.

### 2.2 Lower threshold discovery (if >= 20 batches returns no results)

```sql
-- Relaxed threshold: find combinations with >= 5 batches
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id,
  COUNT(DISTINCT batch_id)  AS batch_count,
  COUNT(*)                  AS sample_point_count,
  MIN(sample_timestamp)     AS date_from,
  MAX(sample_timestamp)     AS date_to
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE sample_timestamp >= DATEADD(day, -180, CURRENT_TIMESTAMP())
GROUP BY material_id, plant_id, mic_id, operation_id
HAVING COUNT(DISTINCT batch_id) >= 5
ORDER BY sample_point_count DESC
LIMIT 20;
```

### 2.3 Chart type discovery for a candidate

After identifying a candidate material/plant/MIC, determine the expected chart type:

```sql
-- Check if a chart type override exists for this MIC
SELECT *
FROM connected_plant_uat.gold.spc_mic_chart_config
WHERE material_id = '<candidate_material>'
  AND plant_id    = '<candidate_plant>'
  AND mic_id      = '<candidate_mic>';

-- If no override, derive from subgroup size (xbar_r for n > 1, imr for n = 1)
SELECT
  batch_id,
  COUNT(*) AS samples_in_subgroup
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
WHERE material_id = '<candidate_material>'
  AND plant_id    = '<candidate_plant>'
  AND mic_id      = '<candidate_mic>'
GROUP BY batch_id
ORDER BY batch_id
LIMIT 20;
```

### 2.4 Capability check for a candidate

```sql
SELECT *
FROM connected_plant_uat.gold.spc_capability_detail_mv
WHERE material_id = '<candidate_material>'
  AND plant_id    = '<candidate_plant>'
  AND mic_id      = '<candidate_mic>';
```

### 2.5 Locked limits check for a candidate

```sql
SELECT *
FROM connected_plant_uat.gold.spc_locked_limits
WHERE material_id = '<candidate_material>'
  AND mic_id      = '<candidate_mic>';
```

---

## 3. Candidate Evidence Template

When a candidate is confirmed from live UAT query results, create a new entry using this
template. Do NOT pre-populate any field. All values must come from actual query results.

```markdown
### Candidate: [Material Description / Plant Name / MIC Name — to be filled from query]

| Field | Value |
|-------|-------|
| Material ID | — (from query result) |
| Material Name | — (from dimension MV or description lookup) |
| Plant ID | — (from query result) |
| Plant Name | — (from gold_plant or dimension MV) |
| MIC ID | — (from query result) |
| MIC Name | — (from characteristic_dim_mv.mic_name) |
| Operation ID | — (from query result; may be NULL) |
| Chart Type (V1) | — (from spc_mic_chart_config or subgroup size heuristic) |
| Date From | — (from MIN(sample_timestamp) in query) |
| Date To | — (from MAX(sample_timestamp) in query) |
| Expected Point Count | — (from sample_point_count in query) |
| Expected Batch Count | — (from batch_count in query) |
| Limit Source | — (live / locked_limits_exist — from query) |
| Expected Signal Count | — (not verified; run rule engine against chart data) |
| Expected Capability (Cpk) | — (from spc_capability_detail_mv if populated) |
| Source Objects | spc_quality_metric_subgroup_v [+ spc_locked_limits if locked] |
| Validated By | — (person who ran the query) |
| Validation Date | — (date of query run) |
| Validation Status | not verified |
```

---

## 4. Validation Checklist

Before marking a candidate as `confirmed`, the following must all be true:

- [ ] Material ID, Plant ID, MIC ID all confirmed from live query
- [ ] At least 20 sample points found in `spc_quality_metric_subgroup_v` for this combination
- [ ] Sample timestamps are within the last 180 days (data is reasonably current)
- [ ] `DESCRIBE TABLE` for `spc_quality_metric_subgroup_v` confirms expected column names match
- [ ] At least one subgroup data row fetched and inspected visually (SELECT * LIMIT 5)
- [ ] `result_value`, `subgroup_mean`, `subgroup_range`, `subgroup_sd` are non-NULL
- [ ] `unit_of_measure` is populated
- [ ] Chart type determined (from `spc_mic_chart_config` override or subgroup size)
- [ ] Locked limits: checked `spc_locked_limits` for this material/mic combination
- [ ] Capability: checked `spc_capability_detail_mv` for this material/plant/mic
- [ ] No PII or commercially sensitive data is being used for UAT
- [ ] Entry added to Section 5 (Verified UAT Candidates) with all fields completed

---

## 5. Verified UAT Candidates

Evidence captured 2026-05-21 by tim.geldard@kerry.com via Databricks CLI, warehouse `e76480b94bea6ed5` (`connected_plant_uat`).

---

### Candidate 1 — Primary (has locked limits, 271 data points)

| Field | Value |
|-------|-------|
| Material ID | 20047111 |
| Material Name | (not retrieved; query `spc_material_dim_mv` for name) |
| Plant ID | C037 |
| Plant Name | (SAP plant code; name not confirmed) |
| MIC ID | 0060 |
| MIC Name | Salt (Rapid Analyser) |
| Operation ID | 00000001 |
| Chart Type (from locked_limits) | imr |
| Date From | (not confirmed; data up to 2025-09-19) |
| Date To | 2025-09-19 (approximate last data point) |
| Expected Batch Count | 271 |
| Expected Sample Count | 271 (one measurement row per batch for this MIC) |
| Limit Source | locked_limits_exist |
| Locked Limits | cl=3.243357541899438, ucl=5.54117633384574, lcl=0.945538749953136 (imr chart) |
| lsl_spec | 0.0 (not populated for this MIC) |
| usl_spec | 0.0 (not populated for this MIC) |
| Expected Signal Count | not verified; run rule engine against chart data |
| Expected Capability (Cpk) | not available (spc_capability_detail_mv absent) |
| Source Objects | `spc_quality_metric_subgroup_mv`, `spc_locked_limits` |
| Validated By | tim.geldard@kerry.com |
| Validation Date | 2026-05-21 |
| Validation Status | partially-verified |
| Notes | Only locked limit in UAT. Spec limits absent (lsl_spec=usl_spec=0). Good for chart rendering test with locked limits. Sample values 2.01–2.68 (salt %, plausible for food product). **Data age caveat:** last data point 2025-09-19 is ~244 days before verification date (2026-05-21), exceeding the 180-day currency threshold defined in §4. Use for chart rendering and limit validation only; do not treat as current production data. |

---

### Candidate 2 — Data-rich (no locked limits, 60,673 data points)

| Field | Value |
|-------|-------|
| Material ID | 20642328 |
| Material Name | OATLY-SBUX BARISTA 12X946ML |
| Plant ID | P523 |
| Plant Name | Ste. Claire [MFG] |
| MIC ID | 0010 |
| MIC Name | pH |
| Operation ID | 00000004 |
| Chart Type | not locked; derive from subgroup size (imr if n=1) |
| Date From | not confirmed |
| Date To | not confirmed |
| Expected Batch Count | 60,673 |
| Expected Sample Count | 60,673 (approximate) |
| Limit Source | live_only (no locked limits for this material) |
| lsl_spec | 7.2 |
| usl_spec | 7.8 |
| Expected Signal Count | not verified |
| Expected Capability (Cpk) | not available (spc_capability_detail_mv absent) |
| Source Objects | `spc_quality_metric_subgroup_mv` |
| Validated By | tim.geldard@kerry.com |
| Validation Date | 2026-05-21 |
| Validation Status | partially-verified |
| Notes | Rich data volume (60,673 batch data points). Spec limits present (pH 7.2–7.8). No locked limits. Good for live-limits chart test. |

---

### Candidate 3 — Multi-MIC (no locked limits, 5 MICs with 42,094 data points each)

| Field | Value |
|-------|-------|
| Material ID | 20372893 |
| Material Name | (not confirmed; query `spc_material_dim_mv`) |
| Plant ID | P775 |
| Plant Name | (SPC-internal P-prefix code; name not confirmed) |
| MIC IDs | 0030, 0040, 0050, 0060, 0070 |
| MIC Names | (not confirmed; query `spc_characteristic_dim_mv`) |
| Operation ID | 00000001 |
| Chart Type | not locked; derive from subgroup size |
| Expected Batch Count | 42,094 per MIC |
| Limit Source | live_only (no locked limits for any MIC in this combination) |
| lsl_spec / usl_spec | not confirmed |
| Expected Capability (Cpk) | not available |
| Source Objects | `spc_quality_metric_subgroup_mv` |
| Validated By | tim.geldard@kerry.com |
| Validation Date | 2026-05-21 |
| Validation Status | partially-verified |
| Notes | Good multi-characteristic candidate with 5 MICs. No locked limits. Useful for multi-panel testing. |

---

## 6. Prerequisite Checklist Before UAT Validation

- [ ] Databricks SQL Warehouse access confirmed (warehouse ID current)
- [ ] `connected_plant_uat.gold` catalog accessible (Unity Catalog, OAuth)
- [ ] `SHOW TABLES` confirms SPC objects exist in catalog
- [ ] `DESCRIBE TABLE spc_quality_metric_subgroup_v` run and column names verified
- [ ] Discovery query (Section 2.1) run and results captured
- [ ] At least one candidate identified from discovery query
- [ ] Candidate entry created in Section 5 with all fields from query results
- [ ] V2 SPC backlog items SPC-B01 through SPC-B07 complete (navigation model, proxy routes, adapter)
