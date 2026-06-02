# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
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
