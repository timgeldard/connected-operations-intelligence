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
| Change strategy | **SCD Type 1** via `dlt.apply_changes` (exception: `storage_bin` uses `apply_changes_from_snapshot` over a full current-state snapshot, because its `LQUA` occupancy source is a current-state snapshot with no delete marker) | Operational state — current values matter, not history |
| Clustering | **Liquid clustering** on `plant_code` + date | Auto-compacts; no manual tuning at 100+ plant scale |
| CDC source | `RecordActivity` / `OPFLAG` where present; `AEDATTM`, `AERUNID`, `AERECNO` sequence otherwise | Handles deletes from SAP where flagged and preserves deterministic event ordering |
| Multi-source joins | **Trigger-stream refresh** | Header/detail/reference changes emit affected keys, then rows are rebuilt from latest replicated tables to avoid stale stream-static enrichment |
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
| **dev_uat_source** | `connected_plant_dev` | `silver_dev` | `connected_plant_uat` (Compromise) | `sap` |
| **dev_sample** | `connected_plant_dev` | `silver_dev` | `connected_plant_dev` | `sap_sample` |
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
| `storage_bin` | warehouse_number, storage_type, bin_code, occupancy key (LQNUM / `__EMPTY__`) | — |
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
| `process_order` | 1 row / order | AUFK + AFKO (+ `recipe_process_line` → process line) | Plant Manager, Supervisor |
| `process_order_operation` | 1 row / operation per order | AFVC + AFVV + AFKO | Supervisor, Operative |
| `recipe_process_line` | 1 row / recipe object key (OBJEK) | INOB + AUSP + CAWNT (central_services, class type 018) | (internal reference) |
| `pi_sheet_execution` | 1 row / PI sheet execution per operation | ZMANPEX_E04_002 | Supervisor, Operative |
| `goods_movement` | 1 row / material document line | MSEG + MKPF | Plant Manager, Supervisor |
| `batch_stock` | 1 row / batch × plant × storage location | MCHB | Supervisor, Operative |
| `warehouse_transfer_order` | 1 row / transfer order item | LTAK + LTAP | Supervisor, Operative |
| `warehouse_transfer_requirement` | 1 row / transfer requirement item | LTBK + LTBP | Supervisor |
| `storage_bin` | 1 row / bin occupancy slot; multiple quants in the same bin produce multiple rows | LAGP + LQUA (+ T320 from central_services for plant mapping) | Supervisor, Operative |
| `downtime_event` | 1 row / downtime event | ZPEXPM_DWNT | Plant Manager, Supervisor |
| `quality_inspection_lot` | 1 row / inspection lot | QALS + QMIH + QAMV | Plant Manager, Supervisor |
| `material` | 1 row / material × plant | MARA + MARC + MAKT | All |
| `storage_location` | 1 row / storage location | T001L | All |
| `work_centre` | 1 row / work centre × plant | CRHD + CRTX | All |
| `capacity_utilisation` | 1 row / capacity × period | KAPA + KAKO | Plant Manager |
| `movement_type_classification` | 1 row / SAP movement type | Conformed seed from `silver/movement_types.py` | All |

> **Enrichment notes:**
> - `process_order.production_line` (value) and `production_line_description` are derived via the SAP
>   **classification path** `AFKO → INOB → AUSP → CAWN/CAWNT`: the order's recipe/task-list (PLKO) is
>   classified under class type **018**; the process line is the characteristic value (AUSP-`ATWRT`)
>   with its text in `CAWNT-ATWTB`. The order links via the recipe key
>   `OBJEK = PLNTY + rpad(PLNNR,8) + lpad(PLNAL,2)`. A **deduped recipe-key → (value, description)**
>   map (one row per `OBJEK`) keeps the order grain fan-out-safe; no INOB/AUSP match → `NULL`
>   (never an error). **To confirm against live data:** the `018/PLKO` class is assumed to carry the
>   process-line characteristic — if it carries more than one, supply that characteristic's `ATINN`
>   to disambiguate; and CAWNT English text is read with `SPRAS = 'E'` (the SAP code; the spec's
>   `'EN'` is the language label).
> - `material.common_material_id` (+ `_raw`) carries the common/cross-system material code `MARA-BISMT`.
>   with its text in `CAWNT-ATWTB`. This `OBJEK → (value, description)` map is materialised once in the
>   **slow (triggered) tier** as `silver.recipe_process_line` (one row per `OBJEK`, fan-out-safe), so
>   the fast `process_order` stream reads a small pre-aggregated map (`recipe_process_line_table` conf)
>   instead of re-scanning the large `AUSP` every microbatch. `process_order`
>   links via the recipe key `OBJEK = PLNTY + rpad(PLNNR,8) + lpad(PLNAL,2)` — kept byte-identical to
>   the map key; no match → `NULL` (never an error). Verified live (uat): 99.6% of `AUTYP='40'` orders
>   resolve a non-NULL line; map ≈ 85k rows.
>   - **Read unconditionally + deploy order:** the fast pipeline is continuous, so `stg_process_order`
>     is built once at graph time. It therefore reads the map **without** a `tableExists` guard (a guard
>     would bake an empty fallback into the plan for the life of the update, silently NULL-ing every line
>     until restart). Consequence: the **slow pipeline must build `recipe_process_line` before the
>     continuous fast pipeline first starts** (DABs deploy both but cannot order their runs) — on first
>     deploy, run the slow pipeline once, then start fast. Steady-state map updates propagate to the
>     running fast pipeline per microbatch (stream-static join).
>   - **Freshness trade-off:** an order is enriched only when *that order* changes (SCD1), using the
>     last slow-run snapshot of the map. An order created against a recipe classified between two slow
>     runs gets `NULL` until it next changes. Recipes normally predate orders, so the window is narrow;
>     keep the slow cadence frequent enough to bound it.
>   - **To confirm against live data:** the `018/PLKO` class is assumed to carry the process-line
>     characteristic — if it carries more than one, set the `PROCESS_LINE_ATINN` helper constant to that
>     characteristic's `ATINN` to disambiguate; CAWNT English text is read with `SPRAS = 'E'` (the SAP
>     code; the spec's `'EN'` is the language label).
> - `material.old_material_number` (+ `_raw`) carries the legacy material number `MARA-BISMT`.

---

## Movement Semantics

`movement_type_classification` is generated from `silver/movement_types.py`, copied from the SupplyChainGraph movement taxonomy. It classifies SAP movement types into event families used by warehouse and production Gold tables:

- `GOODS_RECEIPT`
- `GOODS_ISSUE`
- `TRANSFER`
- `STOCK_WRITE_ON`
- `STOCK_WRITE_OFF`
- `INITIAL_ENTRY`
- `OTHER`

Reversal handling is based on the explicit `T156_REVERSAL_MAPPING` derived from labels containing `REVERSAL`; downstream warehouse volume KPIs should use event-family flags plus this reversal flag for reversal netting. Net stock movement KPIs should use `SHKZG` (`S` receipt/debit, `H` issue/credit) rather than applying both sign conventions.

Site-specific `Z*` movement types are carried from the source taxonomy but must be confirmed against this SAP configuration before they are treated as final. Storage type descriptions require T301T replication; until then warehouse KPIs should use storage type codes only.

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

### Storage Bin Row-Level Security
* **Current Status:** Filtered by the plant-level row filter using the derived `plant_code`. Occupied bins prefer the quant plant; empty bins derive plant from the warehouse-to-plant mapping. A warehouse mapped to **more than one plant** resolves an empty bin's `plant_code` to the sentinel `SHARED` (rather than guessing a single plant), so a single-plant access scope cannot silently see a shared bin.
* **Ingestion note:** `storage_bin` is built by `apply_changes_from_snapshot` (SCD type 1) over a full current-state snapshot, so it remains a **streaming table** and the external row filter persists exactly as for the `dlt.apply_changes` tables — see the catalogue note and `docs/data_contracts.md`.
* **Risk:** `SHARED`-tagged empty bins are not visible to any single-plant scope until a warehouse-level access model exists.
* **Mitigation:** Review shared-warehouse assignments with plant operations before granting broad direct access to `storage_bin`.

---

## Data Conventions Inherited from Bronze

| Convention | Detail |
|---|---|
| Key zero-padding | Stripped in silver: `REGEXP_REPLACE(col, '^0+', '')` |
| Date strings | `YYYYMMDD` → `DATE` via `TO_DATE(col, 'yyyyMMdd')` |
| Date+time pairs | Combined → `TIMESTAMP` via `TO_TIMESTAMP(CONCAT(date, LPAD(time,6,'0')), 'yyyyMMddHHmmss')` |
| Aecorsoft columns | `AEDATTM` → `_replicated_at`; `AERUNID` → `_run_id`; `AERECNO` → `_record_seq` |
| `RecordActivity` / `OPFLAG` | `'D'` = delete; used in `apply_as_deletes`. **`warehouse_transfer_requirement` deliberately uses `OPFLAG`** (SAP WM's native TR operation flag) instead of `RecordActivity` — see the note in `silver/tables/warehouse_fast.py`. |

> [!IMPORTANT]
> **Ordering assumption.** Every `apply_changes` uses `sequence_by = struct(_replicated_at, _run_id,
> _record_seq)` = (`AEDATTM`, `AERUNID`, `AERECNO`). This **assumes** the Aecorsoft run id and
> record sequence are monotonically increasing within and across replication runs, so the latest
> record per key wins deterministically (the run/seq are the tie-breaker for same-millisecond
> `AEDATTM`). If Aecorsoft ever replays out of order (e.g. a burst re-load of a high-frequency table
> such as `MCHB`), a superseded value could win. This assumption should be validated with a known
> out-of-order replay scenario before relying on it for high-churn tables.

> [!NOTE]
> **TODO:** Review Aecorsoft's capability to apply rules/transformations directly to fields at the replication layer (e.g. zero-stripping, date-casting). Performing these rules during replication could optimize ingestion and reduce downstream compute/storage costs (eliminating the hidden cost of executing Spark-based string manipulations and casts on every ingestion run).

---

## What belongs in Gold (not Silver)

- Shift-level aggregations (shift boundaries vary per plant)
- Production quality & downtime summaries
- On-time-in-full metrics
- Cross-plant comparisons and rankings
- Period-over-period trending
