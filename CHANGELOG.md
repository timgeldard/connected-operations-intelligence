# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- Renamed `gold_order_otif_metrics` → `gold_process_order_schedule_adherence`. "OTIF" is a supply-chain term for customer-delivery On-Time-In-Full; the table measures process-order schedule adherence (actual vs scheduled finish date, confirmed vs ordered quantity) and would be misread by supply-chain stakeholders. All references updated across code, tests, docs, and generated SQL.

### Added
- `gold_stock_reconciliation_v2` — production-candidate IM↔WM reconciliation at plant × warehouse × material × batch × stock_category grain. MCHB (batch-managed) + MARD (non-batch) on IM side; LQUA/storage_bin on WM side; T320 sloc→warehouse bridge; 6-key full outer join; mismatch reasons (MATCHED/WM_MANAGED_SLOC_MAPPING_MISSING/UOM_CONVERSION_MISSING/BATCH_MISSING_IN_WM/BATCH_MISSING_IN_IM/TRUE_VARIANCE). Source validations (2026-06-02): MARD=SUM(MCHB) confirmed 750/750 at C061; T320 is 1:1 for (plant,sloc)→warehouse (996 combos, 0 with multiple warehouses); MARM confirmed ingested (materialconversion_marm, 1.57M rows).
- `gold_stock_reconciliation_exceptions_v2` — non-reconciled rows from v2 with material description. Starting point for variance investigation.
- `gold_stock_reconciliation_summary_v2` — v2 rolled up by plant × warehouse × mismatch_reason × mismatch_severity.
- `silver.material_uom_conversion` — MARM alternate-unit conversion factors (1 row per material × alt UoM). Wired into slow pipeline.
- `silver.warehouse_storage_location_mapping` — T320 sloc→warehouse bridge (from published/central_services). Wired into slow pipeline.
- `docs/reconciliation/current-state-assessment.md` — Phase 0 assessment of v1 limitations and source profiling results.
- `docs/reconciliation/stock-reconciliation-v2-contract.md` — v2 formal data contract including grain rationale, source routing, mismatch reason taxonomy, and known gaps.
- `gold_storage_type_role_coverage_status` — Gold table (plant × warehouse grain) classifying each warehouse as `VALIDATED`, `PARTIAL`, or `MISSING` based on whether in-use storage types are config-mapped. Refreshed every Gold run. Live UAT profiling (2026-06-02): 140 warehouses / 3,464 ST combos. Full draft seed added (see below).
- `resources/config/storage_type_role_mapping.csv` extended with 2,026 draft rows (`review_status=PENDING`) inferred from T301T descriptions across all 153 warehouses: 364 LINESIDE (Production Supply/Dispensary/Palletising), 1,662 INTERIM (GR/GI/Shipping/Stock-Transfer areas). Existing 11 APPROVED rows (C061/208) unchanged. Requires WM config owner sign-off before promotion to APPROVED.
- `is_operationally_trusted` column in `gold_stock_reconciliation` — `true` when all occupied bins for the plant have CONFIG-sourced roles (no 9xx fallback). `false` if any ST uses the FALLBACK heuristic, flagging that the interim/physical split may be inaccurate.
- `gold_process_order_staging_validation` — Gold table (plant × warehouse grain) that classifies each plant/warehouse as `VALIDATED`, `NOT_VALIDATED`, or `NOT_APPLICABLE` based on whether LTAK BETYP='F' TOs have BENUM values that resolve to known process orders. Refreshed on every Gold pipeline run. Live UAT validation (2026-06-02): 100% BENUM↔AUFNR match across all warehouses with F-type staging TOs.
- `is_operationally_trusted` column in `gold_process_order_staging` — `true` when the plant has a validated entry in `process_order_staging_reference_mapping_config`; `false` for absent/unvalidated plants. Plants absent from the config default to untrusted.
- `process_order_staging_reference_mapping_config` seed SQL (`resources/sql/process_order_staging_reference_mapping_*.sql`) — all 105 UAT-validated warehouse/plant combos seeded as `BENUM_EQUALS_AUFNR` with `is_validated=true`.
- `STAGING_REFERENCE_TYPE = "F"` constant in `gold/_shared.py` — single source of truth for the LTAK-BETYP process-order staging reference type.
- `risk_band = 'unvalidated'` for operationally untrusted plants in `gold_process_order_staging_live` serving view.

### Fixed
- Corrected `docs/runbook.md` §7: process-order scope is AUFK `AUTYP = '40'` (not `'10'`). `AUTYP = '10'` returns zero rows in Kerry's SAP configuration; the implementation (`silver/helpers.PP_PI_ORDER_CATEGORY = "40"`) was already correct. Added test guard to prevent future doc/code drift.
- Updated BR-WM-002 status from Unverified to UAT validated following live BETYP/BENUM profiling.
- Updated A4 user-story fulfilment from ⚠️ Partial to ✅ Fully following staging assumption validation.

### Changed
- Split `silver/tables/warehouse.py` into two tier-specific modules to eliminate overlapping table ownership between the Fast and Reference pipelines:
  - `warehouse_fast.py` — `goods_movement`, `batch_stock`, `warehouse_transfer_order`, `warehouse_transfer_requirement` (all streaming sources; owned by the continuous Fast pipeline)
  - `warehouse_reference.py` — `warehouse_plant_mapping`, `warehouse_plant_mapping_validation`, `storage_bin` (owned by the triggered Reference/Slow pipeline)
- `storage_bin` is placed in the Reference tier because it depends on `warehouse_plant_mapping` via `dlt.read()` (an intra-pipeline reference), and because its quant occupancy source (`LQUA`) is already a batch read — meaning occupancy freshness is a periodic snapshot regardless of tier.
- Updated `dlt_silver_fast.py` to import `warehouse_fast`; `dlt_silver_slow.py` to import `warehouse_reference`.
- Removed the now-redundant `silver/tables/warehouse.py`.

## [0.3.0] - 2026-05-31

### Added
- Created `silver/tables/` domain-specific modular directory structure.
- Grouped expectations using `@dlt.expect_all` and `@dlt.expect_all_or_drop` for improved pipeline maintainability.
- Consolidated unit tests to import directly from domain-specific modules.
- Added a paused Databricks job resource to refresh triggered Silver domains before Gold on an explicit schedule.
- Added conformed SAP movement-type taxonomy for warehouse KPI event-family classification.
- Added Gold warehouse flow KPIs for transfer-order performance and inbound/outbound throughput.
- Added current-state Gold warehouse KPIs for bin occupancy, stock availability, and transfer-requirement backlog.
- Added Gold stock expiry risk KPI and documented warehouse access-tier governance for cluster leads.

### Changed
- Refactored `silver/dlt_silver_fast.py`, `silver/dlt_silver_slow.py`, and `silver/dlt_silver_quality.py` to act as pipeline entrypoints, importing tables from the domain files.
- Restricted `process_order` to PP/PI AUFK order category `AUTYP = '10'`.
- Changed `storage_bin` CDC keys to preserve multiple quants in the same bin.
- Removed unused Loftware enrichment fields from the Silver material table.
- Disabled Gold row filters by default to avoid row-filter-driven full materialized-view refreshes.
- Hardened SAP key/date helpers for numeric-only ALPHA stripping and invalid-date tolerance.
- Derived downtime duration from start/end timestamps when available instead of assuming the raw duration unit.
- Made `notification_email` a required bundle variable with no placeholder default.
- Documented Gold freshness dependencies, all-time aggregate caveats, and row-filter setup ordering.
- Replaced the 4-row movement-type classification seed with generated semantics covering receipt, issue, transfer, adjustment, and reversal families.

## [0.2.0] - 2026-05-31

### Added
- Split the monolithic `silver/dlt_silver_pipeline.py` into three distinct files based on cost and freshness requirements:
  - `silver/dlt_silver_fast.py` (Continuous, fast operational tables)
  - `silver/dlt_silver_slow.py` (Triggered, slow reference tables)
  - `silver/dlt_silver_quality.py` (Triggered, quality tables)
- Created `silver/helpers.py` containing shared DLT logic, constants, and SparkSession helpers.
- Added comprehensive unit testing suite under `tests/` utilizing a mock local PySpark context.

## [0.1.0] - 2026-05-30

### Added
- Initial project scaffolding for Bronze, Silver, and Gold pipelines.
- Row-level security checks using `plant_access_filter` dynamically resolved.
- Data validation mappings for SAP T320 warehouse-to-plant mapping.
