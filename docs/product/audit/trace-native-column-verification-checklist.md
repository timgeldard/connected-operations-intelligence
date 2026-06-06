# Trace Native — Column Verification Checklist

**Date:** 2026-05-17  
**Status:** Partially verified — some items confirmed from V1 source inspection; blocking items still require manual execution in Databricks SQL editor or notebook.  
**Catalog:** `connected_plant_uat`  
**Schema:** `gold`  
**Reference:** `docs/migration/trace-native-batch-header-lineage-plan.md`

---

## How to use this checklist

Execute each SQL snippet below in the Databricks SQL editor against `connected_plant_uat`.  
Update the status column after each check.  
Do not mark any route as executable until all blocking TODOs for that route are confirmed.

---

## 1. DDL Checks

### gold_batch_stock_v — STATUS: CONFIRMED (no further action needed)

All columns used in `get_batch_header_summary_spec` are confirmed from V1 source inspection:
`material_id`, `batch_id`, `unrestricted`, `blocked`, `quality_inspection`, `restricted`, `transit`, `total_stock`.

### gold_batch_lineage — STATUS: CONFIRMED (no further action needed)

All columns used in `get_trace_graph_spec` are confirmed:
`parent_material_id`, `parent_batch_id`, `parent_plant_id`, `child_material_id`, `child_batch_id`, `child_plant_id`, `link_type`.

---

### gold_batch_summary_v — STATUS: NOT VERIFIED (BLOCKING)

**Blocks:** `getBatchHeaderSummary` native route

Run:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_summary_v;
```

Expected (assumed) columns — verify each exists and note actual name if different:

| Assumed name | Actual name | Status |
|---|---|---|
| `plant_id` | | [ ] not checked |
| `manufacture_date` | | [ ] not checked |
| `expiry_date` | | [ ] not checked |
| `batch_status` | | [ ] not checked |
| `uom` | | [ ] not checked |
| `process_order_id` | | [ ] not checked |
| `material_id` (join key) | | [ ] not checked |
| `batch_id` (join key) | | [ ] not checked |

Also check: what is the full column list?

---

### gold_material — STATUS: PARTIALLY CONFIRMED (language_id unverified)

**Blocks:** `getBatchHeaderSummary` and `getTraceGraph` JOIN conditions

Run:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_material;
```

Check:
1. Does `language_id` column exist?
2. If yes, sample the distinct values:

```sql
SELECT DISTINCT language_id
FROM connected_plant_uat.gold.gold_material
LIMIT 20;
```

Expected: `'EN'` is a valid value for English material descriptions.

| Column | Exists? | Filter value confirmed? |
|---|---|---|
| `language_id` | [ ] not checked | [ ] not checked |

If `language_id` does not exist, the JOIN condition must be rewritten (e.g. use only `material_id`).  
If multiple languages exist and `language_id = 'EN'` is correct, note the distinct count.

---

### gold_plant — STATUS: ASSUMED CONFIRMED

Run:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_plant;
```

Check join key `plant_id` and display column `plant_name`:

| Column | Exists? |
|---|---|
| `plant_id` | [ ] not checked |
| `plant_name` | [ ] not checked |

---

### gold_batch_mass_balance_v — STATUS: WHERE COLUMNS NOT VERIFIED (BLOCKING)

**Blocks:** `getMassBalanceSummary` native route

Run:
```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_mass_balance_v;
```

Check filter columns:

| Assumed WHERE column | Actual name | Status |
|---|---|---|
| `material_id` | | [ ] not checked |
| `batch_id` | | [ ] not checked |

Also check ORDER BY column `posting_date` exists (confirmed from V1 inspection, but verify).

---

## 2. Sample Row Checks

Use test anchor: `material_id = '000000000020052009'`, `batch_id = '0008602411'`, `plant_id = 'C061'`

### gold_batch_stock_v

```sql
SELECT *
FROM connected_plant_uat.gold.gold_batch_stock_v
WHERE material_id IN ('000000000020052009', '20052009')
  AND batch_id = '0008602411'
LIMIT 10;
```

Expected: 1 row with stock quantities.

| Result | Date | Notes |
|---|---|---|
| [ ] not tested | — | — |

---

### gold_batch_summary_v

```sql
SELECT *
FROM connected_plant_uat.gold.gold_batch_summary_v
WHERE material_id IN ('000000000020052009', '20052009')
  AND batch_id = '0008602411'
LIMIT 10;
```

Expected: 1 row with batch attributes (plant, dates, status).

| Result | Date | Notes |
|---|---|---|
| [ ] not tested | — | — |

---

### gold_batch_lineage

```sql
SELECT *
FROM connected_plant_uat.gold.gold_batch_lineage
WHERE parent_batch_id = '0008602411'
   OR child_batch_id = '0008602411'
LIMIT 50;
```

Expected: 0 or more lineage rows. If 0 rows, the test batch has no direct lineage recorded — use alternate anchor.

| Result | Date | Notes |
|---|---|---|
| [ ] not tested | — | — |

---

### gold_batch_mass_balance_v (run only after WHERE columns confirmed)

```sql
SELECT *
FROM connected_plant_uat.gold.gold_batch_mass_balance_v
WHERE <confirmed_material_id_column> IN ('000000000020052009', '20052009')
  AND <confirmed_batch_id_column> = '0008602411'
LIMIT 20;
```

| Result | Date | Notes |
|---|---|---|
| [ ] not tested | — | — |

---

### gold_material — language check

```sql
SELECT DISTINCT language_id, COUNT(*) AS cnt
FROM connected_plant_uat.gold.gold_material
GROUP BY language_id
ORDER BY cnt DESC
LIMIT 10;
```

| Result | Date | Notes |
|---|---|---|
| [ ] not tested | — | — |

---

## 3. Joint Query Smoke Tests

After all DDL checks pass, run the actual QuerySpec SQL to validate join logic.

### Batch header smoke test

```sql
SELECT
    s.material_id,
    s.batch_id,
    s.unrestricted,
    s.blocked,
    s.quality_inspection,
    s.restricted,
    s.transit,
    s.total_stock,
    m.material_name,
    p.plant_name,
    b.<confirmed_plant_id_col>   AS plant_id,
    b.<confirmed_mfg_date_col>   AS manufacture_date,
    b.<confirmed_exp_date_col>   AS expiry_date,
    b.<confirmed_status_col>     AS batch_status,
    b.<confirmed_uom_col>        AS uom,
    b.<confirmed_po_id_col>      AS process_order_id
FROM connected_plant_uat.gold.gold_batch_stock_v s
JOIN connected_plant_uat.gold.gold_batch_summary_v b
    ON s.material_id = b.material_id AND s.batch_id = b.batch_id
JOIN connected_plant_uat.gold.gold_material m
    ON s.material_id = m.material_id AND m.language_id = 'EN'
JOIN connected_plant_uat.gold.gold_plant p
    ON b.<confirmed_plant_id_col> = p.plant_id
WHERE s.material_id IN ('000000000020052009', '20052009')
  AND s.batch_id = '0008602411';
```

| Result | Date | Row count | Notes |
|---|---|---|---|
| [ ] not tested | — | — | — |

### Direct lineage smoke test

```sql
SELECT
    l.parent_material_id,
    l.parent_batch_id,
    l.parent_plant_id,
    l.child_material_id,
    l.child_batch_id,
    l.child_plant_id,
    l.link_type,
    pm.material_name AS parent_material_name,
    cm.material_name AS child_material_name,
    pp.plant_name    AS parent_plant_name,
    cp.plant_name    AS child_plant_name
FROM connected_plant_uat.gold.gold_batch_lineage l
LEFT JOIN connected_plant_uat.gold.gold_material pm
    ON l.parent_material_id = pm.material_id AND pm.language_id = 'EN'
LEFT JOIN connected_plant_uat.gold.gold_material cm
    ON l.child_material_id = cm.material_id AND cm.language_id = 'EN'
LEFT JOIN connected_plant_uat.gold.gold_plant pp ON l.parent_plant_id = pp.plant_id
LEFT JOIN connected_plant_uat.gold.gold_plant cp ON l.child_plant_id = cp.plant_id
WHERE (l.parent_batch_id = '0008602411' AND l.parent_material_id IN ('000000000020052009', '20052009'))
   OR (l.child_batch_id = '0008602411' AND l.child_material_id IN ('000000000020052009', '20052009'));
```

| Result | Date | Row count | Notes |
|---|---|---|---|
| [ ] not tested | — | — | — |

---

## 4. Summary Status

| View | DDL verified | Sample rows | Join smoke test | Blocks |
|---|---|---|---|---|
| `gold_batch_stock_v` | ✓ confirmed | [ ] not tested | N/A | — |
| `gold_batch_lineage` | ✓ confirmed | [ ] not tested | [ ] not tested | — |
| `gold_batch_summary_v` | **❌ not verified** | [ ] not tested | [ ] not tested | getBatchHeaderSummary |
| `gold_material.language_id` | **❌ not verified** | [ ] not tested | [ ] not tested | getBatchHeaderSummary, getTraceGraph |
| `gold_plant` | [ ] assumed | [ ] not tested | [ ] not tested | getBatchHeaderSummary |
| `gold_batch_mass_balance_v` WHERE cols | **❌ not verified** | [ ] not tested | [ ] not tested | getMassBalanceSummary |

---

## 5. After DDL Confirmation

Once blocking items above are confirmed:

1. Update the TODO comments in `apps/api/adapters/trace2/trace2_databricks_adapter.py` with confirmed column names.
2. Update `docs/migration/trace-native-batch-header-lineage-plan.md` — change DEFERRED decisions to IMPLEMENT.
3. Wire `POST /api/trace2/batch-header` with Databricks-api mode gate (dual-mode like `POST /api/por/order-header`).
4. Run tests.
5. Deploy to UAT and browser-verify — see `docs/deployment/trace-native-browser-verification.md`.

Do not wire routes until DDL is manually verified. Do not invent column names.
