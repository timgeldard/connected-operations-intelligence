# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

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

### Changed
- Refactored `silver/dlt_silver_fast.py`, `silver/dlt_silver_slow.py`, and `silver/dlt_silver_quality.py` to act as pipeline entrypoints, importing tables from the domain files.

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
