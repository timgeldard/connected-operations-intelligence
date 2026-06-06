# EnvMon Native Databricks Column Verification Checklist

**Date:** 2026-05-17 (i.txt) | **Updated:** 2026-05-17 (k.txt, l.txt hybrid split, m.txt DDL SQL and site-summary classification, n.txt DDL confirmed + route wired)  
**Status:** Group A — **CONFIRMED-DDL (2026-05-17) — route wired (n.txt)**; Group B — CONFIRMED-V1, EXISTENCE IN UAT UNKNOWN  
**References:** `docs/audit/envmon-sap-qm-source-model.md`, `docs/audit/envmon-spatial-configuration-model.md`, `docs/migration/envmon-site-summary-native-route-plan.md`

EnvMon is a **hybrid domain**. DDL verification falls into two separate groups:

- **Group A — SAP QM read model:** Gold views for inspection lots, points, and results. These are data-engineering-owned and likely exist in connected_plant_uat alongside Trace2 views.
- **Group B — App-managed spatial configuration:** The five `em_*` Delta tables owned by the V1 EnvMon app. These may or may not exist in connected_plant_uat. Confirm existence before designing any spatial feature.

**Legend:**
- `confirmed-v1` — confirmed from V1 ConnectIO-RAD source code or entities.yaml; not yet DDL-verified
- `confirmed-ddl` — verified via `DESCRIBE TABLE` or `SHOW COLUMNS IN` in the live workspace
- `confirmed-browser` — field value confirmed in a live API response in the browser
- `assumed` — inferred from naming convention or prior knowledge; not verified
- `missing` — expected field not found in the view DDL
- `blocked` — cannot verify until another dependency is resolved

Do not mark any field `confirmed-ddl` unless you have run the DDL command and seen the column name in the output.

---

## Group A — SAP QM Read Model

All three views in TRACE_CATALOG / TRACE_SCHEMA (default `connected_plant_uat.gold`).  
All three confirmed-ddl via `DESCRIBE TABLE` in connected_plant_uat on 2026-05-17.

**Route wired 2026-05-17 (n.txt):** `apps/api/routes/envmon.py`. All required Group A columns confirmed-ddl.  
See `docs/migration/envmon-site-summary-native-route-plan.md` for full history.

---

### Required DDL checks for site-summary route (m.txt §2)

Run in Databricks SQL Editor in order. Do not wire the route until all pass.

```sql
-- Step 1: Verify object existence and column DDL
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_point;
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;

-- Step 2: Confirm inspection type filter values ('14' and 'Z14' must be present)
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS lot_count
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE
ORDER BY lot_count DESC;

-- Step 3: Confirm valuation field values (R, REJ, REJECT, W, WARN, A, NULL expected)
SELECT DISTINCT INSPECTION_RESULT_VALUATION, COUNT(*) AS result_count
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY INSPECTION_RESULT_VALUATION
ORDER BY result_count DESC;

-- Step 4: Sample lot data for EnvMon inspection types at plant C061
SELECT *
FROM connected_plant_uat.gold.gold_inspection_lot
WHERE PLANT_ID = 'C061'
  AND INSPECTION_TYPE IN ('14','Z14')
LIMIT 20;

-- Step 5: Sample inspection points for those lots
SELECT *
FROM connected_plant_uat.gold.gold_inspection_point
WHERE INSPECTION_LOT_ID IN (
  SELECT INSPECTION_LOT_ID
  FROM connected_plant_uat.gold.gold_inspection_lot
  WHERE PLANT_ID = 'C061'
    AND INSPECTION_TYPE IN ('14','Z14')
  LIMIT 20
)
LIMIT 20;

-- Step 6: Sample quality results
SELECT *
FROM connected_plant_uat.gold.gold_batch_quality_result_v
LIMIT 20;

-- Step 7: Check em_* spatial tables (Group B)
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

---

### Site Summary Required Columns — Classification (m.txt §2)

Update each column status after running the DDL checks above.

#### `gold_inspection_lot`

| Column | Required for site-summary | Current status |
|---|---|---|
| `INSPECTION_LOT_ID` | Yes — join key | `confirmed-ddl` |
| `PLANT_ID` | Yes — filter | `confirmed-ddl` |
| `INSPECTION_TYPE` | Yes — domain filter IN ('14','Z14') | `confirmed-ddl` |
| `CREATED_DATE` | Yes — period_start / period_end filter | `confirmed-ddl` |

#### `gold_inspection_point`

| Column | Required for site-summary | Current status |
|---|---|---|
| `INSPECTION_LOT_ID` | Yes — join key | `confirmed-ddl` |
| `FUNCTIONAL_LOCATION` | Yes — location grouping | `confirmed-ddl` |
| `OPERATION_ID` | Yes — join key to result_v | `confirmed-ddl` |
| `SAMPLE_ID` | Yes — join key to result_v | `confirmed-ddl` |

#### `gold_batch_quality_result_v`

| Column | Required for site-summary | Current status |
|---|---|---|
| `INSPECTION_LOT_ID` | Yes — join key (part 1) | `confirmed-ddl` |
| `OPERATION_ID` | Yes — join key (part 2) | `confirmed-ddl` |
| `SAMPLE_ID` | Yes — join key (part 3) | `confirmed-ddl` |
| `INSPECTION_RESULT_VALUATION` | Yes — fail/warn/pass classification | `confirmed-ddl` |

**DDL confirmed 2026-05-17 (n.txt):** All required Group A columns verified via `DESCRIBE TABLE` in connected_plant_uat.
Route wired in `apps/api/routes/envmon.py`. 99 tests passing.

---

### `gold_inspection_lot` (TRACE_CATALOG.TRACE_SCHEMA)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;

SELECT * FROM connected_plant_uat.gold.gold_inspection_lot LIMIT 5;

-- Confirm inspection type filter values
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE ORDER BY n DESC;

-- Confirm plant-level data exists for EnvMon lot types
SELECT PLANT_ID, INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
WHERE INSPECTION_TYPE IN ('14','Z14')
GROUP BY PLANT_ID, INSPECTION_TYPE
ORDER BY PLANT_ID;
```

| Contract concept | Column name | Status |
|---|---|---|
| Lot identifier | `INSPECTION_LOT_ID` | `confirmed-ddl` |
| Plant | `PLANT_ID` | `confirmed-ddl` |
| Inspection type (domain filter) | `INSPECTION_TYPE` | `confirmed-ddl` |
| Period start filter | `CREATED_DATE` | `confirmed-ddl` |
| Lot completion date | `INSPECTION_END_DATE` | `confirmed-v1` |
| Material | `MATERIAL_ID` | `confirmed-v1` |
| Batch | `BATCH_ID` | `confirmed-v1` |

---

### `gold_inspection_point` (TRACE_CATALOG.TRACE_SCHEMA)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_point;

SELECT * FROM connected_plant_uat.gold.gold_inspection_point LIMIT 5;

-- Confirm functional location is populated for EnvMon lots
SELECT COUNT(*) AS n, COUNT(FUNCTIONAL_LOCATION) AS with_loc
FROM connected_plant_uat.gold.gold_inspection_point
WHERE INSPECTION_LOT_ID IN (
    SELECT INSPECTION_LOT_ID FROM connected_plant_uat.gold.gold_inspection_lot
    WHERE INSPECTION_TYPE IN ('14','Z14') LIMIT 100
);
```

| Contract concept | Column name | Status |
|---|---|---|
| Lot FK | `INSPECTION_LOT_ID` | `confirmed-ddl` |
| Point identifier | `INSPECTION_POINT_ID` | `confirmed-ddl` |
| Physical location (SAP TPLNR) | `FUNCTIONAL_LOCATION` | `confirmed-ddl` |
| Join key to result_v (part 2) | `OPERATION_ID` | `confirmed-ddl` |
| Join key to result_v (part 3) | `SAMPLE_ID` | `confirmed-ddl` |
| Sample hour | `SAMPLE_HOUR` | `confirmed-v1` |

---

### `gold_batch_quality_result_v` (TRACE_CATALOG.TRACE_SCHEMA)

```sql
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;

SELECT * FROM connected_plant_uat.gold.gold_batch_quality_result_v LIMIT 5;

-- Confirm valuation values
SELECT DISTINCT INSPECTION_RESULT_VALUATION, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY INSPECTION_RESULT_VALUATION ORDER BY n DESC;

-- Confirm MIC names (organism/test types) for EnvMon lots
SELECT DISTINCT MIC_NAME, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_batch_quality_result_v
WHERE INSPECTION_LOT_ID IN (
    SELECT INSPECTION_LOT_ID FROM connected_plant_uat.gold.gold_inspection_lot
    WHERE INSPECTION_TYPE IN ('14','Z14') LIMIT 100
)
GROUP BY MIC_NAME ORDER BY n DESC;
```

| Contract concept | Column name | Status |
|---|---|---|
| Join key (part 1) | `INSPECTION_LOT_ID` | `confirmed-ddl` |
| Join key (part 2) | `OPERATION_ID` | `confirmed-ddl` |
| Join key (part 3) | `SAMPLE_ID` | `confirmed-ddl` |
| Test type / organism | `MIC_NAME` | `confirmed-ddl` |
| Result status | `INSPECTION_RESULT_VALUATION` | `confirmed-ddl` |
| Numeric result value | `QUANTITATIVE_RESULT` | `confirmed-ddl` |
| Upper specification limit | `UPPER_TOLERANCE` | `confirmed-ddl` |
| Lower specification limit | `LOWER_TOLERANCE` | `confirmed-ddl` |

**Valuation mapping (confirmed-v1):**

| Raw value | V2 contract result |
|---|---|
| `R`, `REJ`, `REJECT` | `positive` (fail) |
| `W`, `WARN` | `borderline` (warning) |
| `A` (or other non-null) | `negative` (pass) |
| NULL | `pending` |

---

### Lot-Type Filter Verification

```sql
-- Step 1: Confirm INSPECTION_TYPE column exists and has '14'/'Z14' values
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE ORDER BY n DESC;

-- Step 2: Confirm data volume for EnvMon lot types
SELECT PLANT_ID, COUNT(*) AS lot_count, MIN(CREATED_DATE) AS earliest, MAX(CREATED_DATE) AS latest
FROM connected_plant_uat.gold.gold_inspection_lot
WHERE INSPECTION_TYPE IN ('14','Z14')
GROUP BY PLANT_ID ORDER BY PLANT_ID;
```

Update `docs/audit/envmon-inspection-lot-type-filter.md` status after running step 1.

---

### Group A End-to-End Test

Once all three views are `confirmed-ddl`, run the full site summary query:

```sql
WITH base AS (
    SELECT
        ip.FUNCTIONAL_LOCATION        AS func_loc_id,
        r.INSPECTION_RESULT_VALUATION AS valuation,
        lot.INSPECTION_LOT_ID         AS lot_id
    FROM connected_plant_uat.gold.gold_inspection_lot lot
    JOIN connected_plant_uat.gold.gold_inspection_point ip
        ON lot.INSPECTION_LOT_ID = ip.INSPECTION_LOT_ID
    LEFT JOIN connected_plant_uat.gold.gold_batch_quality_result_v r
        ON ip.INSPECTION_LOT_ID = r.INSPECTION_LOT_ID
       AND ip.OPERATION_ID      = r.OPERATION_ID
       AND ip.SAMPLE_ID         = r.SAMPLE_ID
    WHERE lot.PLANT_ID = 'C061'
      AND lot.INSPECTION_TYPE IN ('14','Z14')
      AND ip.FUNCTIONAL_LOCATION IS NOT NULL
      AND lot.CREATED_DATE >= DATEADD(DAY, -90, CURRENT_DATE)
),
loc_status AS (
    SELECT
        func_loc_id,
        MAX(CASE WHEN valuation IN ('R','REJ','REJECT') THEN 1 ELSE 0 END) AS is_fail,
        MAX(CASE WHEN valuation IN ('W','WARN')         THEN 1 ELSE 0 END) AS is_warn,
        COUNT(DISTINCT lot_id)                                              AS lot_count
    FROM base GROUP BY func_loc_id
)
SELECT COUNT(*) AS total_locs, SUM(is_fail) AS active_fails, SUM(lot_count) AS lots_tested
FROM loc_status;
```

If this returns rows, the QuerySpec for `getEnvMonSiteSummary` is ready for route wiring.

---

## Group B — App-Managed Spatial Configuration

All five `em_*` tables are in TRACE_CATALOG / TRACE_SCHEMA (same catalog as Group A).  
DDL is **confirmed-v1** from V1 migration scripts (`ConnectIO-RAD/apps/envmon/scripts/migrations/`).  
Existence in `connected_plant_uat` is **unknown** — run `SHOW TABLES` first.

**If em_* tables do not exist:** heatmap, zone, and spatial configuration methods remain blocked. SAP QM methods (Group A) are unaffected.

---

### Step 0: Check em_* table existence

```sql
-- Run this first. If empty: all Group B methods are blocked.
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

---

### `em_plant_floor`

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_plant_floor;

-- Check floor coverage by plant
SELECT plant_id, COUNT(*) AS floor_count
FROM connected_plant_uat.gold.em_plant_floor
GROUP BY plant_id ORDER BY floor_count DESC;

-- Check revision linkage
SELECT plant_id, floor_id, floor_name, active_revision_id IS NOT NULL AS has_active_revision
FROM connected_plant_uat.gold.em_plant_floor;
```

| Field | Column | Status |
|---|---|---|
| Plant | `plant_id` | `confirmed-v1` (migration 001c) |
| Floor | `floor_id` | `confirmed-v1` |
| Floor name | `floor_name` | `confirmed-v1` |
| Legacy SVG URL | `svg_url` | `confirmed-v1` |
| Legacy SVG dimensions | `svg_width`, `svg_height` | `confirmed-v1` |
| Sort order | `sort_order` | `confirmed-v1` |
| Canvas type | `canvas_type` | `confirmed-v1` (migration 006) |
| Canvas dimensions | `canvas_width`, `canvas_height`, `canvas_units` | `confirmed-v1` (migration 006) |
| Background image URL | `background_image_url` | `confirmed-v1` (migration 006) |
| Background type | `background_image_type` | `confirmed-v1` (migration 006) |
| Background checksum | `background_checksum` | `confirmed-v1` (migration 006) |
| Active revision FK | `active_revision_id` | `confirmed-v1` (migration 006) |
| Existence in UAT | — | **UNKNOWN — run SHOW TABLES** |

---

### `em_location_coordinates`

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_location_coordinates;

-- Check coordinate coverage
SELECT plant_id, floor_id, COUNT(*) AS coord_count
FROM connected_plant_uat.gold.em_location_coordinates
GROUP BY plant_id, floor_id ORDER BY plant_id, floor_id;

-- Check zone assignment rate
SELECT
    COUNT(*) AS total_points,
    COUNT(parent_zone_id) AS zone_assigned,
    COUNT(revision_id) AS revision_linked
FROM connected_plant_uat.gold.em_location_coordinates;
```

| Field | Column | Status |
|---|---|---|
| Plant | `plant_id` | `confirmed-v1` (migration 001b) |
| SAP TPLNR | `func_loc_id` | `confirmed-v1` |
| Floor | `floor_id` | `confirmed-v1` |
| X position (%) | `x_pos` | `confirmed-v1` |
| Y position (%) | `y_pos` | `confirmed-v1` |
| Zone FK | `parent_zone_id` | `confirmed-v1` (migration 007) |
| Placement source | `placement_source` | `confirmed-v1` (migration 007) |
| Revision FK | `revision_id` | `confirmed-v1` (migration 007) |
| Validation status | `validation_status` | `confirmed-v1` (migration 007) |
| Existence in UAT | — | **UNKNOWN — run SHOW TABLES** |

---

### `em_layout_revision`

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_layout_revision;

-- Check revision states
SELECT plant_id, floor_id, state, COUNT(*) AS n
FROM connected_plant_uat.gold.em_layout_revision
GROUP BY plant_id, floor_id, state ORDER BY plant_id, floor_id, state;
```

| Field | Column | Status |
|---|---|---|
| Revision ID (PK) | `revision_id` | `confirmed-v1` (migration 004) |
| Plant | `plant_id` | `confirmed-v1` |
| Floor | `floor_id` | `confirmed-v1` |
| Revision number | `revision_number` | `confirmed-v1` |
| State | `state` | `confirmed-v1` (draft/published/superseded/rolled_back) |
| Change reason | `change_reason` | `confirmed-v1` |
| Published by/at | `published_by`, `published_at` | `confirmed-v1` |
| Existence in UAT | — | **UNKNOWN — run SHOW TABLES** |

---

### `em_location_zones`

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_location_zones;

-- Check zone geometry types and statuses
SELECT geometry_type, status, COUNT(*) AS n
FROM connected_plant_uat.gold.em_location_zones
GROUP BY geometry_type, status ORDER BY n DESC;

-- Check L4 functional location assignment rate
SELECT
    COUNT(*) AS total_zones,
    COUNT(functional_location_id) AS with_l4_loc,
    COUNT(parent_zone_id) AS nested_zones
FROM connected_plant_uat.gold.em_location_zones;
```

| Field | Column | Status |
|---|---|---|
| Zone ID (PK) | `zone_id` | `confirmed-v1` (migration 005) |
| Plant | `plant_id` | `confirmed-v1` |
| Floor | `floor_id` | `confirmed-v1` |
| L4 functional location | `functional_location_id` | `confirmed-v1` |
| Zone name | `zone_name` | `confirmed-v1` |
| Geometry type | `geometry_type` | `confirmed-v1` (polygon/rectangle) |
| Geometry JSON | `geometry_json` | `confirmed-v1` |
| Centroid | `centroid_x`, `centroid_y` | `confirmed-v1` |
| Revision FK | `revision_id` | `confirmed-v1` |
| Status | `status` | `confirmed-v1` (draft/published/archived) |
| `hygiene_zone` | — | **MISSING** — not in V1 DDL; V2 contract has this; requires new design |
| `area_type` | — | **MISSING** — not in V1 DDL; V2 contract has this; requires new design |
| Existence in UAT | — | **UNKNOWN — run SHOW TABLES** |

---

### `em_plant_geo`

```sql
DESCRIBE TABLE connected_plant_uat.gold.em_plant_geo;

SELECT plant_id, lat, lon FROM connected_plant_uat.gold.em_plant_geo;
```

| Field | Column | Status |
|---|---|---|
| Plant | `plant_id` | `confirmed-v1` (migration 003) |
| Latitude | `lat` | `confirmed-v1` |
| Longitude | `lon` | `confirmed-v1` |
| Existence in UAT | — | **UNKNOWN — run SHOW TABLES** |

---

## How to Update This Checklist

1. Run `SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%'` first.
2. If `em_*` tables exist: run `DESCRIBE TABLE` for each and mark `confirmed-ddl`.
3. For `gold_inspection_lot` etc.: run `DESCRIBE TABLE` for each and mark `confirmed-ddl`.
4. For enums (INSPECTION_TYPE, INSPECTION_RESULT_VALUATION, state, geometry_type): run `SELECT DISTINCT` and verify values match expectations.
5. If a column is not found, mark `missing` and note the date — do not wire that field.
6. If `em_*` tables do not exist, mark Group B as `blocked — tables not in UAT` and create a missing-artifact request.
7. Do not wire any QuerySpec or route until all required columns for that slice are `confirmed-ddl`.

After DDL confirmation, update `docs/audit/envmon-databricks-source-candidates.md` and `docs/migration/envmon-native-candidate-ranking.md`.
