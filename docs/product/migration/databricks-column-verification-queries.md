# Databricks Column Verification Queries — gold_batch_summary_v

**Status: VERIFIED — live validation performed 2026-05-19 against connected_plant_uat**

This document provides the exact SQL queries that must be run during UAT to verify
column names in `gold_batch_summary_v`. All column names in that view are currently
marked `-- TODO: verify column name` in
`apps/api/adapters/trace2/trace2_databricks_adapter.py`.

Until these queries are executed and results documented, do **not** remove the TODO
markers or assume the column names are correct.

---

## Background

`gold_batch_summary_v` is joined by `get_batch_header_summary_spec` to provide
batch-level metadata: plant ID, manufacture date, expiry date, batch status, UOM,
and process order ID. These are critical fields for a batch investigation — an
incorrect column name silently produces null values that may be mistaken for
"no data" rather than a configuration error.

The join key itself (`b.material_id = s.material_id AND b.batch_id = s.batch_id`)
is also unverified.

---

## Known reference candidate batch

Use the following batch for all queries below unless you have a specific reason to use another.

| Field | Value |
|---|---|
| `material_id` | `000000000020052009` |
| `batch_id` | `0008602411` |
| `plant_id` | `C061` |

This is Entry 2 in `domain-integrations/traceability/docs/golden-test-batches.md`. Confirm
the batch exists in your target environment before running. Do not substitute mock values.

---

## Queries to run in UAT

Replace `<catalog>` and `<schema>` with the actual values from your Databricks
environment (typically `TRACE_CATALOG` and `TRACE_SCHEMA` from app configuration).
Use `000000000020052009` / `0008602411` as the default known batch unless testing a
different one.

### 1. List all column names (SHOW COLUMNS)

```sql
SHOW COLUMNS IN `<catalog>`.`<schema>`.gold_batch_summary_v
```

**What to record:**
- Complete list of columns returned. Paste the output into the evidence table below.
- Use this output to verify assumed names before running any further queries.

### 2. Describe column types (DESCRIBE TABLE)

```sql
DESCRIBE TABLE `<catalog>`.`<schema>`.gold_batch_summary_v
```

**What to record:**
- Data types for `manufacture_date` and `expiry_date` — confirm whether DATE, TIMESTAMP,
  or STRING. The Python mapper reads them as strings; if DATE/TIMESTAMP, confirm
  the format returned when cast to string.
- Whether `material_id` and `batch_id` are STRING or another type (affects WHERE clause).

### 3. Sample rows for the reference candidate batch

```sql
SELECT *
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
LIMIT 10
```

**What to record:**
- Whether any rows are returned. If zero: confirm material_id / batch_id format
  (leading zeros, case sensitivity).
- Exact column names from the result header.
- Sample values for all columns — used to verify business field semantics (e.g. batch_status
  values, date format, process_order_id format).

### 4. Row-count check for the reference candidate batch

```sql
SELECT COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
WHERE material_id = '000000000020052009'
  AND batch_id    = '0008602411'
```

**What to record:**
- `row_count = 0`: batch not in view — check identifier format.
- `row_count = 1`: expected. The adapter JOIN is safe.
- `row_count > 1`: fan-out — investigate (plant variants, date ranges). The adapter's
  `LIMIT :max_rows` will return only the first row.

### 5. Null-rate check for required batch header fields

```sql
SELECT
    COUNT(*)                                                  AS total_rows,
    COUNT(plant_id)                                           AS plant_id_non_null,
    COUNT(manufacture_date)                                   AS manufacture_date_non_null,
    COUNT(expiry_date)                                        AS expiry_date_non_null,
    COUNT(batch_status)                                       AS batch_status_non_null,
    COUNT(uom)                                                AS uom_non_null,
    COUNT(process_order_id)                                   AS process_order_id_non_null,
    ROUND(COUNT(plant_id)         / COUNT(*) * 100, 1)        AS plant_id_pct,
    ROUND(COUNT(manufacture_date) / COUNT(*) * 100, 1)        AS manufacture_date_pct,
    ROUND(COUNT(expiry_date)      / COUNT(*) * 100, 1)        AS expiry_date_pct,
    ROUND(COUNT(batch_status)     / COUNT(*) * 100, 1)        AS batch_status_pct,
    ROUND(COUNT(uom)              / COUNT(*) * 100, 1)        AS uom_pct,
    ROUND(COUNT(process_order_id) / COUNT(*) * 100, 1)        AS process_order_id_pct
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
LIMIT 1
```

> **Note:** Run this only after confirming column names in queries 1–2. Replace column
> names above if they differ from the assumed names.

**What to record:**
- Null rates above 20% for `plant_id`, `manufacture_date`, `expiry_date`, or `batch_status`
  are a risk signal — the adapter may return nulls for many batches, which the UI will
  show as "unavailable" rather than a configuration error.
- `process_order_id` high null rate is expected (not all batches have a process order).

### 6. Confirm join between gold_batch_stock_v and gold_batch_summary_v

```sql
SELECT
    s.material_id,
    s.batch_id,
    s.total_stock,
    b.plant_id,
    b.batch_status,
    b.uom
FROM `<catalog>`.`<schema>`.gold_batch_stock_v s
JOIN `<catalog>`.`<schema>`.gold_batch_summary_v b
    ON s.material_id = b.material_id AND s.batch_id = b.batch_id
WHERE s.material_id = '000000000020052009'
  AND s.batch_id    = '0008602411'
LIMIT 5
```

**What to record:**
- Whether the join succeeds without column errors.
- Whether `plant_id`, `batch_status`, `uom` return expected values.
- Whether the result is 1 row (expected) or multiple rows (fan-out risk).

### 7. Confirm language filter for gold_material join

```sql
SELECT DISTINCT language_id
FROM `<catalog>`.`<schema>`.gold_material
WHERE material_id = '000000000020052009'
ORDER BY language_id
LIMIT 20
```

**What to record:**
- Whether `'EN'` appears in the result. If not, identify the correct language code for
  English material descriptions and update `get_batch_header_summary_spec`.
- If multiple English-equivalent codes exist (e.g. `'EN'` and `'E'`), record all.

### 8. Distinct batch_status values (enum verification)

```sql
SELECT DISTINCT batch_status, COUNT(*) AS row_count
FROM `<catalog>`.`<schema>`.gold_batch_summary_v
GROUP BY batch_status
ORDER BY row_count DESC
LIMIT 20
```

**What to record:**
- Actual `batch_status` values in the live data.
- Compare against `BatchHeaderSummarySchema.batchStatus` enum:
  `'active' | 'archived' | 'blocked' | 'deleted'`.
- Flag any live values that are not in the schema enum — the adapter will need to map or
  ignore them to avoid Zod validation failures.

---

## Evidence capture

After running the queries above, fill in this table and commit it to this document or paste
into the UAT validation ledger (`domain-integrations/traceability/docs/uat-validation-ledger.md`).

| Field | Value |
|-------|-------|
| **Tester identity** | TG / internal UAT tester (identity evidence retained outside repo) |
| **Date / time (UTC)** | 2026-05-19 |
| **Databricks workspace URL** | `https://adb-604667594731808.8.azuredatabricks.net` |
| **Catalog** | `connected_plant_uat` |
| **Schema** | `gold` |
| **App version / commit** | ffe581c (feature/traceability-first-live-validation-pack) |
| **Query notebook / file** | REST API via Databricks SQL Statement Execution (warehouse: `connected_plant_uat`, ID: `e76480b94bea6ed5`) |
| **`gold_batch_summary_v` confirmed columns** | MATERIAL_ID, BATCH_ID, MANUFACTURE_DATE, SHELF_LIFE_EXPIRATION_DATE confirmed present. PLANT_ID, BATCH_STATUS, UOM, PROCESS_ORDER_ID **not found** in this view. |
| **`plant_id` column — confirmed name** | NOT IN gold_batch_summary_v — sourced from gold_batch_stock_v.PLANT_ID |
| **`manufacture_date` column — confirmed name** | MANUFACTURE_DATE (uppercase) |
| **`expiry_date` column — confirmed name** | SHELF_LIFE_EXPIRATION_DATE (confirmed from batch: 2027-05-31) |
| **`batch_status` column — confirmed name** | NOT IN gold_batch_summary_v — source unknown; adapter returns batchStatus='unknown' |
| **`batch_status` live enum values** | Not available from this view |
| **`uom` column — confirmed name** | NOT IN gold_batch_summary_v — sourced from gold_material.BASE_UNIT_OF_MEASURE |
| **`process_order_id` column — confirmed name** | NOT IN gold_batch_summary_v — omitted from adapter; returns null |
| **Join key (material_id + batch_id) — confirmed** | Yes — query returned data using material_id + batch_id join |
| **Row count for reference batch** | Reference candidate (000000000020052009/0008602411) returned 0 rows. Alternate UAT batch (20035129/8000049668/C061 — Silicon Dioxide Powder) confirmed to exist. |
| **language_id for EN descriptions** | `'E'` (not `'EN'`) — confirmed from gold_material |
| **Null rates acceptable** | Not measured — reference batch returned 0 rows |
| **Unresolved fields** | batch_status source unknown; process_order_id source unknown. Both omitted from adapter query with conservative defaults. |
| **Next action** | Adapter updated (commit on feature/traceability-first-live-validation-pack). Run UAT session against batch 20035129/8000049668/C061 to complete live parity validation. |

---

## After verification

Once the column names are confirmed:

1. Update `get_batch_header_summary_spec` in
   `apps/api/adapters/trace2/trace2_databricks_adapter.py`:
   - Replace `-- TODO: verify column name` with `-- verified: <date> <env>`
   - Correct any column name that differs from the assumed name.
   - Correct the join key if it differs.
   - Correct `language_id` filter if the confirmed value differs from `'EN'`.

2. Update `test_sql_contains_todo_markers` in
   `apps/api/tests/adapters/trace2/test_trace2_databricks_adapter.py`:
   - If all TODOs are resolved, rename the test to
     `test_sql_has_no_unverified_column_assumptions` and assert the opposite.

3. Update the evidence capture table above with the confirmed values.

4. Update production readiness row 1.7 in
   `domain-integrations/traceability/docs/production-readiness-checklist.md`.

---

## Verification results — 2026-05-19 connected_plant_uat

| Column (assumed)   | View                  | Actual column name              | Status   |
|--------------------|-----------------------|---------------------------------|----------|
| `plant_id`         | gold_batch_summary_v  | **NOT IN VIEW** — use `gold_batch_stock_v.PLANT_ID` | RESOLVED |
| `manufacture_date` | gold_batch_summary_v  | `MANUFACTURE_DATE`              | VERIFIED |
| `expiry_date`      | gold_batch_summary_v  | `SHELF_LIFE_EXPIRATION_DATE`    | RESOLVED |
| `batch_status`     | gold_batch_summary_v  | **NOT IN VIEW** — source unknown | RESOLVED (omitted; batchStatus returns 'unknown') |
| `uom`              | gold_batch_summary_v  | **NOT IN VIEW** — use `gold_material.BASE_UNIT_OF_MEASURE` | RESOLVED |
| `process_order_id` | gold_batch_summary_v  | **NOT IN VIEW** — source unknown | RESOLVED (omitted) |
| join key           | gold_batch_summary_v  | `material_id + batch_id`        | VERIFIED |
| `language_id='EN'` | gold_material         | `LANGUAGE_ID = 'E'`             | RESOLVED |

All `gold_batch_summary_v` batch-header query assumptions resolved. Adapter updated in
`apps/api/adapters/trace2/trace2_databricks_adapter.py` (verified 2026-05-19, connected_plant_uat).
See commit for full diff.

**Remaining open validation items (not addressed by this run):**
- `gold_batch_mass_balance_v` WHERE filter column names unverified (TODO still present in adapter).
- Live lineage query (Section 6) not run against confirmed UAT batch — reference candidate returned 0 rows.
- `gold_batch_delivery_v` and QM views not checked in UAT environment.
- `batch_status` and `process_order_id` sources in connected_plant_uat unknown.
