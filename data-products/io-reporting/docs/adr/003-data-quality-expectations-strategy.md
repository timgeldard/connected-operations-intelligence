# ADR-003: Data quality expectations — warn for business logic, drop for missing keys

**Status:** Accepted  
**Date:** 2026-05-30

## Context

DLT/SDP expectations have three severities:

- `expect_or_drop` — invalid row is removed before reaching the silver target.
- `expect` (warn) — row passes through; violation is counted in pipeline metrics.
- `expect_or_fail` — pipeline stops on first violation.

SAP operational data has legitimate states that look like quality violations: in-progress process orders with reversed scheduled dates, transfer requirements with zero quantity (cancellation lines), batch stock going temporarily negative during backflushing. Silently dropping these rows would produce an incomplete silver layer that misleads downstream consumers.

## Decision

- **`expect_or_drop`** for missing primary key components only. A row without its key cannot be upserted via `apply_changes` and has no identity — it must be dropped.
- **`expect` (warn)** for all business-logic constraints (date ordering, quantity signs, required enrichment fields). These violations are flagged in pipeline metrics for monitoring but the row is retained.
- **`expect_or_fail`** is not used. Operational pipelines should not halt on data quality issues; the source cannot be corrected in real time.

## Consequences

- No valid operational row is silently lost due to a quality check.
- Violations are visible in the Databricks pipeline event log and can be queried via the pipeline event table.
- Downstream Gold-layer queries must handle the edge cases (NULL dates, negative quantities) that these checks flag but do not filter.
- If a business rule is later confirmed as a hard invariant (e.g., process order types are locked down), the corresponding `expect` can be promoted to `expect_or_drop` without a schema change.
