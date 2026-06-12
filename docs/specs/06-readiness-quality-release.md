# Spec 06 — Readiness: quality-release dimension

Read `docs/specs/_conventions.md` first. Branch: `feature/readiness-quality-release`.

## Objective

`gold_wm_order_readiness` (the WM Cockpit-derived traffic lights) treats stock as available
if it physically exists. But a batch sitting in QM quality-inspection status, or with no
usage decision, is NOT usable for production. Add a quality-release dimension so the
readiness bands reflect QM reality.

## Design

1. **Gold:** extend `gold_wm_order_readiness` in `gold/wm_operations_gold.py` (read the
   whole function first — it has TR-coverage and PSA-supply logic that must not be
   disturbed; this is additive):
   - For each order component material at the order's plant, compute from
     `silver.batch_stock` (verify stock-category aliases): `qty_unrestricted`,
     `qty_in_quality_inspection`, `qty_blocked` (plant×material rollup).
   - QM lot view of the same: join `gold_wm_qm_lot_status` via `dlt.read` (it is
     estate-wide since the ADR 016 §4 gate widening; verify its merged columns — it has
     has_usage_decision / lot status fields) aggregated to plant×material:
     `open_lot_count` (lots without usage decision) for the component materials.
   - New columns: `quality_hold_qty` (= in-quality-inspection + blocked),
     `quality_release_status` ∈ RELEASED (no held qty, no open lots) /
     PARTIAL_HOLD (some held, unrestricted still covers requirement) /
     QUALITY_BLOCKED (held qty means unrestricted no longer covers requirement) /
     NO_QM_DATA. Requirement coverage uses the component requirement quantities the
     readiness table already computes — reuse, don't recompute.
   - The existing overall readiness band: where the current band is green but
     `quality_release_status = QUALITY_BLOCKED`, the band degrades to amber with a reason
     code (add a `readiness_reason` column if one doesn't exist; if a reason/limiting-factor
     column exists, extend its vocabulary). DO NOT change band semantics for any other case
     — the cockpit parity is load-bearing.
2. **Consumption view**: add the new columns to the readiness consumption view (all three
   envs); existing consumers keep working (additive only).
3. **Contract**: extend `wm_operations.order_readiness` fields (minor version bump,
   descriptions for UC).
4. **Adapter**: extend the readiness `SIMPLE_DATASETS` columns.
5. **Frontend** (readiness view): quality column with status chip; QUALITY_BLOCKED rows
   get the degraded-band styling; tooltip/expanded row shows held qty vs requirement and
   open lot count; link to QM Command Centre for the material where the existing
   cross-view navigation pattern supports it (read how readiness→worklist deep link works).

## Gotchas

- Scope honesty: QM lot/UD silver is estate-wide, but readiness only covers WM-onboarded
  plants — the join self-limits; `NO_QM_DATA` must distinguish "no lots exist" from
  "QM source absent" (dev!) — use the table_exists guard pattern and a null vs 'NO_QM_DATA'
  convention; document it.
- `gold_wm_qm_lot_status` vs raw silver: prefer the gold via dlt.read (already encodes the
  UD-exists rule — the `_ud_taken` lesson). Do not re-derive UD logic.
- batch_stock quality columns: MCHB carries insp/blocked stock categories — verify exact
  aliases (`quality_inspection_quantity` etc.) in `silver/tables/`; do not guess.
- Schema change to an existing gold table ⇒ flag post-deploy secured/consumption view
  re-apply (view-freeze rule) prominently in your report.

## Acceptance

- Fixtures: green order stays green when QM clean; green→amber degrade when held qty
  breaks coverage; PARTIAL_HOLD when held but covered; NO_QM_DATA pathway.
- No change to any existing readiness output column values for QM-clean fixtures
  (regression-pin one full existing scenario).
