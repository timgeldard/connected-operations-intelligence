# Data Contracts Specification

This document defines the formal data contracts for the key Silver and Gold layer reporting tables.

---

## Silver Layer conformed Tables

### 1. `silver.process_order`
* **Grain**: 1 row per process order (`order_number`)
* **Natural Key**: `order_number`
* **Source SAP Tables**: `AFKO` (Header) + `AUFK` (Master)
* **Join Conditions**: `AFKO.AUFNR == AUFK.AUFNR AND AFKO.MANDT == AUFK.MANDT`
* **Delete Handling**: CDC tracking via Aecorsoft `RecordActivity`. Deletes are applied directly as hard deletes (`apply_as_deletes`).
* **Sequence / Watermark Column**: `_replicated_at` (derived from `AEDATTM`)
* **Row-Level Security**: Plant-level filter (`plant_access_filter`) applied to the `plant_code` column.
* **Freshness Expectation**: Continuous execution (near real-time, within 15-minute latency).

### 2. `silver.goods_movement`
* **Grain**: 1 row per goods movement document item (`material_document_number` + `material_document_year` + `material_document_item`)
* **Natural Key**: `material_document_number`, `material_document_year`, `material_document_item`
* **Source SAP Tables**: `MSEG`
* **Delete Handling**: Hard deletes tracked via Aecorsoft `RecordActivity`.
* **Sequence / Watermark Column**: `_replicated_at`
* **Row-Level Security**: Enforced via `plant_code`.
* **Freshness Expectation**: Near real-time (continuous streaming).

### 3. `silver.storage_bin`
* **Grain**: 1 row per physical storage bin (`warehouse_number` + `storage_type` + `bin_code`)
* **Natural Key**: `warehouse_number`, `storage_type`, `bin_code`
* **Source SAP Tables**: `LAGP` (Bin Master) + `LQUA` (Quants / Occupancy) + `T320` (Warehouse plant mapping)
* **Join Conditions**:
  * `LAGP` left joined with `LQUA` on `LGNUM`, `LGTYP`, `LGPLA`, and `MANDT`.
  * Joined with `T320` aggregated by `warehouse_number` to resolve primary plant.
* **Delete Handling**: SCD Type 1 tracking. Bins with no active stock (quant) retain bin dimensions but show `NULL` for material/quant fields.
* **Sequence / Watermark Column**: `_replicated_at`
* **Row-Level Security**: Filtered by primary `plant_code` (resolved dynamically).
* **Freshness Expectation**: Daily batch (triggered) or hourly updates.

---

## Gold Layer Aggregates & KPIs

### 1. `gold.gold_shift_output_summary`
* **Grain**: 1 row per plant × posting date × material × base UOM
* **Source Silver Tables**: `silver.goods_movement` + `silver.movement_type_classification`
* **Aggregation Logic**:
  * Inner join on `movement_type_code`.
  * `produced_quantity` = sum of quantities where `is_production_receipt = True` minus `is_receipt_reversal = True`.
  * `scrap_quantity` = sum of quantities where `is_scrap = True` minus `is_scrap_reversal = True`.
* **Row-Level Security**: Enforced on `plant_code` (inherited from the Silver plant row filter).
* **Freshness Expectation**: Triggered pipeline execution (runs 3 times daily or on shift completion).
* **Known Caveats**: Relies on conformed classifications mapped in `movement_type_classification`. Any newly introduced custom movement codes must be classified first.

### 2. `gold.gold_order_otif_metrics`
* **Grain**: 1 row per completed process order
* **Source Silver Tables**: `silver.process_order`
* **OTIF Logic**:
  * `is_on_time` = 1 if `actual_finish_date <= scheduled_finish_date`, else 0.
  * `is_in_full` = 1 if `confirmed_yield_quantity >= order_quantity`, else 0.
* **Row-Level Security**: Filtered by `plant_code`.
* **Freshness Expectation**: Batch triggered.
