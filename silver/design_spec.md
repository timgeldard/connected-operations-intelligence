# Silver Layer Design Specification

**Schema:** `${var.catalog}.${var.schema}`  
**Data product:** Integrated Operations — Warehouse & Manufacturing  
**Primary personas:** Warehouse Operative, Warehouse Supervisor, Plant Manager  
**SAP source:** PP-PI (Process Industries) via Aecorsoft → `${var.source_catalog}.${var.source_schema}` (parameterized — see Deployment)  
**Scale:** 100+ plants

---

## Architecture

```
${var.source_catalog}.${var.source_schema} (Bronze — Aecorsoft Delta replication)
         │
         │  AEDATTM / RecordActivity watermarking
         ▼
  Delta Live Tables Pipeline (silver_pipeline)
  Mode: Continuous (near real-time)
  Target catalog: ${var.catalog}
         │
         ├─ Staging views  (@dlt.view)
         │   • Column rename + type cast
         │   • Zero-pad strip
         │   • Expectation enforcement
         │
         └─ Silver tables  (dlt.apply_changes, SCD Type 1)
              Liquid clustering by plant_code + primary date
              Change Data Feed enabled
              Unity Catalog Row Filter for plant-level access
         │
         ▼
  ${var.catalog}.${var.schema}
```

### Key design decisions

| Decision | Choice | Rationale |
|---|---|---|
| Pipeline mode | **Continuous** | Near real-time delivery; Aecorsoft replicates incrementally |
| Change strategy | **SCD Type 1** via `dlt.apply_changes` | Operational state — current values matter, not history |
| Clustering | **Liquid clustering** on `plant_code` + date | Auto-compacts; no manual tuning at 100+ plant scale |
| CDC source | `RecordActivity` / `OPFLAG` where present; `AEDATTM` sequence otherwise | Handles deletes from SAP where flagged |
| Key fields | Zero-padding stripped on all SAP key columns | Database-level extraction — see bronze conventions |
| Date fields | `YYYYMMDD` STRING → `DATE`; date+time pairs → `TIMESTAMP` | Usable in BI without transformation |
| Descriptions | Denormalised at silver | Eliminates joins in BI / Gold layer |
| Multi-plant access | Unity Catalog Row Filter function on `plant_code` | One table set; access enforced at query time |
| Shift structure | **Gold layer** | Shift boundaries vary per plant; aggregation belongs in Gold |

---

## Deployment

Managed via Declarative Automation Bundle (DAB). See `docs/adr/001-dab-bundle-deployment.md`.

### Environment Target Matrix

| Target | Output Catalog (`${var.catalog}`) | Silver Schema (`${var.schema}`) | Source Catalog (`${var.source_catalog}`) | Source Schema (`${var.source_schema}`) |
| :--- | :--- | :--- | :--- | :--- |
| **dev** | `connected_plant_dev` | `silver_dev` | `connected_plant_uat` (Compromise) | `sap` |
| **uat** | `connected_plant_uat` | `silver` | `connected_plant_uat` | `sap` |
| **prod** | `connected_plant_prod` | `silver` | `connected_plant_prod` | `sap` |

---

## Data Quality

Expectations are applied to staging views (before `apply_changes`). See `docs/adr/003-data-quality-expectations-strategy.md`.

| Severity | When used | Effect |
|---|---|---|
| `expect_or_drop` | Missing primary key components | Row excluded from target table |
| `expect` (warn) | Business logic violations (date ordering, sign checks) | Row passes through; violation counted in pipeline metrics |

Current checks by table:

| Table | Drop checks | Warn checks |
|---|---|---|
| `process_order` | order_number, plant_code | quantity ≥ 0, scheduled dates ordered, actual dates ordered |
| `process_order_operation` | order_number, operation_number | plant_code present, scheduled dates ordered |
| `pi_sheet_execution` | order_number, operation_number | start ≤ end |
| `goods_movement` | document_number, plant_code | movement_type_code present |
| `batch_stock` | material_code, plant_code | unrestricted_quantity ≥ 0 |
| `warehouse_transfer_order` | warehouse_number, transfer_order_number | — |
| `warehouse_transfer_requirement` | warehouse_number, transfer_requirement_number | required_quantity > 0 |
| `storage_bin` | warehouse_number, bin_code | — |
| `downtime_event` | plant_code, start_datetime | duration ≥ 0 |
| `quality_inspection_lot` | inspection_lot_number, plant_code | material_code present, inspection dates ordered |
| `material` | material_code, plant_code | base_uom present, material_type present |
| `storage_location` | plant_code, storage_location_code | — |
| `work_centre` | work_centre_code, plant_code | — |
| `capacity_utilisation` | plant_code, capacity_id | — |

---

## Table Catalogue

| Silver Table | Granularity | Primary SAP Sources | Personas |
|---|---|---|---|
| `process_order` | 1 row / order | AUFK + AFKO | Plant Manager, Supervisor |
| `process_order_operation` | 1 row / operation per order | AFVC + AFVV + AFKO | Supervisor, Operative |
| `pi_sheet_execution` | 1 row / PI sheet execution per operation | ZMANPEX_E04_002 | Supervisor, Operative |
| `goods_movement` | 1 row / material document line | MSEG + MKPF | Plant Manager, Supervisor |
| `batch_stock` | 1 row / batch × plant × storage location | MCHB | Supervisor, Operative |
| `warehouse_transfer_order` | 1 row / transfer order item | LTAK + LTAP | Supervisor, Operative |
| `warehouse_transfer_requirement` | 1 row / transfer requirement item | LTBK + LTBP | Supervisor |
| `storage_bin` | 1 row / bin (with current quant if occupied) | LAGP + LQUA | Supervisor, Operative |
| `downtime_event` | 1 row / downtime event | ZPEXPM_DWNT | Plant Manager, Supervisor |
| `quality_inspection_lot` | 1 row / inspection lot | QALS + QMIH + QAMV | Plant Manager, Supervisor |
| `material` | 1 row / material × plant | MARA + MARC + MAKT + ZMANPEX_LOFT_X | All |
| `storage_location` | 1 row / storage location | T001L | All |
| `work_centre` | 1 row / work centre × plant | CRHD + CRTX | All |
| `capacity_utilisation` | 1 row / capacity × period | KAPA + KAKO | Plant Manager |

---

## Unity Catalog Row Filter

Environment-specific Row Filter scripts are maintained under `resources/sql/`.

Example for Production:
```sql
-- Create once per catalog; apply to every silver table
CREATE FUNCTION connected_plant_prod.silver.plant_access_filter(plant_code STRING)
RETURNS BOOLEAN
RETURN CASE
  WHEN IS_ACCOUNT_GROUP_MEMBER('silver_admin') THEN TRUE
  ELSE array_contains(
    split(current_user_attribute('allowed_plants'), ','),
    plant_code
  )
END;

-- Apply to each table (example)
ALTER TABLE connected_plant_prod.silver.process_order
SET ROW FILTER connected_plant_prod.silver.plant_access_filter ON (plant_code);
```

---

## Data Conventions Inherited from Bronze

| Convention | Detail |
|---|---|
| Key zero-padding | Stripped in silver: `REGEXP_REPLACE(col, '^0+', '')` |
| Date strings | `YYYYMMDD` → `DATE` via `TO_DATE(col, 'yyyyMMdd')` |
| Date+time pairs | Combined → `TIMESTAMP` via `TO_TIMESTAMP(CONCAT(date, LPAD(time,6,'0')), 'yyyyMMddHHmmss')` |
| Aecorsoft columns | `AEDATTM` → `_replicated_at`; `AERUNID` → `_run_id`; `AERECNO` → `_record_seq` |
| `RecordActivity` / `OPFLAG` | `'D'` = delete; used in `apply_as_deletes` |

---

## What belongs in Gold (not Silver)

- Shift-level aggregations (shift boundaries vary per plant)
- Production quality & downtime summaries
- On-time-in-full metrics
- Cross-plant comparisons and rankings
- Period-over-period trending
