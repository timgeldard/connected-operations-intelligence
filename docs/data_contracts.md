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
* **Known Caveats**: Due to the stream-static join for recipe enrichment, the `production_line` field reflects the recipe classification at the time the process order last changed (not necessarily today's classification if the recipe is reclassified later for a closed/unchanged order).

### 2. `silver.goods_movement`
* **Grain**: 1 row per goods movement document item (`material_document_number` + `material_document_year` + `material_document_item`)
* **Natural Key**: `material_document_number`, `material_document_year`, `material_document_item`
* **Source SAP Tables**: `MSEG`
* **Delete Handling**: Hard deletes tracked via Aecorsoft `RecordActivity`.
* **Sequence / Watermark Column**: `_replicated_at`
* **Row-Level Security**: Enforced via `plant_code`.
* **Freshness Expectation**: Near real-time (continuous streaming).

### 3. `silver.storage_bin`
* **Grain**: 1 row per occupancy slot — a physical bin plus its occupancy key (`warehouse_number` + `storage_type` + `bin_code` + `_storage_bin_occupancy_key`). An occupied bin yields one row per quant (`LQNUM`); an empty bin yields a single `__EMPTY__` row.
* **Natural Key**: `warehouse_number`, `storage_type`, `bin_code`, `_storage_bin_occupancy_key`
* **Source SAP Tables**: `LAGP` (Bin Master, append-only Aecorsoft CDC) + `LQUA` (Quants / Occupancy, current-state snapshot maintained upstream by MERGE/DELETE) + `T320` (Warehouse plant mapping, sourced from the published/`central_services` catalog as a view — not replicated into the SAP source)
* **Join Conditions**:
  * `LAGP` reduced to current bin master (latest row per bin by `AEDATTM`/`AERUNID`/`AERECNO`, tombstones `RecordActivity='D'` dropped), then left joined with `LQUA` on `LGNUM`, `LGTYP`, `LGPLA`, and `MANDT`.
  * Joined with `T320` aggregated by `warehouse_number` (warehouses mapped to >1 plant resolve to `SHARED`).
* **Delete Handling**: `apply_changes_from_snapshot` (SCD type 1) over the full current-state snapshot `stg_storage_bin`, on the diff key `warehouse_number` + `storage_type` + `bin_code` + `_storage_bin_occupancy_key` (`LQNUM`, or `__EMPTY__` for an unoccupied bin). `storage_bin` stays a **streaming table** so the external UC row filter persists like every other silver table. Because `LQUA` carries no delete marker, vacated quants and emptied bins age out via key-absence in the snapshot diff (the snapshot emits the bin as an `__EMPTY__` row and the prior occupied row's key is absent → deleted). Deleted bins are removed via the `LAGP` `RecordActivity='D'` tombstone filter before the snapshot.
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
* **Known Caveats**: Relies on conformed classifications mapped in `movement_type_classification`. T156-only movement codes are retained as `OTHER` with false KPI flags; any newly introduced custom movement code must be functionally classified before it contributes to output or throughput measures.
* **Freshness Caveat**: Depends on the continuous `silver_fast_pipeline`; the Gold refresh job does not trigger that pipeline.

### 2. `gold.gold_process_order_schedule_adherence`
* **Grain**: 1 row per completed process order
* **Source Silver Tables**: `silver.process_order`
* **Schedule-Adherence Logic**:
  * `is_on_time` = 1 if `actual_finish_date <= scheduled_finish_date`, else 0.
  * `is_started_on_time` = 1 if `actual_start_date <= scheduled_start_date`, else 0.
  * `is_in_full` = 1 if `confirmed_yield_quantity >= order_quantity`, else 0.
  * `fill_rate` = ratio of `confirmed_yield_quantity / order_quantity`.
  * `scrap_rate` = ratio of `total_scrap_quantity / order_quantity`.
* **Note**: Measures process-order schedule adherence, starting adherence, yield-to-order fill rate, scrap rate, and production line details per completed/closed order. Unrelated to customer-delivery OTIF.
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

### 9. `gold.gold_stock_expiry_risk`
* **Status**: Pilot-grade
* **Grain**: 1 row per plant × material × batch × base UOM
* **Source Silver Tables**: `silver.storage_bin` + `silver.material`
* **Aggregation Logic**:
  * Includes current bin/quant stock where material, batch, and expiry date are present.
  * Buckets quantities into expired, <7 days, 7-30 days, 30-90 days, and OK based on `expiry_date` vs current date.
  * Flags minimum shelf-life breaches using `minimum_remaining_shelf_life_days` from material master.
* **Date-relative columns served live**: the MV is deterministic (absolute dates only) so it stays incrementally refreshable; the expiry **bucket/flag columns** (`minimum_days_to_expiry`, `expired_qty`, `expiry_risk_*`, `minimum_shelf_life_breach_qty`, `highest_expiry_risk_bucket`, `has_minimum_shelf_life_breach`) are computed at query time by the **`gold_stock_expiry_risk_live`** serving view (`scripts/generate_gold_serving_views_sql.py`). Consumers needing risk buckets read the `_live` view.
* **Freshness Expectation**: Batch triggered.

### 10. `gold.gold_data_freshness_status`
* **Status**: Production
* **Grain**: 1 row per monitored Silver dependency
* **Source Silver Tables**: monitored dependencies listed in `gold.freshness.FRESHNESS_CONTRACTS`
* **Purpose**: reports dependency freshness status (`FRESH`, `STALE`, `NO_DATA`, `STATIC`) with latest `_replicated_at`, lag minutes, SLA, domain, and criticality.
* **SLA Constraint**: `gold_critical_freshness_gate` fails the Gold pipeline when any critical dependency is `STALE` or `NO_DATA`.
* **Known Caveats**: DLT expectation metrics are stored in the pipeline event log, not in this table.

### 10a. `gold.gold_data_health_summary`
* **Status**: Production
* **Grain**: 1 row per health area (`freshness`, `expectations`, `storage_type_role_coverage`, `process_order_staging_validation`, `stock_reconciliation`)
* **Source Tables**: `gold_data_freshness_status`, `gold_storage_type_role_coverage_status`, `gold_process_order_staging_validation`, `gold_stock_reconciliation_summary_v2`, plus the DLT event log for expectation details.
* **Purpose**: concise operations scorecard of critical/warning issue counts and latest observed timestamps for Gold data-product health.
* **Known Caveats**: the `expectations` row points to the pipeline event log because expectation violations are not persisted as a Gold table.

### 11. `gold.gold_dispensary_backlog`
* **Status**: Production-candidate
* **Grain**: 1 row per plant × production supply area × warehouse
* **Source Silver Tables**: `silver.reservation_requirement` (+ `silver.process_order` for scheduled start)
* **Purpose**: open line-pick (dispensary) backlog — RESB movement `261`, not deletion-flagged, open qty > 0.
* **Freshness Expectation**: Batch triggered.

### 12. `gold.gold_lineside_stock`
* **Status**: Pilot-grade
* **Grain**: 1 row per plant × warehouse × storage type × material × batch × base UOM
* **Source Silver Tables**: `silver.storage_bin` + `silver.storage_type_role_mapping`
* **Purpose**: current stock staged in production / line-side storage types (roles resolved from the role-mapping config, with a standard 9xx fallback).
* **Known Caveats**: depends on `storage_type_role_mapping` coverage. The MV is deterministic; `min_days_to_expiry` is served at query time by the **`gold_lineside_stock_live`** view.

### 13. `gold.gold_delivery_pick_status`
* **Status**: Pilot-grade
* **Grain**: 1 row per outbound delivery (× plant × warehouse)
* **Source Silver Tables**: `silver.outbound_delivery`
* **Purpose**: pick progress using base-UoM delivery and picked quantities, plus pick risk.
* **Known Caveats**: delivery-quantity based, not TO-level picking. `pick_fraction` is null when a delivery mixes base UoMs because the delivery-level quantity ratio would be invalid. The MV is deterministic; `days_to_goods_issue` and `risk_band` are served at query time by the **`gold_delivery_pick_status_live`** view. Also, a known orphan risk exists: header-only deletes (null item number) cannot be matched by the compound keys, leaving orphaned delivery items in silver.outbound_delivery. Additionally, the `is_shipped` flag is derived as a heuristic (`MAX(actual_goods_issue_date IS NOT NULL)`), meaning a delivery is flagged as shipped if any line has a goods-issue date, which assumes no partial/split goods issue postings occur.

### 14. `gold.gold_stock_reconciliation`
* **Status**: Pilot-grade / directional (kept for compatibility; superseded by v2 for root-cause investigation)
* **Grain**: 1 row per plant × material
* **Source Silver Tables**: `silver.stock_at_location` (MARD), `silver.storage_bin` (WM), `silver.material_valuation` (MBEW), `silver.storage_type_role_mapping`
* **Purpose**: IM book stock vs WM bin stock variance, valuation, ABC class, and interim/physical WM split.
* **Columns**: includes `is_operationally_trusted` — `true` when all occupied bins for the plant have CONFIG-sourced roles (no 9xx fallback). Check `gold_storage_type_role_coverage_status` for per-warehouse mapping gaps.
* **Known Caveats**: coarse (plant × material) grain; no storage-location/batch/UoM normalisation; tolerance `max(0.1, 1% IM)`; treat as a directional indicator. `inventory_value` is not Material-Ledger-reconciled.

### 14b. `gold.gold_stock_reconciliation_v2`
* **Status**: Production-candidate
* **Grain**: 1 row per plant × warehouse × material × batch × stock_category × base_uom
* **Source Silver Tables**: `silver.batch_stock` (MCHB), `silver.stock_at_location` (MARD), `silver.material`, `silver.storage_bin`, `silver.warehouse_storage_location_mapping`, `silver.material_uom_conversion`, `silver.material_valuation`, `silver.storage_type_role_mapping`
* **Purpose**: Root-cause-capable IM↔WM reconciliation. MCHB for batch-managed materials; MARD for non-batch. T320 bridges IM sloc→warehouse. BESTQ (blank/Q/S) mapped to UNRESTRICTED/QUALITY/BLOCKED.
* **Mismatch reasons**: `MATCHED`, `WM_MANAGED_SLOC_MAPPING_MISSING`, `UOM_CONVERSION_MISSING`, `BATCH_MISSING_IN_WM`, `BATCH_MISSING_IN_IM`, `TRUE_VARIANCE`
* **Known Caveats**: WM (LQUA) has no LGORT — grain omits `storage_location_code` on WM side. IN_TRANSFER and RESTRICTED stock categories not compared. Tolerance 0.1% of IM, floor 0.001. See `docs/reconciliation/stock-reconciliation-v2-contract.md`. Note: storage locations without a T320 warehouse mapping receive `warehouse_number = '__NO_WM_MAPPING__'`. If a material exists in both a mapped and an unmapped storage location, it produces two separate rows in the output. Downstream BI consumers summing `abs_delta_quantity_total` must explicitly filter or group by `mismatch_reason` to avoid double-counting the unmapped locations alongside true variances.

### 14c. `gold.gold_stock_reconciliation_exceptions_v2`
* **Status**: Production-candidate
* **Grain**: Same as v2, filtered to `is_reconciled = false`, enriched with material description
* **Purpose**: Starting point for variance investigation.

### 14d. `gold.gold_stock_reconciliation_summary_v2`
* **Status**: Production-candidate
* **Grain**: 1 row per plant × warehouse × mismatch_reason × mismatch_severity
* **Purpose**: Operational scorecard of unreconciled stock by reason and severity.

### 14e. `gold.gold_stock_reconciliation_summary`
* **Status**: Production-candidate
* **Grain**: 1 row per plant × warehouse × mismatch_reason × mismatch_severity
* **Source Gold Tables**: `gold_stock_reconciliation_summary_v2`
* **Purpose**: canonical consumption-facing summary of IM↔WM reconciliation with `reconciliation_status` (`RECONCILED`, `REVIEW`, `ACTION_REQUIRED`).

### 14a. `gold.gold_storage_type_role_coverage_status`
* **Status**: Production
* **Grain**: 1 row per plant × warehouse
* **Source Silver Tables**: `silver.storage_bin` + `silver.storage_type_role_mapping`
* **Purpose**: per-warehouse evidence of storage-type role mapping coverage; refreshed on every Gold pipeline run.
* **Columns**: `plant_code`, `warehouse_number`, `total_storage_types`, `mapped_storage_types`, `unmapped_storage_types`, `coverage_pct`, `coverage_status`
* **Status values**: `VALIDATED` (all in-use STs config-mapped), `PARTIAL` (some mapped, some not), `MISSING` (no config rows for this warehouse).

### 15. `gold.gold_process_order_staging`
* **Status**: Pilot-grade (assumption validated — see `gold_process_order_staging_validation`)
* **Grain**: 1 row per process order
* **Source Silver Tables**: `silver.warehouse_transfer_order` + `silver.process_order`
* **Purpose**: component staging completion (confirmed staging TOs vs total) and start risk.
* **Known Caveats**: Scoped to LTAK BETYP='F' TOs; BENUM↔AUFNR match validated at 100% across all UAT warehouses (2026-06-02). Plants with no BETYP='F' TOs show `to_items_total=0` and `staging_fraction=NULL` (classified NOT_APPLICABLE in the validation table). The MV is deterministic; `days_to_start` and `risk_band` are served at query time by the **`gold_process_order_staging_live`** view.

### 15a. `gold.gold_process_order_staging_validation`
* **Status**: Production
* **Grain**: 1 row per plant × warehouse
* **Source Silver Tables**: `silver.warehouse_transfer_order` + `silver.process_order`
* **Purpose**: per-plant/warehouse evidence that the BETYP='F' + BENUM→AUFNR assumption holds; refreshed on every Gold pipeline run.
* **Columns**: `plant_code`, `warehouse_number`, `sample_window_start`, `sample_window_end`, `total_to_headers`, `f_type_to_headers`, `f_type_benum_matched`, `benum_match_pct`, `validation_status`
* **Status values**: `VALIDATED` (≥95% BENUM match), `NOT_VALIDATED` (F-type TOs present but low match), `NOT_APPLICABLE` (no F-type TOs for this plant/warehouse).

### 16. `gold.gold_inbound_po_backlog`
* **Status**: Directional only
* **Grain**: 1 row per plant × vendor × purchasing org
* **Source Silver Tables**: `silver.purchase_order` (EKKO/EKPO, from `central_services`)
* **Purpose**: open inbound PO backlog (items not delivery-complete).
* **Known Caveats**: this is **PO backlog, not goods-receipt status** — no GR history (EKBE/MSEG 101), inbound delivery/ASN, or remaining-quantity. A true receipt model is designed separately (Phase 9).

### 16a. `gold.gold_inbound_po_backlog_enhanced`
* **Status**: Production-candidate
* **Grain**: 1 row per plant × vendor × purchasing org
* **Source Silver Tables**: `silver.purchase_order`, `silver.goods_movement`, `silver.movement_type_classification`, `silver.warehouse_transfer_order`
* **Purpose**: open inbound PO backlog enriched with PO-linked 103/104 goods-receipt quantity, remaining open quantity, QA item count, and putaway TO evidence.
* **Aging**: base MV carries deterministic age anchors (`earliest_po_date`, `latest_gr_posting_date`, `oldest_putaway_to_created_datetime`); date-relative `oldest_po_age_days` and `inbound_backlog_risk_band` are served by `gold_inbound_po_backlog_enhanced_live`.
* **Known Caveats**: GR linkage requires `silver.goods_movement.purchase_order_number` and `purchase_order_item`. Putaway TO linkage is best-effort via `warehouse_transfer_order.source_reference_number = purchase_order_number` because LTAP/LTAK do not provide a normalized PO item key in the current Silver model.

### 17. `gold.gold_handling_unit_summary`
* **Status**: Pilot-grade
* **Grain**: 1 row per plant × warehouse × HU status × reference-document category
* **Source Silver Tables**: `silver.handling_unit` (VEKP/VEPO, from `central_services`)
* **Purpose**: handling-unit / SSCC counts and gross weight (gross weight aggregated at HU-header grain).
* **Known Caveats**: SSCC is **approximated** from VEKP `EXIDV`; WMA-E-50 execution detail (pre-generated SSCC, pallet-ID, TR-split) is not replicated (ADR 007 / ingestion requests).

### 18. `gold.gold_warehouse_exceptions`
* **Status**: Pilot-grade
* **Grain**: 1 row per exception instance (uniform-schema UNION of integrity/aging checks)
* **Source Silver Tables**: stock/bin/TO/TR/reconciliation inputs (multi-source)
* **Purpose**: negative stock, expired-with-stock, aged QI/blocked, aged open TOs, IM/WM variance — with severity (1–4) and SLA hours.
* **Known Caveats**: severity/SLA thresholds need business validation; the IM/WM-variance branch inherits the coarse reconciliation grain.

### 19. `gold.gold_warehouse_kpi_snapshot`
* **Status**: Pilot-grade
* **Grain**: 1 row per plant
* **Source/Gold Tables**: per-plant rollup of open orders/TRs/TOs/deliveries/inbound + bin counts
* **Purpose**: per-plant operations scorecard.
* **Known Caveats**: mixed-grain counts assembled into one scorecard row; intended for at-a-glance status, not as a reconciled measure source.

### 20. `gold.gold_process_order_operations`
* **Status**: Production-candidate
* **Grain**: 1 row per `order_number × operation_number`
* **Source Silver Tables**: `silver.process_order_operation`, `silver.pi_sheet_execution`, `silver.downtime_event`, `silver.process_order`
* **Purpose**: Operations Overview of process orders, schedule compliance, actual start/finish dates, confirm status, PI sheet execution and downtime at the operation level.
* **Known Caveats**: `is_confirmed` is based on confirmation number presence since execution quantities are order-scoped; scoped to active/released orders only.

### 21. `gold.gold_order_downtime_summary`
* **Status**: Production-candidate
* **Grain**: 1 row per `order_number × operation_number × downtime_reason_code`
* **Source Silver Tables**: `silver.downtime_event`, `silver.process_order`
* **Purpose**: Downtime events rolled to order, operation, and reason grain, with order and material context.
* **Known Caveats**: No scope filter is applied (active or closed orders are both covered to preserve historical analysis).

### 22. `gold.gold_process_order_component_status`
* **Status**: Production-candidate
* **Grain**: 1 row per `order_number × reservation_item_number`
* **Source Silver Tables**: `silver.reservation_requirement` (RESB), `silver.movement_type_classification`, `silver.process_order`, `silver.batch_stock`
* **Purpose**: Per-component consumption reservation status for active orders with available unrestricted stock in the reservation storage location and a stock coverage check.
* **Known Caveats**: Stock availability checks are storage-location aware but not batch-aware; reservation components are restricted by `movement_type_classification.is_production_consumption` (currently BWART `261`).

---

## Semantic / Consumption Layer

### S1. `semantic.semantic_plant_operations_kpi`
* **Type**: SQL view
* **Grain**: 1 row per plant
* **Source Gold Views**: `gold_process_order_schedule_adherence_secured`, `gold_plant_production_quality_summary_secured`, `gold_process_order_component_status_secured`
* **Purpose**: plant operations KPI rollup for completed orders, on-time/in-full counts, quality, downtime, and component coverage.

### S2. `semantic.semantic_warehouse_performance`
* **Type**: SQL view
* **Grain**: 1 row per plant × warehouse, with plant-level inbound measures repeated across warehouse rows when applicable
* **Source Gold Views**: `gold_transfer_order_performance_secured`, `gold_transfer_requirement_backlog_secured`, `gold_inbound_po_backlog_enhanced_live`
* **Purpose**: warehouse execution scorecard combining TO performance, TR backlog, and inbound PO backlog aging.

### S3. `semantic.semantic_stock_health`
* **Type**: SQL view
* **Grain**: 1 row per plant
* **Source Gold Views**: `gold_stock_availability_secured`, `gold_stock_expiry_risk_live`, `gold_stock_reconciliation_summary_secured`
* **Purpose**: stock health rollup across availability, expiry exposure, and reconciliation exceptions.

---

## Data Conventions & Security

### Raw and Display Key Pairs
To preserve SAP traceability and reconciliation audits while providing clean dashboards, key columns keep both:
* **Raw Column (`_raw`):** Preserves original SAP format with leading zeros intact (used for joins, debugging, and DB validation).
* **Display Column:** Conformed zero-stripped values for human-readable reports and BI dashboards.

### Access Tiers
* Plant-scoped operative and supervisor reads are governed through Silver `plant_access_filter` (automatically handles `SHARED` empty bins for shared warehouses, and trims spaces from user attribute lists).
* Cluster-lead cross-plant access is documented in ADR-005 but intentionally blocked until a governed plant-to-cluster source is approved.

### Deliberate Descope
* Loftware compliance and label-template attributes are excluded from the reporting contracts because they are not used by the current Gold outputs.
