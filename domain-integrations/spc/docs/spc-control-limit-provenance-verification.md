# SPC Control Limit Provenance Verification

**Date:** 2026-05-21
**Status:** Partially verified 2026-05-21 — spc_locked_limits schema confirmed; 1 UAT row captured; see Evidence Captured section
**Catalog target:** `connected_plant_uat.gold`

> **IMPORTANT:** Column names and classifications below were derived from V1 source code analysis.
> Live Databricks evidence was captured on 2026-05-21 by tim.geldard@kerry.com.
> See "## Evidence Captured 2026-05-21" section for verified findings.

---

## 1. Purpose

This document provides a structured approach to verify the control-limit provenance in V1's
`spc_locked_limits` table before V2 uses it as the authoritative source for control chart
limit rendering.

Key questions:
1. Which columns in `spc_locked_limits` exist and are populated with data?
2. Are these production-suitable control limits, or are they UAT/test fixtures?
3. Is there a meaningful distinction between control limits (UCL/LCL) and specification
   limits (USL/LSL) in the stored data?
4. What is the approval / provenance state of the locked limits?
5. Do effective date or baseline columns exist to determine limit currency?

---

## 2. Background: V1 Control Limit Architecture

### 2.1 Dual-mode limits (from V1 source analysis)

V1 SPC uses a dual-mode control-limit system, user-selectable via `limitsMode` preference:

| Mode | Source | Mechanism |
|------|--------|-----------|
| `live` (default) | `spc_quality_metric_subgroup_v` subgroup data | Computed at runtime in React frontend using AIAG constants: UCL = X̄̄ + A₂R̄ for xbar-r chart. CL = X̄̄. LCL = X̄̄ − A₂R̄. |
| `locked` | `spc_locked_limits` table | Stored frozen limits per (material_id, mic_id, plant_id, operation_id, chart_type). |

**Implication for V2:** V2 must decide whether to expose both modes or lock to one.
The `ControlChartSeries.limitProvenance` field in V2 distinguishes between these.

### 2.2 Column discrepancy — requires DDL resolution

Two V2 documents reference different column names for `spc_locked_limits`.
This discrepancy MUST be resolved by running `DESCRIBE TABLE` against live UAT DDL.

| Field concept | `spc-v1-source-discovery.md` | `spc-v2-migration-assessment.md` | Live DDL (to verify) |
|---------------|------------------------------|----------------------------------|----------------------|
| Specification limits | `usl`, `lsl` | Not listed (may be in `spec_signature`) | — not verified — |
| Lock validity start | `effective_from` | `baseline_from` | — not verified — |
| Lock validity end | `effective_to` | `baseline_to` | — not verified — |
| Provenance note | `provenance` | `locking_note` | — not verified — |
| Spec fingerprint | Not listed | `spec_signature` | — not verified — |

The live `DESCRIBE TABLE` output resolves this. Use that output as the definitive schema.

---

## 3. Verification Queries

### 3.1 Full DDL — run first

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_locked_limits;
```

Look for: all column names, data types, nullability constraints.
This is the single most important query for resolving the column name discrepancy above.

```sql
SHOW CREATE TABLE connected_plant_uat.gold.spc_locked_limits;
```

This gives the full DDL including COMMENT strings from V1 migrations.

### 3.2 Sample rows — capture representative limit values

```sql
SELECT *
FROM connected_plant_uat.gold.spc_locked_limits
LIMIT 20;
```

### 3.3 Grain check — are there duplicate limit sets per (material, mic, chart_type)?

```sql
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
```

If rows are returned: multiple limit sets exist for the same key. V2 must filter by effective
date (or baseline date) to select the current set.

### 3.4 Limit values — are UCL/LCL/CL populated?

```sql
SELECT
  COUNT(*) AS total_rows,
  SUM(CASE WHEN cl IS NOT NULL THEN 1 ELSE 0 END) AS has_cl,
  SUM(CASE WHEN ucl IS NOT NULL THEN 1 ELSE 0 END) AS has_ucl,
  SUM(CASE WHEN lcl IS NOT NULL THEN 1 ELSE 0 END) AS has_lcl,
  SUM(CASE WHEN ucl_r IS NOT NULL THEN 1 ELSE 0 END) AS has_ucl_r,
  SUM(CASE WHEN lcl_r IS NOT NULL THEN 1 ELSE 0 END) AS has_lcl_r,
  SUM(CASE WHEN sigma_within IS NOT NULL THEN 1 ELSE 0 END) AS has_sigma_within
FROM connected_plant_uat.gold.spc_locked_limits;
```

### 3.5 Spec limits — are USL/LSL present? (column names unconfirmed)

Run ONLY after `DESCRIBE TABLE` confirms which column names are present.

```sql
-- Try both variants; use the one that succeeds:

-- Variant A (from spc-v1-source-discovery.md):
SELECT
  SUM(CASE WHEN usl IS NOT NULL THEN 1 ELSE 0 END) AS has_usl,
  SUM(CASE WHEN lsl IS NOT NULL THEN 1 ELSE 0 END) AS has_lsl
FROM connected_plant_uat.gold.spc_locked_limits;

-- Variant B (from spc-v2-migration-assessment.md):
SELECT
  SUM(CASE WHEN spec_signature IS NOT NULL THEN 1 ELSE 0 END) AS has_spec_signature
FROM connected_plant_uat.gold.spc_locked_limits;
```

### 3.6 Approval / provenance state

```sql
SELECT
  locked_by,
  COUNT(*) AS limit_count
FROM connected_plant_uat.gold.spc_locked_limits
GROUP BY locked_by
ORDER BY limit_count DESC
LIMIT 20;
```

This shows who locked limits and how many. If `locked_by` contains UAT/test user identities,
these limits may not be production-approved.

### 3.7 Effective date / baseline coverage

Run ONLY after `DESCRIBE TABLE` confirms which date columns are present.

```sql
-- Check whether baseline_from / baseline_to or effective_from / effective_to exist and are set

-- Try this (adapts to whatever name DESCRIBE TABLE reveals):
SELECT
  MIN(locked_at) AS earliest_lock,
  MAX(locked_at) AS latest_lock,
  COUNT(*) AS total_locked
FROM connected_plant_uat.gold.spc_locked_limits;
```

### 3.8 Chart type distribution

```sql
SELECT
  chart_type,
  COUNT(*) AS count
FROM connected_plant_uat.gold.spc_locked_limits
GROUP BY chart_type
ORDER BY count DESC;
```

This confirms which V1 chart types have locked limits (compare to V1 enum: `imr`, `xbar_r`,
`xbar_s`, `p_chart`, `np_chart`, `c_chart`, `u_chart`).

---

## 4. Provenance Matrix

Fill in after running the queries above. All fields start as "— not verified —".

| Limit Field | Source Column | Present? | Nullable? | Example Values | V2 Field | Confidence | Notes |
|-------------|---------------|----------|-----------|----------------|----------|------------|-------|
| Centre line (mean) | `cl` | — | — | — | `ControlChartSeries.centerLine` | pending verification | |
| Upper control limit | `ucl` | — | — | — | `ControlChartSeries.upperControlLimit` | pending verification | |
| Lower control limit | `lcl` | — | — | — | `ControlChartSeries.lowerControlLimit` | pending verification | |
| UCL for range chart | `ucl_r` | — | — | — | Range chart UCL (V2 not modelled separately yet) | pending verification | V2 gap: range chart UCL not in current ControlChartSeries schema |
| LCL for range chart | `lcl_r` | — | — | — | Range chart LCL | pending verification | V2 gap: range chart LCL not in current schema |
| Within-subgroup sigma | `sigma_within` | — | — | — | Not directly in V2 schema | pending verification | |
| Upper spec limit | `usl` or in `spec_signature` | — | — | — | `ControlChartSeries.upperSpecLimit` | pending verification | Column name unconfirmed |
| Lower spec limit | `lsl` or in `spec_signature` | — | — | — | `ControlChartSeries.lowerSpecLimit` | pending verification | Column name unconfirmed |
| Lock validity start | `effective_from` or `baseline_from` | — | — | — | `ControlChartSeries.lockedFrom` | pending verification | Column name unconfirmed |
| Lock validity end | `effective_to` or `baseline_to` | — | — | — | `ControlChartSeries.lockedTo` | pending verification | Column name unconfirmed |
| Locked by (identity) | `locked_by` | — | — | — | `ControlChartSeries.approvalState` (derived) | pending verification | approvalState = 'approved' if locked_by present |
| Locked at (timestamp) | `locked_at` | — | — | — | Not in V2 schema directly | pending verification | |
| Provenance / justification note | `provenance` or `locking_note` | — | — | — | Not in current V2 schema | pending verification | Column name unconfirmed |
| Unified MIC key | `unified_mic_key` | — | — | — | Not in V2 schema | pending verification | Added in migration 014 |
| Material ID (PK dimension) | `material_id` | — | — | — | `SPCMonitoringContext.materialId` | pending verification | Critical: must be required in V2 request |
| MIC ID (PK dimension) | `mic_id` | — | — | — | `characteristicId` | pending verification | |
| Plant ID (PK dimension) | `plant_id` | — | — | — | `plantId` | pending verification | |
| Operation ID (PK dimension) | `operation_id` | — | — | — | `operationId` / `workCentreId` | pending verification | Mapping unclear |
| Chart type (PK dimension) | `chart_type` | — | — | — | `chartType` (with rename) | pending verification | V1: `imr` etc.; V2: `individuals` etc. |

---

## 5. Limit Classification

After verifying the provenance matrix, classify each limit row:

| Classification | Meaning | V2 Treatment |
|----------------|---------|--------------|
| `production-suitable` | Locked by approved quality engineer for production use, effective dates current | Show with `approvalState: 'approved'`, `limitProvenance: 'imported-from-approved-source'` |
| `UAT-suitable with caveats` | Locked in UAT by test user; dates reasonable; values plausible | Show with `approvalState: 'pending-validation'`, sandbox warning |
| `usable only as reference` | Locked but expired, or locked by unknown identity | Show as reference only; strong UI warning |
| `insufficient without V2 enrichment` | Columns present but nullable values missing (e.g., ucl is NULL) | Mark as `limitProvenance: 'unknown'`, `approvalState: 'unavailable'` |
| `unknown` | Cannot determine without more data | Default until verification completes |

---

## 6. Control Limits vs Specification Limits

An important distinction for V2:

| Limit type | Purpose | Source in V1 |
|-----------|---------|-------------|
| **Control limits** (UCL/LCL/CL) | Determine when the process is statistically out of control. Statistical, not engineering. | Computed from subgroup statistics (AIAG constants) or stored in `spc_locked_limits.ucl/lcl/cl` |
| **Specification limits** (USL/LSL) | Engineering tolerances — the boundaries of acceptable product. Set by product specification. | `spc_quality_metric_subgroup_v.usl_spec/lsl_spec` or `spc_locked_limits.usl/lsl` (column name unconfirmed) |

**V2 must not mix these.** Exceeding specification limits is a different event from a WECO/Nelson
rule violation. `ControlChartSeries.upperSpecLimit` and `ControlChartSeries.lowerSpecLimit`
are distinct from `upperControlLimit` and `lowerControlLimit`.

The verification queries above must confirm which source column provides USL/LSL for V2 to
populate both correctly.

---

## 7. Evidence Capture Summary

Fill in after all queries are run.

| Check | Status | Finding | Date | Verified By |
|-------|--------|---------|------|-------------|
| `DESCRIBE TABLE spc_locked_limits` run | not run | — | — | — |
| Column name discrepancy resolved (usl/lsl vs spec_signature) | not run | — | — | — |
| Column name discrepancy resolved (effective_from vs baseline_from) | not run | — | — | — |
| UCL/LCL/CL populated in at least one row | not run | — | — | — |
| Spec limits (USL/LSL) source column identified | not run | — | — | — |
| Approval state derivation confirmed | not run | — | — | — |
| Chart type distribution captured | not run | — | — | — |
| Grain check run (duplicate PK check) | not run | — | — | — |
| V2 contract mapping confirmed complete | not run | — | — | — |


## Evidence Captured 2026-05-21

**Verified by:** tim.geldard@kerry.com via Databricks CLI, warehouse `e76480b94bea6ed5` (`connected_plant_uat`)
**Date:** 2026-05-21

### Confirmed Column List for `spc_locked_limits` (19 columns)

All 19 columns confirmed present via DESCRIBE TABLE. Column names match V1 migration-014 expectations exactly.

| Column | Type | Present? | Notes |
|--------|------|----------|-------|
| `material_id` | string | Yes | PK dimension |
| `mic_id` | string | Yes | PK dimension |
| `plant_id` | string | Yes | PK dimension |
| `chart_type` | string | Yes | PK dimension; observed: `imr` |
| `cl` | double | Yes | Centre line; populated |
| `ucl` | double | Yes | Upper control limit; populated |
| `lcl` | double | Yes | Lower control limit; populated |
| `ucl_r` | double | Yes | UCL for range chart; populated |
| `lcl_r` | double | Yes | LCL for range chart; 0.0 in UAT row |
| `sigma_within` | double | Yes | Within-subgroup sigma; populated |
| `baseline_from` | string | Yes | CONFIRMED (not effective_from); empty in UAT row |
| `baseline_to` | string | Yes | CONFIRMED (not effective_to); empty in UAT row |
| `locked_by` | string | Yes | Human user identity |
| `locked_at` | timestamp | Yes | Populated |
| `operation_id` | string | Yes | Empty in UAT row |
| `unified_mic_key` | string | Yes | Present (migration 014 applied); empty in UAT row |
| `mic_origin` | string | Yes | Empty in UAT row |
| `spec_signature` | string | Yes | Empty in UAT row |
| `locking_note` | string | Yes | Empty in UAT row |

**Absent columns (V1 early-source expectations not confirmed):**
- `usl` — NOT PRESENT. Spec limits are stored in `spc_quality_metric_subgroup_v.usl_spec`, not in `spc_locked_limits`.
- `lsl` — NOT PRESENT. Same as above.

### The Single Locked Limit Row (UAT Test Fixture)

```
material_id    = 20047111
mic_id         = 0060
plant_id       = C037
chart_type     = imr
cl             = 3.243357541899438
ucl            = 5.54117633384574
lcl            = 0.945538749953136
ucl_r          = 2.822622221476501
lcl_r          = 0.0
sigma_within   = 0.7659395973154339
baseline_from  = (empty)
baseline_to    = (empty)
locked_by      = domhnall.odonovan@kerry.ie
locked_at      = 2026-04-06T19:06:02.716Z
operation_id   = (empty)
unified_mic_key = (empty)
mic_origin     = (empty)
spec_signature = (empty)
locking_note   = (empty)
```

### Assessment

**Classification: UAT-suitable with caveats**

- 1 row is a UAT test fixture; not production-representative data
- No `baseline_from`/`baseline_to` populated — effective date filtering not relevant for this row
- No `spec_signature` populated
- Limit approval fields (`locking_note`, `mic_origin`) empty
- `locked_by` = human user (domhnall.odonovan@kerry.ie) — not a service account; suggests this was manually entered in UAT
- UCL/LCL/CL values are plausible and populated — suitable for chart rendering test

### Key Finding: Spec Limits Not in `spc_locked_limits`

**Specification limits (`lsl_spec`, `usl_spec`) are stored in `spc_quality_metric_subgroup_v`, NOT in `spc_locked_limits`.**

- `spc_locked_limits` contains ONLY control limits (UCL, LCL, CL, UCL_R, LCL_R, sigma_within) and provenance metadata
- The UAT locked row has `lsl_spec = 0.0` and `usl_spec = 0.0` in the subgroup view (spec limits not populated for this MIC)
- V2 must query `spc_quality_metric_subgroup_v.lsl_spec` and `usl_spec` for specification limits
- V2 must NOT look for `usl`/`lsl` columns in `spc_locked_limits`

### Column Name Discrepancy — Resolved

| Field concept | V1 early-source | V1 migration-014 | Live DDL confirmed |
|---------------|----------------|------------------|--------------------|
| Lock validity start | `effective_from` | `baseline_from` | `baseline_from` |
| Lock validity end | `effective_to` | `baseline_to` | `baseline_to` |
| Provenance note | `provenance` | `locking_note` | `locking_note` |
| Spec fingerprint | (absent) | `spec_signature` | `spec_signature` |
| Spec limits | `usl`, `lsl` | (in subgroup view) | NOT in locked_limits |

### Evidence Capture Summary

| Check | Status | Finding | Date | Verified By |
|-------|--------|---------|------|-------------|
| `DESCRIBE TABLE spc_locked_limits` run | verified | 19 columns confirmed | 2026-05-21 | tim.geldard@kerry.com |
| Column name discrepancy resolved (usl/lsl vs spec_signature) | verified | No usl/lsl in locked_limits; spec limits in subgroup view | 2026-05-21 | tim.geldard@kerry.com |
| Column name discrepancy resolved (effective_from vs baseline_from) | verified | `baseline_from`/`baseline_to` confirmed | 2026-05-21 | tim.geldard@kerry.com |
| UCL/LCL/CL populated in at least one row | verified | All 5 limit values populated in UAT row | 2026-05-21 | tim.geldard@kerry.com |
| Spec limits (USL/LSL) source column identified | verified | `usl_spec`/`lsl_spec` in subgroup view only | 2026-05-21 | tim.geldard@kerry.com |
| Approval state derivation confirmed | verified | `locked_by` = domhnall.odonovan@kerry.ie (human user) | 2026-05-21 | tim.geldard@kerry.com |
| Chart type distribution captured | verified | 1 row with chart_type = imr | 2026-05-21 | tim.geldard@kerry.com |
| Grain check run (duplicate PK check) | verified | 1 row total; PK unique | 2026-05-21 | tim.geldard@kerry.com |
| V2 contract mapping confirmed complete | partially verified | Column mapping complete; V2 schema may need range chart UCL/LCL fields | 2026-05-21 | tim.geldard@kerry.com |
