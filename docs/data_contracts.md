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
  * `fully_confirmed_rate` excludes open items, counting fully confirmed items as 1.0 and partially confirmed items as 0.0.
  * `avg_confirmation_cycle_hours` is derived from start/end timestamps when both are populated and is floored at zero.
  * `avg_processing_time` is normalized to minutes before averaging.
* **Freshness Expectation**: Batch triggered.

### 5. `gold.gold_inbound_outbound_throughput`
* **Grain**: 1 row per plant × storage location × posting date
* **Source Silver Tables**: `silver.goods_movement` + `silver.movement_type_classification`
* **Aggregation Logic**:
  * Joins movement rows to the conformed classification table on `movement_type_code`.
  * Reversal movement types are netted with a negative sign inside the same event family.
  * `net_qty` = inbound quantity - outbound quantity on the consolidated daily row. Transfers and inventory adjustments are reported separately and excluded from `net_qty`.
* **Freshness Expectation**: Batch triggered.

### 6. `gold.gold_bin_occupancy`
* **Grain**: 1 row per warehouse × plant × storage type × bin type
* **Source Silver Tables**: `silver.storage_bin`
* **Aggregation Logic**:
  * Quant-level `storage_bin` rows are first rolled up to the physical bin grain (`warehouse_number`, `storage_type`, `bin_code`).
  * Occupied bins are physical bins with at least one non-null `quant_number`.
  * Empty, blocked, stock-removal-blocked, and putaway-blocked physical-bin counts are reported separately.
  * Stock quantities are summed from the current bin/quant state.
* **Freshness Expectation**: Batch triggered.

### 7. `gold.gold_stock_availability`
* **Grain**: 1 row per plant × storage location × material × batch × base UOM
* **Source Silver Tables**: `silver.batch_stock`
* **Aggregation Logic**:
  * `available_qty` follows unrestricted stock.
  * `unavailable_qty` combines quality inspection, blocked, restricted-use, and blocked-return quantities.
  * `total_stock_qty` includes unrestricted, unavailable, and in-transfer stock.
* **Freshness Expectation**: Batch triggered.

### 8. `gold.gold_transfer_requirement_backlog`
* **Grain**: 1 row per warehouse × plant × source/destination storage type × queue × transfer priority
* **Source Silver Tables**: `silver.warehouse_transfer_requirement`
* **Aggregation Logic**:
  * Includes only items where processing is not complete and open quantity is greater than zero.
  * Reports backlog item count, open quantity, required quantity, open-quantity rate, and oldest created/planned timestamps.
* **Freshness Expectation**: Batch triggered.
* **Snapshot Caveat**: Daily append snapshots are intentionally not part of this contract until retention and scheduling requirements are agreed.

### Deliberate Descope
* Loftware compliance and label-template attributes are excluded from the reporting contracts because they are not used by the current Gold outputs.
