# ADR 009 — Detailed IM↔WM stock reconciliation

## Status
Accepted — implemented as `gold_stock_reconciliation_v2` (2026-06-02), hardened with
value/audit/tolerance outputs (2026-06-03).

> **Note:** Implementation differs from the original proposal in two respects:
> 1. The table is named `gold_stock_reconciliation_v2` (side-by-side with v1) rather than
>    `gold_stock_reconciliation_detailed`, as decided by the PR author.
> 2. The sloc grain is not achieved in v2. LQUA has no LGORT; T320 confirms (plant, sloc) → warehouse
>    is 1:1 but warehouse → sloc is 1:many — so WM stock can only be attributed to a warehouse grain.
>    The proposed `silver.wm_managed_sloc` config is replaced by `silver.warehouse_storage_location_mapping`
>    (T320 as-is). Sloc-grain reconciliation remains a future follow-up.
> 3. MARM is confirmed ingested (`materialconversion_marm`) and wired into Silver as
>    `material_uom_conversion`.

## Context
`gold_stock_reconciliation` compares IM (MARD) vs WM (bins) at **plant × material** only, with a
`max(0.1, 1% IM)` tolerance. It is not root-causeable: no storage location / warehouse / batch /
stock-category grain, no UoM normalisation, no explanation of deltas via pending movements.

**Data reality:** `MARD` (IM) is **non-batch** (material × plant × sloc). `MCHB` (already
`silver.batch_stock`) is the **batch-level IM** (material × plant × sloc × batch). `storage_bin`
(LQUA) is WM at quant/batch grain. UoM conversion factors (`MARM`) are in Silver for detection
and future alternative-UoM handling; standard MARD/LQUA comparison is base-UoM.

## 2026-06-03 hardening
The pasted reconciliation hardening plan is integrated as a production-candidate extension:

1. `gold_stock_reconciliation_v2` exposes `delta_percent`, `tolerance_exceeded`,
   `tolerance_rule_code`, `reconciliation_rule_version`, `last_reconciled_at`, and
   deterministic `audit_trail_json`.
2. `gold_stock_value_reconciliation` provides the value-control rollup by plant × warehouse ×
   mismatch reason/severity.
3. `gold_reconciliation_audit_log` provides a current-state exception register; append-only audit
   history remains the responsibility of the snapshot/control job rather than non-deterministic DLT
   expressions.
4. Remaining roadmap items are explicit follow-ups: open movement explainers, physical inventory
   tie-out, and governed WM bin/storage-type→sloc attribution where SAP configuration supports it.

## Decision
1. **`gold_stock_reconciliation_detailed`** at **plant × sloc × warehouse × material × batch ×
   stock_category**:
   - **IM side:** `batch_stock` (MCHB) for batch-managed materials; `stock_at_location` (MARD)
     for non-batch (batch = `__NONE__`).
   - **WM side:** `storage_bin` aggregated to plant × sloc(via warehouse↔sloc map) × warehouse ×
     material × batch × stock_category.
   - Columns: `im_qty, wm_qty, delta_qty, delta_value, tolerance, mismatch_reason`,
     `abc_classification`, `valuation_class`, `last_reconciled_date`.
   - **`mismatch_reason` canonical enum (single source of truth, referenced by the roadmap and
     pre-MARM flows):** `rounding | uom | uom_unconverted | pending_to | quant_blocked |
     true_variance`. `uom_unconverted` is the pre-MARM state (UoM conversion factors not yet
     available, so IM/WM could not be normalised — distinct from a genuine `uom` mismatch).
2. **`silver.wm_managed_sloc`** config (`plant_code, storage_location_code, warehouse_number,
   is_wm_managed, reconciliation_active`) — only reconcile WM-managed, active slocs. Maps the
   warehouse↔sloc relationship WM lacks directly. **Seed/stub** + documented population.
   - **1:many warehouses:** a single `LGNUM` can map to multiple `LGORT` in the same plant, and
     `LQUA`/`storage_bin` does not carry `LGORT` at quant level. So the mapping must be defined at
     **storage-type grain (`LGTYP` → `LGORT`)** — how SAP WM directs stock to interim storage
     locations — to resolve quant→sloc; where that is not configured, reconcile at the aggregate
     **warehouse** level (group all mapped IM slocs) rather than guessing a sloc.
   - Columns: `im_qty, wm_qty, delta_qty, delta_value, tolerance, mismatch_reason` (enum:
     `rounding | uom | pending_to | quant_blocked | true_variance`), `abc_classification`,
     `valuation_class`, `last_reconciled_date`.
2. **`silver.wm_managed_sloc`** config (`plant_code, storage_location_code, warehouse_number,
   is_wm_managed, reconciliation_active`) — only reconcile WM-managed, active slocs. Maps the
   warehouse↔sloc relationship WM lacks directly. **Seed/stub** + documented population.
3. **UoM normalisation:** ingest `MARM` → `silver.material_uom_conversion`; normalise IM/WM to a
   common UoM before comparing (suppresses spurious UoM deltas).
4. **Explain deltas:** left-join open TOs/TRs (`warehouse_transfer_order/_requirement`) keyed by
   material/batch; if an open movement covers the delta → `mismatch_reason = pending_to`.
   Blocked quant → `quant_blocked`. Within tolerance → `rounding`. Tolerance configurable per
   `material_type` (bulk vs high-value).
5. Keep the existing coarse `gold_stock_reconciliation` as the **`gold_stock_reconciliation_summary`**
   rollup (drill-down to detailed). Extend `gold_warehouse_exceptions` with detailed-recon rules.

## Consequences
- New dependencies: `MARM` (UoM) ingestion → silver; `wm_managed_sloc` config population.
- Volume grows sharply at batch grain — liquid clustering / Z-order on `(plant_code,
  storage_location_code, material_code)`; consider incremental (apply_changes) or daily snapshot.
- Batch reconciliation is only as good as batch-level IM (MCHB) coverage; non-batch materials
  reconcile at sloc grain.
