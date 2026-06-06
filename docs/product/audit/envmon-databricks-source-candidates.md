# EnvMon Databricks Source Candidates

**Date:** 2026-05-17 (i.txt groundwork) | **Corrected:** 2026-05-17 (k.txt SAP QM recovery)
**Status:** CONFIRMED-V1 (3 primary views) — DDL verification pending in connected_plant_uat
**Reference:** `docs/audit/envmon-sap-qm-source-model.md`, `docs/audit/envmon-inspection-lot-type-filter.md`

---

## Correction (k.txt, 2026-05-17)

The i.txt groundwork incorrectly classified all candidates as "entirely speculative" with a LIMS source. The V1 source model has been recovered from the ConnectIO-RAD repo. The candidates below are now classified as `confirmed-v1` (confirmed from V1 source code) pending DDL verification.

---

## Primary Sources (confirmed-v1)

These three views are confirmed from V1 `em_config.py`, `entities.yaml`, and DAL SQL. They use `TRACE_CATALOG / TRACE_SCHEMA` (same catalog as Trace2 — default `connected_plant_uat.gold`).

### `gold_inspection_lot`

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `gold` (TRACE_SCHEMA default) |
| Purpose | SAP QM inspection lot header |
| EnvMon role | Primary query table; filtered by INSPECTION_TYPE IN ('14','Z14') |
| Key columns | INSPECTION_LOT_ID, PLANT_ID, INSPECTION_TYPE, CREATED_DATE, INSPECTION_END_DATE |
| Status | **confirmed-v1** |
| Evidence | V1 `em_config.py` `LOT_TBL_NAME` + `entities.yaml` |

### `gold_inspection_point`

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `gold` (TRACE_SCHEMA default) |
| Purpose | Inspection sample points with FUNCTIONAL_LOCATION (SAP TPLNR) |
| EnvMon role | Maps lots to physical floor positions; join bridge to results |
| Key columns | INSPECTION_LOT_ID (FK), INSPECTION_POINT_ID, FUNCTIONAL_LOCATION, OPERATION_ID, SAMPLE_ID |
| Status | **confirmed-v1** |
| Evidence | V1 `em_config.py` `POINT_TBL_NAME` + `entities.yaml` + `plants.py` join keys |

### `gold_batch_quality_result_v`

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `gold` (TRACE_SCHEMA default) |
| Purpose | MIC test results — one row per characteristic per sample |
| EnvMon role | Result valuations, numeric values, specification limits |
| Key columns | INSPECTION_LOT_ID+OPERATION_ID+SAMPLE_ID (composite FK), MIC_NAME, INSPECTION_RESULT_VALUATION, QUANTITATIVE_RESULT, UPPER_TOLERANCE, LOWER_TOLERANCE |
| Status | **confirmed-v1** |
| Evidence | V1 `em_config.py` `RESULT_TBL_NAME` + `entities.yaml` + `plants.py` join keys |

---

## Shared View (confirmed-ddl)

### `gold_plant`

| Attribute | Value |
|---|---|
| Catalog | `connected_plant_uat` |
| Schema | `gold` |
| Purpose | Plant master — name, country, city |
| EnvMon role | Enrichment (optional) |
| Status | **confirmed-ddl** (verified 2026-05-17 via `getLabPlants` browser verification) |
| Evidence | CQ Lab `getLabPlants` — PLANT_ID, PLANT_NAME confirmed |

---

## App-Managed Tables (confirmed-v1 as V1 objects — existence in connected_plant_uat UNKNOWN)

These tables are owned by the V1 EnvMon app, not data engineering. They **may not exist in connected_plant_uat**.

| Object | Catalog in V1 | Purpose | Status | Risk |
|---|---|---|---|---|
| `em_location_coordinates` | `EM_CATALOG.EM_SCHEMA` | FUNCTIONAL_LOCATION → floor x/y coordinates | confirmed-v1 (V1 only) | **HIGH — may not exist in UAT** |
| `em_plant_floor` | `EM_CATALOG.EM_SCHEMA` | Plant floor SVG definition | confirmed-v1 (V1 only) | HIGH |
| `em_plant_geo` | `EM_CATALOG.EM_SCHEMA` | Plant lat/lon | confirmed-v1 (V1 only) | HIGH |
| `em_location_zones` | `EM_CATALOG.EM_SCHEMA` | Zone / hygiene zone classification per FUNCTIONAL_LOCATION | confirmed-v1 (V1 only) | HIGH |
| `em_layout_revision` | `EM_CATALOG.EM_SCHEMA` | SVG revision tracking | confirmed-v1 (V1 only) | HIGH |

To discover whether em_* tables exist in UAT:
```sql
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
-- Or search across all schemas:
SHOW TABLES IN connected_plant_uat.gold;
```

---

## Previously Listed LIMS Candidates — Retired

The following candidate groups from i.txt are retired. They were inferred from LIMS patterns and are not the actual V1 source:

- Group B (LIMS-native: lims_swab_result, lims_sampling_point, etc.) — **Not the source; retired**
- Group C (EnvMon-specific: gold_em_result, gold_em_location, etc.) — **Not the source; retired**

The actual source is Group A (SAP QM inspection lots via gold_inspection_lot, gold_inspection_point, gold_batch_quality_result_v), which are now confirmed-v1.

---

## How to Confirm

Run DDL in Databricks SQL Editor:

```sql
-- Confirm primary views
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_lot;
DESCRIBE TABLE connected_plant_uat.gold.gold_inspection_point;
DESCRIBE TABLE connected_plant_uat.gold.gold_batch_quality_result_v;

-- Confirm inspection type filter values are present
SELECT DISTINCT INSPECTION_TYPE, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_inspection_lot
GROUP BY INSPECTION_TYPE ORDER BY n DESC;

-- Confirm valuation values
SELECT DISTINCT INSPECTION_RESULT_VALUATION, COUNT(*) AS n
FROM connected_plant_uat.gold.gold_batch_quality_result_v
GROUP BY INSPECTION_RESULT_VALUATION ORDER BY n DESC;

-- Check for app-managed tables
SHOW TABLES IN connected_plant_uat.gold LIKE 'em_%';
```

Update `docs/audit/envmon-native-column-verification-checklist.md` after running DDL.
