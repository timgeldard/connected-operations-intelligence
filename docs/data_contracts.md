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

Warehouse Gold flow KPIs use `silver.movement_type_classification` for event-family semantics. Receipt/issue volume KPIs should net reversals using `is_reversal`; net stock movement KPIs should use `SHKZG` direction from `silver.goods_movement` and must not also apply reversal netting.

### 1. `gold.gold_shift_output_summary`
* **Grain**: 1 row per plant × posting date × material × base UOM
* **Source Silver Tables**: `silver.goods_movement` + `silver.movement_type_classification`
* **Name Caveat**: Historical table name retained; this is a daily output aggregate and has no shift dimension.
* **Aggregation Logic**:
  * Inner join on `movement_type_code`.
  * `produced_quantity` = sum of quantities where `is_production_receipt = True` minus `is_receipt_reversal = True`.
  * `scrap_quantity` = sum of quantities where `is_scrap = True` minus `is_scrap_reversal = True`.
* **Row-Level Security**: Gold is produced by a trusted aggregate pipeline. Apply plant-level controls at the consumption boundary.
* **Freshness Expectation**: Triggered pipeline execution (bundled job schedule: three times daily).
* **Known Caveats**: Relies on conformed classifications mapped in `movement_type_classification`. Any newly introduced custom movement codes must be classified first.
* **Freshness Caveat**: Depends on the continuous `silver_fast_pipeline`; the Gold refresh job does not trigger that pipeline.

### 2. `gold.gold_order_otif_metrics`
* **Grain**: 1 row per completed process order
* **Source Silver Tables**: `silver.process_order`
* **Schedule-Adherence Logic**:
  * `is_on_time` = 1 if `actual_finish_date <= scheduled_finish_date`, else 0.
  * `is_in_full` = 1 if `confirmed_yield_quantity >= order_quantity`, else 0.
* **Name Caveat**: This is process-order schedule adherence, not customer-delivery OTIF.
* **Row-Level Security**: Gold is produced by a trusted aggregate pipeline. Apply plant-level controls at the consumption boundary.
* **Freshness Expectation**: Batch triggered.
* **Freshness Caveat**: Depends on the continuous `silver_fast_pipeline`; the Gold refresh job does not trigger that pipeline.

### 3. `gold.gold_plant_production_quality_summary`
* **Grain**: 1 row per plant across all available history
* **Source Silver Tables**: `silver.process_order` + `silver.downtime_event`
* **Window Caveat**: Current totals and quality rate are all-time aggregates. Add a fiscal/posting-period grain before using this table for trend or period comparison.

### 4. `gold.gold_transfer_order_performance`
* **Grain**: 1 row per warehouse × plant × confirmed user × confirmed date × source storage type
* **Source Silver Tables**: `silver.warehouse_transfer_order`
* **Aggregation Logic**:
  * `confirmed_by_user` is coalesced to `UNKNOWN` when the source operator field is missing.
  * `pick_accuracy` = picked quantity / confirmed quantity, left null when confirmed quantity is zero.
  * `fully_confirmed_rate` = average of transfer-order items with `item_status = 'Fully Confirmed'`.
  * `avg_confirmation_cycle_hours` is derived from start/end timestamps when both are populated.
* **Freshness Expectation**: Batch triggered.

### 5. `gold.gold_inbound_outbound_throughput`
* **Grain**: 1 row per plant × storage location × posting date × movement event category
* **Source Silver Tables**: `silver.goods_movement` + `silver.movement_type_classification`
* **Aggregation Logic**:
  * Joins movement rows to the conformed classification table on `movement_type_code`.
  * Reversal movement types are netted with a negative sign inside the same event family.
  * `net_qty` = inbound quantity - outbound quantity. Transfers and inventory adjustments are reported separately and excluded from `net_qty`.
* **Freshness Expectation**: Batch triggered.

### Deliberate Descope
* Loftware compliance and label-template attributes are excluded from the reporting contracts because they are not used by the current Gold outputs.
