# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Created `silver/tables/` domain-specific modular directory structure.
- Grouped expectations using `@dlt.expect_all` and `@dlt.expect_all_or_drop` for improved pipeline maintainability.
- Consolidated unit tests to import directly from domain-specific modules.
- Added a paused Databricks job resource to refresh triggered Silver domains before Gold on an explicit schedule.

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
