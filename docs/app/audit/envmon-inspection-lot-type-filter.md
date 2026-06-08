# EnvMon Inspection Lot Type Filter

**Date:** 2026-05-17
**Tranche:** k.txt — SAP QM source recovery
**Status:** FILTER CONFIRMED (confirmed-v1) — DDL verification pending
**Evidence:** V1 `apps/envmon/backend/envmon_backend/utils/em_config.py`

---

## Critical Finding

EnvMon V1 filters all inspection lot queries to:

```python
INSPECTION_TYPES = ("14", "Z14")
INSP_TYPES_SQL = "('14', 'Z14')"
```

This is the single most important filter in the entire EnvMon domain. Every query in V1 starts with:

```sql
WHERE lot.INSPECTION_TYPE IN ('14', 'Z14')
```

---

## Filter Details

| Attribute | Value | Evidence |
|---|---|---|
| Column name | `INSPECTION_TYPE` | V1 em_config.py + plants.py, heatmap.py, lots.py, trends.py |
| Table | `gold_inspection_lot` | V1 em_config.py `LOT_TBL_NAME` |
| Filter values | `'14'`, `'Z14'` | V1 em_config.py `INSPECTION_TYPES` tuple |
| Filter type | Inclusive (IN) | All V1 DAL SQL |
| SAP meaning | Type 14 = recurring inspection (environmental); Z14 = customer-extended equivalent | SAP QM convention; not confirmed against UAT DDL |
| Plant-specific differences | None found in V1 — same filter applied to all plants | V1 code review |
| Evidence quality | `confirmed-v1` | Not yet confirmed-ddl in connected_plant_uat |

---

## V1 Source (verbatim)

File: `apps/envmon/backend/envmon_backend/utils/em_config.py`

```python
INSPECTION_TYPES: tuple[str, ...] = ("14", "Z14")
INSP_TYPES_SQL: str = "('14', 'Z14')"
```

Used in every V1 DAL query:

```sql
-- plants.py (fetch_plant_kpis):
AND lot.INSPECTION_TYPE IN ('14', 'Z14')

-- heatmap.py:
AND lot.INSPECTION_TYPE IN ('14', 'Z14')

-- lots.py:
AND lot.INSPECTION_TYPE IN ('14', 'Z14')
```

---

## SAP QM Background

In SAP QM:
- **Inspection type** (`QALS.ART` / `QAMR.ART`) identifies the kind of inspection lot
- Type `14` = **recurring inspection** — used for environmental monitoring, hygiene swabs, plant monitoring
- Type `Z14` = customer/company extension of type 14 (same purpose, local code)
- Types `04` (RM goods receipt), `89` (FP goods receipt) are used by CQ Lab — different from EnvMon

This means EnvMon inspection lots are recurring (periodic/scheduled) environmental inspections, not production or goods-receipt quality checks.

---

## UAT Discovery SQL

Before wiring any route, run these queries in the Databricks SQL Editor to confirm the filter values exist in UAT data:

```sql
-- 1. Confirm INSPECTION_TYPE column name and values
DESCRIBE TABLE connected_plant_uat.<TRACE_SCHEMA>.gold_inspection_lot;

-- 2. Find distinct INSPECTION_TYPE values (confirm 14 and Z14 are present)
SELECT DISTINCT
    INSPECTION_TYPE,
    COUNT(*) AS lot_count
FROM connected_plant_uat.<TRACE_SCHEMA>.gold_inspection_lot
GROUP BY INSPECTION_TYPE
ORDER BY lot_count DESC;

-- 3. Verify EnvMon lot volume for a known plant
SELECT
    PLANT_ID,
    INSPECTION_TYPE,
    COUNT(*) AS lot_count,
    MIN(CREATED_DATE) AS earliest,
    MAX(CREATED_DATE) AS latest
FROM connected_plant_uat.<TRACE_SCHEMA>.gold_inspection_lot
WHERE INSPECTION_TYPE IN ('14', 'Z14')
GROUP BY PLANT_ID, INSPECTION_TYPE
ORDER BY PLANT_ID, INSPECTION_TYPE;
```

Replace `<TRACE_SCHEMA>` with the value of the `TRACE_SCHEMA` environment variable (default: `gold`).

---

## Do Not Invent

**Never add inspection type values not recovered from V1 or confirmed via UAT DDL.**

The only confirmed values are `'14'` and `'Z14'`. Do not add:
- `'89'` (FP quality lots — used by CQ Lab, not EnvMon)
- `'04'` (RM quality lots — used by CQ Lab, not EnvMon)
- `'Z89'`, `'Z04'`, `'01'`, `'03'` or any other values without V1 or UAT evidence

---

## Status

| Item | Status |
|---|---|
| Filter values `'14'`, `'Z14'` | confirmed-v1 |
| Column name `INSPECTION_TYPE` | confirmed-v1 |
| Table `gold_inspection_lot` | confirmed-v1 |
| Values present in connected_plant_uat | **pending DDL** |
| V2 QuerySpec uses this filter | Yes — `envmon_databricks_adapter.py` `get_site_summary_spec` |
