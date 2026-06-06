# SPC Databricks Source Verification Pack

**Date:** 2026-05-21
**Status:** Verified 2026-05-21 — tim.geldard@kerry.com via Databricks CLI, warehouse `e76480b94bea6ed5` (`connected_plant_uat`)
**Target Catalog:** `connected_plant_uat.gold`
**Branch:** `claude/prepare-verification-pack-BTs9F`

> **IMPORTANT:** This document contains SQL verification queries AND live evidence captured on
> 2026-05-21 by tim.geldard@kerry.com using the Databricks CLI against warehouse
> `e76480b94bea6ed5` (`connected_plant_uat`). Section 9 contains the verified results.
> Section 3 has been updated to reflect what remains unverified after this evidence session.

---

## 1. Purpose

This pack provides a structured set of SQL verification queries and an evidence-capture framework
for a person with live access to the `connected_plant_uat` Databricks workspace to validate the
SPC data model before V2 native SPC routes are implemented.

The pack covers:
- Object inventory discovery
- Object type classification (table vs view vs materialized view vs metric view)
- Column/schema verification
- Sample-row capture
- Data grain assessment
- Navigation model verification
- Control-limit provenance verification
- Rule/signal source classification
- Capability metric source classification
- Golden candidate discovery

**This document does NOT claim any of these objects exist, have specific columns, or contain data.
All of that must be confirmed by running the queries against a live warehouse.**

---

## 2. What Is Known from V1 Discovery

The following has been established from reading V1 source code in `timgeldard/ConnectIO-RAD`
(static code analysis only — no live Databricks execution):

### 2.1 Deployment Configuration (from V1 source)

From `apps/spc/Makefile` and `apps/spc/backend/tests/test_db.py`:

```
Catalog:         connected_plant_uat
Schema:          gold
Warehouse ID:    e76480b94bea6ed5 (as of V1 Makefile — may have changed)
```

All SPC objects are expected to live in `connected_plant_uat.gold` based on V1 migration scripts.

### 2.2 Objects Referenced in V1 Source Code

The following objects are referenced in V1 SQL queries and migration scripts. Their existence in
UAT has NOT been confirmed by live Databricks execution.

| Object | Type (per V1 source) | Referenced in |
|--------|----------------------|---------------|
| `spc_quality_metric_subgroup_v` | Regular view | `charts.py` DAL, migration 005 |
| `spc_locked_limits` | Delta table (user-managed) | `locked_limits.py` DAL, migration 000 |
| `spc_exclusions` | Delta table (user-managed) | `exclusions.py` DAL, migration 001 |
| `spc_quality_metrics` | AI/BI Metric View (WITH METRICS LANGUAGE YAML) | migration 006 |
| `spc_material_dim_mv` | Materialized view (4h refresh) | `metadata.py` DAL, migration 007 |
| `spc_plant_material_dim_mv` | Materialized view (4h refresh) | `metadata.py` DAL, migration 007 |
| `spc_characteristic_dim_mv` | Materialized view (4h refresh) | `metadata.py` DAL, migration 009 |
| `spc_batch_dim_mv` | Materialized view (4h refresh) | migration 009 |
| `spc_nelson_rule_flags_mv` | Materialized view (4h refresh) | migration 012 |
| `spc_capability_detail_mv` | Materialized view (4h refresh) | `analysis.py` DAL, migration 013 |
| `spc_attribute_quality_metrics` | AI/BI Metric View | migration 008 |
| `spc_attribute_metric_source_v` | Regular view | migration 008 |
| `spc_process_flow_metrics` | AI/BI Metric View | migration 010 |
| `spc_correlation_source_mv` | Materialized view | migration 011 |
| `spc_mic_chart_config` | Delta table | migration 019 |
| `spc_query_audit` | Delta table | migration — |
| `gold_batch_quality_result_v` | Platform view (not SPC-owned) | all DAL files |
| `gold_inspection_lot` | Platform table (not SPC-owned) | `charts.py` |
| `gold_plant` | Platform view (not SPC-owned) | `authorized_scope.py` |

### 2.3 Column Schemas Known from V1 Source

Column names are taken from V1 Python DAL files and SQL migration scripts. They have NOT been
confirmed against live DDL.

**`spc_locked_limits` columns (from `locked_limits.py` and `000_setup_locked_limits.sql`):**
`material_id`, `mic_id`, `plant_id`, `operation_id`, `chart_type`, `cl`, `ucl`, `lcl`, `ucl_r`,
`lcl_r`, `sigma_within`, `baseline_from`, `baseline_to`, `unified_mic_key`, `mic_origin`,
`spec_signature`, `locking_note`, `locked_by`, `locked_at`

> Note: A later V1 migration (014) added `unified_mic_key`. Column presence depends on whether
> all migrations were applied in UAT. This must be verified.

**`spc_quality_metric_subgroup_v` columns (from migration 005 and `charts.py`):**
`material_id`, `plant_id`, `mic_id`, `operation_id`, `batch_id`, `sample_id`,
`inspection_lot_id`, `result_value`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`,
`subgroup_sd`, `unit_of_measure`, `usl_spec`, `lsl_spec`

### 2.4 Key Findings from V1 Source Analysis

1. `spc_quality_metrics` is a **Databricks AI/BI Metric View** — NOT a signal or alarm storage table.
2. Rule violations (WECO, Nelson) are computed **client-side** in the V1 React frontend at render time.
3. `spc_locked_limits` primary key is `(material_id, mic_id, plant_id, operation_id, chart_type)`.
   `material_id` is a required PK dimension (previously missing from V2 schema assumptions).
4. V1 navigation is material-centric: `material_id → plant_id → mic_id → operation_id`.
5. Capability metrics (Cp/Cpk/Pp/Ppk) are stored in `spc_capability_detail_mv`.

---

## 3. What Is Not Yet Verified

The following items required live Databricks access to confirm. Items that have been resolved
by the 2026-05-21 verification session are marked **resolved**. Items still pending are retained.

| Item | Why Unverified | Blocking? | Status |
|------|---------------|-----------|--------|
| Object inventory — which objects actually exist in UAT | Code analysis only; migrations may not all be applied | Yes | **Resolved 2026-05-21** — 22 objects found; see Section 9.1 |
| Object types — table vs view vs MV vs metric view | Cannot be confirmed without DESCRIBE EXTENDED | Yes | **Resolved 2026-05-21** — see Section 9.2 |
| Column names and data types for `spc_quality_metric_subgroup_v` | DDL from migration scripts may differ from deployed DDL | Yes | **Resolved 2026-05-21** — 34 columns confirmed; significant V1 differences; see Section 9.3 |
| Column names and data types for `spc_locked_limits` | DDL from migration scripts may differ from deployed DDL | Yes | **Resolved 2026-05-21** — 19 columns confirmed; `baseline_from`/`baseline_to` confirmed; no `usl`/`lsl` |
| Column names for `spc_capability_detail_mv` | Object may not exist | Yes | **Resolved 2026-05-21** — object NOT FOUND; migration not applied |
| Column names for `spc_nelson_rule_flags_mv` | Object may not exist | Yes | **Resolved 2026-05-21** — object NOT FOUND; migration not applied |
| Whether any rows exist | No live query run | Yes | **Resolved 2026-05-21** — 73.4M rows in subgroup MV; 1 row in locked_limits; see row counts |
| Whether all 20 migrations have been applied | Deployment state unknown | Yes | **Partially resolved** — migrations 012 and 013 confirmed NOT applied |
| `spc_quality_metric_subgroup_v` is a view or MV | Type not confirmed live | Yes | **Resolved 2026-05-21** — VIEW confirmed |
| `gold_batch_quality_result_v` column names (SPC-relevant) | Not verified from SPC perspective | No | Still pending |
| Whether UAT has actual SPC measurement data | Cannot confirm without COUNT query | Yes | **Resolved 2026-05-21** — 73,452,925 rows in subgroup MV |
| Whether `spc_capability_detail_mv` contains computed Cpk values | MV may be empty or unrefreshed | Yes | **Resolved 2026-05-21** — object NOT FOUND; capability unavailable from Databricks |
| Whether warehouse `e76480b94bea6ed5` is still the correct one | May have changed | Yes | **Resolved 2026-05-21** — confirmed still valid |
| UC/Unity Catalog path `connected_plant_uat.gold` is accessible | Auth/permissions not confirmed | Yes | **Resolved 2026-05-21** — accessible |
| `spc_quality_metric_subgroup_v` V1 column names differ from live DDL | V1 expected `result_value`, `sample_id`, `subgroup_mean`, etc. | Yes | **Resolved 2026-05-21** — columns differ significantly; V1 names absent; see Section 9.3 |
| Grain analysis — exact grain of subgroup MV | Cannot confirm without COUNT query | Yes | **Partially resolved 2026-05-21** — measurement-level grain confirmed; discriminating column unclear; see grain doc |

---

## 4. Required Databricks Access Assumptions

The person running these verification queries requires:

1. **Read access** to `connected_plant_uat.gold` catalog/schema via Unity Catalog.
2. Access to **`SHOW TABLES`**, **`DESCRIBE TABLE`**, **`DESCRIBE EXTENDED`**, and **`SHOW CREATE TABLE`** commands.
3. Access to a running **SQL Warehouse** (the V1 warehouse `e76480b94bea6ed5` may still be valid).
4. **OAuth identity** — production Databricks reads must use end-user OAuth, not service principal.
5. Optionally: access to **Databricks Catalog Explorer** UI to verify object types visually.

If UAT access is not yet available, all evidence fields below should be marked `blocked`.

---

## 5. Object Inventory Queries

Run these first to establish which SPC objects exist in the catalog.

### 5.1 Primary SPC objects

```sql
-- Run in: connected_plant_uat.gold context, or prefix with catalog.schema

SHOW TABLES IN connected_plant_uat.gold LIKE '*spc*';
```

Expected: Should list objects matching the V1 inventory above.
If no results: Schema may not exist, catalog path may differ, or migrations were not applied.

### 5.2 Related non-SPC objects (shared platform objects SPC depends on)

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*quality*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*inspection*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*batch*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*mic*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*plant*';
```

### 5.3 Potential signal/alarm/rule tables (verify if any exist)

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*signal*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*alarm*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*rule*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*violation*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*limit*';
```

### 5.4 Capability-related objects

```sql
SHOW TABLES IN connected_plant_uat.gold LIKE '*capability*';
SHOW TABLES IN connected_plant_uat.gold LIKE '*metric*';
```

---

## 6. Object Type Queries

After confirming which objects exist, determine their types.

### 6.1 DESCRIBE EXTENDED — primary objects

```sql
DESCRIBE EXTENDED connected_plant_uat.gold.spc_quality_metrics;
-- Look for: "Type" field — should show "METRIC_VIEW" or "VIEW" or "TABLE"

DESCRIBE EXTENDED connected_plant_uat.gold.spc_quality_metric_subgroup_v;
-- Look for: "Type" field — should show "VIEW" per V1 source

DESCRIBE EXTENDED connected_plant_uat.gold.spc_locked_limits;
-- Look for: "Type" = "MANAGED" or "EXTERNAL" (Delta table)

DESCRIBE EXTENDED connected_plant_uat.gold.spc_material_dim_mv;
-- Look for: "Type" = "MATERIALIZED_VIEW"

DESCRIBE EXTENDED connected_plant_uat.gold.spc_capability_detail_mv;
-- Look for: "Type" = "MATERIALIZED_VIEW"

DESCRIBE EXTENDED connected_plant_uat.gold.spc_nelson_rule_flags_mv;
-- Look for: "Type" = "MATERIALIZED_VIEW"
```

### 6.2 SHOW CREATE TABLE — to see full DDL

```sql
SHOW CREATE TABLE connected_plant_uat.gold.spc_quality_metric_subgroup_v;
SHOW CREATE TABLE connected_plant_uat.gold.spc_locked_limits;
SHOW CREATE TABLE connected_plant_uat.gold.spc_capability_detail_mv;
```

---

## 7. Column / Schema Queries

### 7.1 Primary chart data view

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_quality_metric_subgroup_v;
```

Verify these columns exist (based on V1 migration source — must confirm):
`material_id`, `plant_id`, `mic_id`, `operation_id`, `batch_id`, `sample_id`,
`inspection_lot_id`, `result_value`, `sample_timestamp`, `subgroup_mean`,
`subgroup_range`, `subgroup_sd`, `unit_of_measure`, `usl_spec`, `lsl_spec`

### 7.2 Control limits table

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_locked_limits;
```

Verify these columns exist (based on V1 source):
`material_id`, `mic_id`, `plant_id`, `operation_id`, `chart_type`,
`cl`, `ucl`, `lcl`, `ucl_r`, `lcl_r`, `sigma_within`,
`baseline_from`, `baseline_to`, `unified_mic_key`, `mic_origin`,
`spec_signature`, `locking_note`, `locked_by`, `locked_at`

> Note: Earlier V1 source code references `usl`, `lsl`, `effective_from`, `effective_to`,
> `provenance` as column names. The migration assessment doc shows different names
> (`baseline_from`, `baseline_to`, `spec_signature`, `locking_note`). This must be reconciled
> against live DDL.

### 7.3 Material/plant dimension MVs

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_material_dim_mv;
DESCRIBE TABLE connected_plant_uat.gold.spc_plant_material_dim_mv;
DESCRIBE TABLE connected_plant_uat.gold.spc_characteristic_dim_mv;
```

### 7.4 Capability MV

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_capability_detail_mv;
```

Expected columns (from V1 `analysis.py`):
`material_id`, `plant_id`, `mic_id`, `mic_name`, `cp`, `cpk`, `pp`, `ppk`,
`sample_count`, `mean`, `sigma_within`

### 7.5 Nelson rule flags MV

```sql
DESCRIBE TABLE connected_plant_uat.gold.spc_nelson_rule_flags_mv;
```

### 7.6 Shared platform views (SPC dependencies)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;
DESCRIBE TABLE connected_plant_uat.gold.gold_plant;
```

---

## 8. Sample-Row Capture Queries

Run these only after confirming objects exist. Capture representative rows for evidence.

### 8.1 Sample subgroup data

```sql
SELECT *
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v
LIMIT 20;
```

### 8.2 Sample locked limits

```sql
SELECT *
FROM connected_plant_uat.gold.spc_locked_limits
LIMIT 20;
```

### 8.3 Sample characteristic dimension

```sql
SELECT *
FROM connected_plant_uat.gold.spc_characteristic_dim_mv
LIMIT 20;
```

### 8.4 Sample capability data

```sql
SELECT *
FROM connected_plant_uat.gold.spc_capability_detail_mv
LIMIT 20;
```

### 8.5 Sample material dimension

```sql
SELECT *
FROM connected_plant_uat.gold.spc_material_dim_mv
LIMIT 20;
```

### 8.6 Row counts

```sql
SELECT COUNT(*) AS row_count FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v;
SELECT COUNT(*) AS row_count FROM connected_plant_uat.gold.spc_locked_limits;
SELECT COUNT(*) AS row_count FROM connected_plant_uat.gold.spc_material_dim_mv;
SELECT COUNT(*) AS row_count FROM connected_plant_uat.gold.spc_characteristic_dim_mv;
SELECT COUNT(*) AS row_count FROM connected_plant_uat.gold.spc_capability_detail_mv;
```

---

## 9. Evidence Capture Table

Evidence captured 2026-05-21 by tim.geldard@kerry.com via Databricks CLI, warehouse
`e76480b94bea6ed5` (`connected_plant_uat`).

Status options: `verified` | `not found` | `partially verified` | `blocked` | `unexpected` | `not run`

### 9.1 Object Inventory Evidence

22 objects found matching `*spc*` in `connected_plant_uat.gold`.

| Check | SQL Run | Expected Evidence | Actual Result | Verified By | Date | Status | Notes |
|-------|---------|-------------------|---------------|-------------|------|--------|-------|
| `spc_attribute_metric_source_v` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_attribute_quality_metrics` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | AI/BI Metric View |
| `spc_attribute_subgroup_mv` exists | SHOW TABLES LIKE '*spc*' | Not expected | Present | tim.geldard@kerry.com | 2026-05-21 | unexpected | Not in V1 source inventory |
| `spc_batch_dim_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_characteristic_dim_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_correlation_source_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_correlation_source_v` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_exclusions` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | 6 rows |
| `spc_lineage_graph_mv` exists | SHOW TABLES LIKE '*spc*' | Not expected | Present | tim.geldard@kerry.com | 2026-05-21 | unexpected | Not in V1 source inventory |
| `spc_locked_limits` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | 1 row |
| `spc_material_dim_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | 138,051 rows |
| `spc_mic_chart_config` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | 0 rows |
| `spc_mic_routing_v` exists | SHOW TABLES LIKE '*spc*' | Not expected | Present | tim.geldard@kerry.com | 2026-05-21 | unexpected | Not in V1 source inventory; likely from migration-014 unified_mic_key work |
| `spc_plant_material_dim_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | 87,336 rows |
| `spc_process_flow_metrics` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | AI/BI Metric View |
| `spc_process_flow_source_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_process_flow_source_v` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_quality_metric_subgroup_mv` exists | SHOW TABLES LIKE '*spc*' | Not expected | Present | tim.geldard@kerry.com | 2026-05-21 | unexpected | Not in V1 source inventory; 73,452,925 rows; use instead of view for large queries |
| `spc_quality_metric_subgroup_v` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_quality_metrics` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | METRIC_VIEW — not row-queryable via SQL warehouse |
| `spc_query_audit` exists | SHOW TABLES LIKE '*spc*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified |  |
| `spc_unified_mic_key_v` exists | SHOW TABLES LIKE '*spc*' | Not expected | Present | tim.geldard@kerry.com | 2026-05-21 | unexpected | Not in V1 source inventory; likely from migration-014 unified_mic_key work |
| `spc_capability_detail_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | NOT FOUND | tim.geldard@kerry.com | 2026-05-21 | not found | Migration 013 not applied in UAT |
| `spc_nelson_rule_flags_mv` exists | SHOW TABLES LIKE '*spc*' | Listed in output | NOT FOUND | tim.geldard@kerry.com | 2026-05-21 | not found | Migration 012 not applied in UAT |
| No signal table exists | SHOW TABLES LIKE '*signal*' | Empty / confirmed absent | 0 results | tim.geldard@kerry.com | 2026-05-21 | verified | Confirmed absent |
| No alarm table exists | SHOW TABLES LIKE '*alarm*' | Empty / confirmed absent | 0 results | tim.geldard@kerry.com | 2026-05-21 | verified | Confirmed absent |
| No rule table exists | SHOW TABLES LIKE '*rule*' | Empty / confirmed absent | 0 results | tim.geldard@kerry.com | 2026-05-21 | verified | Confirmed absent |
| No violation table exists | SHOW TABLES LIKE '*violation*' | Empty / confirmed absent | 0 results | tim.geldard@kerry.com | 2026-05-21 | verified | Confirmed absent |
| No capability table exists | SHOW TABLES LIKE '*capability*' | 0 results | 0 results | tim.geldard@kerry.com | 2026-05-21 | verified | Confirmed absent |
| `gold_batch_quality_result_v` exists | SHOW TABLES LIKE '*quality*' | Listed in output | Present | tim.geldard@kerry.com | 2026-05-21 | verified | Platform object |
| `gold_plant` exists | SHOW TABLES LIKE '*plant*' | Listed in output | Not queried | — | — | not run |  |

### 9.2 Object Type Evidence

| Check | SQL Run | Expected Type | Actual Type | Verified By | Date | Status | Notes |
|-------|---------|---------------|-------------|-------------|------|--------|-------|
| `spc_quality_metrics` is AI/BI Metric View | DESCRIBE EXTENDED | METRIC_VIEW or similar | METRIC_VIEW | tim.geldard@kerry.com | 2026-05-21 | verified | SELECT * returns empty; not row-queryable via SQL warehouse |
| `spc_quality_metric_subgroup_v` is VIEW | DESCRIBE EXTENDED | VIEW | VIEW | tim.geldard@kerry.com | 2026-05-21 | verified | |
| `spc_quality_metric_subgroup_mv` type | DESCRIBE EXTENDED | Not expected | MANAGED (Delta; materialized view by convention) | tim.geldard@kerry.com | 2026-05-21 | unexpected | Clustering on material_id, mic_id; 73,452,925 rows; prefer for large queries |
| `spc_locked_limits` is Delta table | DESCRIBE EXTENDED | MANAGED / TABLE | MANAGED (Delta) | tim.geldard@kerry.com | 2026-05-21 | verified | |
| `spc_material_dim_mv` is MATERIALIZED_VIEW | DESCRIBE EXTENDED | MATERIALIZED_VIEW | MATERIALIZED_VIEW | tim.geldard@kerry.com | 2026-05-21 | verified | Last Refresh Type: RECOMPUTED |
| `spc_characteristic_dim_mv` type | DESCRIBE EXTENDED | MATERIALIZED_VIEW | MANAGED (Delta) | tim.geldard@kerry.com | 2026-05-21 | partially verified | Type MANAGED not MATERIALIZED_VIEW; contains expected schema |
| `spc_capability_detail_mv` is MATERIALIZED_VIEW | DESCRIBE EXTENDED | MATERIALIZED_VIEW | NOT FOUND | tim.geldard@kerry.com | 2026-05-21 | not found | Object does not exist in UAT |

### 9.3 Column Verification Evidence

Columns verified via DESCRIBE TABLE / DESCRIBE EXTENDED on 2026-05-21.

#### `spc_quality_metric_subgroup_v` / `spc_quality_metric_subgroup_mv` (identical schema, 34 columns)

> IMPORTANT: Significant differences from V1 column expectations. V1-expected columns
> `sample_id`, `result_value`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`,
> `subgroup_sd`, `inspection_lot_id`, `unit_of_measure` are ALL ABSENT from live DDL.
> The actual schema uses different naming and calculation conventions — see V2 impact column.

| Object | Column | Actual Type | Present? | V2 Impact / Notes | Verified By | Date | Status |
|--------|--------|-------------|----------|--------------------|-------------|------|--------|
| `spc_quality_metric_subgroup_v` | `material_id` | string | Yes | Primary navigation key | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `material_name` | string | Yes | New — not in V1 expectations | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `batch_id` | string | Yes | Present as expected | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `first_posting_date` | date | Yes | New — replaces sample_timestamp (start) | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `last_posting_date` | date | Yes | New — replaces sample_timestamp (end) | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `batch_date` | date | Yes | New — primary date for plotting | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `batch_week` | timestamp | Yes | Time aggregation bucket | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `batch_month` | timestamp | Yes | Time aggregation bucket | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `plant_id` | string | Yes | Present as expected | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `plant_name` | string | Yes | New — not in V1 expectations | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `mic_id` | string | Yes | Present as expected | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `operation_id` | string | Yes | Present; values are sequential numbers (00000001 etc.), NOT SAP work centres | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `mic_name` | string | Yes | Present as expected | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `inspection_method` | string | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `value` | double | Yes | V2 MUST use this — replaces absent `result_value` | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `batch_n` | bigint | Yes | Sample count per batch; replaces absent subgroup_mean denominator | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `sum_value` | double | Yes | Sum of values in batch; mean = sum_value / batch_n | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `sum_squares` | double | Yes | Enables SD calculation | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `min_value` | double | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `max_value` | double | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `batch_range` | double | Yes | Replaces absent `subgroup_range` (= max_value - min_value) | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `nominal_target` | double | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `lsl_spec` | double | Yes | Present; spec limit (lower); NOT in spc_locked_limits | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `usl_spec` | double | Yes | Present; spec limit (upper); NOT in spc_locked_limits | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `tolerance_half_width` | double | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `raw_tolerance` | string | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `spec_signature` | string | Yes | New — fingerprint of spec limits | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `any_rejection` | int | Yes | New — 0/1 flag; batch had a rejection result | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `any_acceptance` | int | Yes | New — 0/1 flag; batch had an acceptance result | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `unified_mic_key` | string | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `subgroup_rep` | int | Yes | Row index within batch (0-based); NOT a reliable unique discriminator | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `normality_type` | string | Yes | New — normality assessment type | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `normality_method` | string | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `normality_signature` | string | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `spec_type` | string | Yes | New | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_quality_metric_subgroup_v` | `sample_id` | string | No | V1-expected ABSENT — no direct sample_id in this schema | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `result_value` | double | No | V1-expected ABSENT — replaced by `value` | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `sample_timestamp` | timestamp | No | V1-expected ABSENT — replaced by `batch_date`, `first_posting_date`, `last_posting_date` | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `subgroup_mean` | double | No | V1-expected ABSENT — derive as `sum_value / batch_n` | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `subgroup_range` | double | No | V1-expected ABSENT — replaced by `batch_range` | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `subgroup_sd` | double | No | V1-expected ABSENT — derive from `sum_squares`, `sum_value`, `batch_n` | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `inspection_lot_id` | string | No | V1-expected ABSENT | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_quality_metric_subgroup_v` | `unit_of_measure` | string | No | V1-expected ABSENT — no UoM column in schema | tim.geldard@kerry.com | 2026-05-21 | not found |

#### `spc_locked_limits` (19 columns — matches V1 migration-014 expectations)

| Object | Column | Actual Type | Present? | V2 Impact / Notes | Verified By | Date | Status |
|--------|--------|-------------|----------|--------------------|-------------|------|--------|
| `spc_locked_limits` | `material_id` | string | Yes | PK dimension — required in V2 request | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `mic_id` | string | Yes | PK dimension | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `plant_id` | string | Yes | PK dimension | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `chart_type` | string | Yes | PK dimension; observed value: `imr` | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `cl` | double | Yes | Centre line; populated in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `ucl` | double | Yes | Upper control limit; populated | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `lcl` | double | Yes | Lower control limit; populated | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `ucl_r` | double | Yes | UCL for range chart; populated | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `lcl_r` | double | Yes | LCL for range chart; value = 0.0 in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `sigma_within` | double | Yes | Within-subgroup sigma; populated | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `baseline_from` | string | Yes | CONFIRMED name (not effective_from); empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `baseline_to` | string | Yes | CONFIRMED name (not effective_to); empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `locked_by` | string | Yes | Human user identity in UAT: domhnall.odonovan@kerry.ie | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `locked_at` | timestamp | Yes | Populated: 2026-04-06T19:06:02.716Z | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `operation_id` | string | Yes | Present; empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `unified_mic_key` | string | Yes | Present (migration 014 applied); empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `mic_origin` | string | Yes | Present; empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `spec_signature` | string | Yes | Present; empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `locking_note` | string | Yes | Present; empty in UAT row | tim.geldard@kerry.com | 2026-05-21 | verified |
| `spc_locked_limits` | `usl` | — | No | V1-early-source ABSENT — spec limits are in subgroup view, NOT here | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_locked_limits` | `lsl` | — | No | V1-early-source ABSENT — spec limits are in subgroup view, NOT here | tim.geldard@kerry.com | 2026-05-21 | not found |

#### `spc_capability_detail_mv` (NOT FOUND — migration 013 not applied in UAT)

| Object | Column | Actual Type | Present? | Notes | Verified By | Date | Status |
|--------|--------|-------------|----------|-------|-------------|------|--------|
| `spc_capability_detail_mv` | `cp` | — | No | Object NOT FOUND — migration 013 not applied | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_capability_detail_mv` | `cpk` | — | No | Object NOT FOUND | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_capability_detail_mv` | `pp` | — | No | Object NOT FOUND | tim.geldard@kerry.com | 2026-05-21 | not found |
| `spc_capability_detail_mv` | `ppk` | — | No | Object NOT FOUND | tim.geldard@kerry.com | 2026-05-21 | not found |

---

## 10. Decision Criteria

### 10.1 Proceed with Option 1 (Proxy to V1 SPC backend) if:

- `spc_quality_metric_subgroup_v` exists and `sample_id`, `result_value`, `sample_timestamp`, `material_id` are confirmed
- `spc_locked_limits` exists with `material_id` as a key dimension
- The V1 SPC FastAPI app is reachable from the V2 Databricks Apps environment
- At least one golden candidate exists (see golden-spc-candidates.md)

### 10.2 Proceed with Option 2 (Direct Databricks API) if:

- All primary objects are confirmed as existing and queryable
- Column names match V1 source documentation
- Grain assessment confirms the expected navigation model
- Capability MV contains computed values (not empty)
- Rule/signal classification is confirmed (frontend-computed; no stored signal table needed)
- At least one golden candidate exists and is validated

### 10.3 Do NOT proceed with either option if:

- `spc_quality_metric_subgroup_v` does not exist or has no rows
- `material_id` is absent from `spc_locked_limits`
- Unity Catalog / OAuth access is blocked
- No golden candidate can be identified from the data
- Object types differ materially from V1 source code description

---

## 11. Follow-up Actions

After running all queries, the following must be actioned regardless of results:

1. **Record all evidence** in the tables above with verifier name and date.
2. **Resolve column name discrepancy** between `spc-v1-source-discovery.md` (references `usl`, `lsl`,
   `effective_from`, `effective_to`, `provenance`) and `spc-v2-migration-assessment.md` (references
   `baseline_from`, `baseline_to`, `spec_signature`, `locking_note`). The live DDL from
   `DESCRIBE TABLE spc_locked_limits` is the definitive source.
3. **Update `spc-control-limit-provenance-verification.md`** with verified column names.
4. **Update `golden-spc-candidates.md`** if candidates are found.
5. **Confirm migration count**: verify whether all 20 V1 SQL migrations have been applied in UAT.
6. **Check `spc_quality_metrics` queryability**: AI/BI Metric Views may require a different execution
   path than regular SQL warehouse queries.

---

## 12. Handoff Checklist for Person with Databricks Access (Scope K)

This is the complete handoff for a developer or QA analyst who has access to the UAT Databricks
SQL Warehouse to run the verification queries above.

### Pre-flight

- [ ] Confirm Databricks workspace URL for `connected_plant_uat`
- [ ] Confirm SQL Warehouse is running (check warehouse `e76480b94bea6ed5` or current equivalent)
- [ ] Confirm Unity Catalog is enabled for `connected_plant_uat`
- [ ] Confirm your user identity has READ grants on `connected_plant_uat.gold`
- [ ] Open a new Databricks SQL Editor session

### Step 1: Object inventory

- [ ] Run `SHOW TABLES IN connected_plant_uat.gold LIKE '*spc*'`
- [ ] Record the full list in Section 9.1 above
- [ ] Run `SHOW TABLES IN connected_plant_uat.gold LIKE '*signal*'`
- [ ] Run `SHOW TABLES IN connected_plant_uat.gold LIKE '*alarm*'`
- [ ] Note: absence of signal/alarm tables is EXPECTED per V1 source analysis

### Step 2: Object types

- [ ] Run `DESCRIBE EXTENDED` for each object found in Step 1
- [ ] Record Type field values in Section 9.2 above
- [ ] Confirm `spc_quality_metrics` type (expected: Metric View / AI/BI view — NOT a table)

### Step 3: Column verification

- [ ] Run `DESCRIBE TABLE connected_plant_uat.gold.spc_quality_metric_subgroup_v`
- [ ] Run `DESCRIBE TABLE connected_plant_uat.gold.spc_locked_limits`
- [ ] Run `DESCRIBE TABLE connected_plant_uat.gold.spc_capability_detail_mv`
- [ ] Fill in Section 9.3 with actual column names, types, and nullability
- [ ] **Important**: note any columns that differ from Section 7 expectations

### Step 4: Sample rows

- [ ] Run `SELECT * FROM connected_plant_uat.gold.spc_quality_metric_subgroup_v LIMIT 20`
- [ ] Run `SELECT * FROM connected_plant_uat.gold.spc_locked_limits LIMIT 20`
- [ ] Save the output to a JSON or CSV file for the V2 team
- [ ] Note any unexpected columns or value formats

### Step 5: Row counts

- [ ] Run COUNT(*) for each primary object (Section 8.6)
- [ ] Note: if row count is 0, the MV may not have been refreshed (run `REFRESH MATERIALIZED VIEW` if permitted)

### Step 6: Grain assessment

- [ ] Run the grain check queries from `spc-data-model-grain-assessment.md`
- [ ] Fill in the Grain Conclusion table in that document

### Step 7: Navigation model

- [ ] Run the DISTINCT material/plant queries from `spc-navigation-model-verification.md`
- [ ] Identify at least one candidate material/plant/MIC combination with >= 20 sample points
- [ ] Record in `golden-spc-candidates.md`

### Step 8: Locked limits check

- [ ] Confirm at least one row in `spc_locked_limits` (or note that it is empty)
- [ ] Record the effective column names (resolves the `usl`/`lsl` vs `spec_signature` discrepancy)
- [ ] Note whether `effective_from`/`effective_to` or `baseline_from`/`baseline_to` are present

### Step 9: Capability check

- [ ] Confirm `spc_capability_detail_mv` has rows and `cpk` is populated
- [ ] Note: if empty, the MV may not have been refreshed

### Step 10: Finalise

- [ ] Update all evidence tables in this document
- [ ] Update `golden-spc-candidates.md` with any verified candidates
- [ ] Update `spc-control-limit-provenance-verification.md` with confirmed column names
- [ ] Share findings with V2 SPC development team
- [ ] Update domain-readiness-index.md SPC section with confirmed status
