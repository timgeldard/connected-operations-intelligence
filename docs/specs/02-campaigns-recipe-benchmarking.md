# Spec 02 — Campaigns: recipe benchmarking

Read `docs/specs/_conventions.md` first. Branch: `feature/campaigns-recipe-benchmarking`.

## Objective

The Campaigns view shows campaign lists. Production managers need to compare runs of the
**same recipe/process line**: "is this campaign's duration/yield normal for this product on
this line?" Benchmark = the distribution of past runs of the same (material, production_line).

## Design

1. **Gold:** new table `gold_wm_recipe_run_benchmark` in `gold/wm_operations_gold.py`.
   - Source: `gold_wm_order_yield` via `dlt.read(...)` (intra-pipeline dependency — it has
     plant_code, order_number, material_code, production_line, planned/delivered qty,
     yield_pct, first/last_gr_date, is_complete; verify against the merged definition).
   - Grain: one row per `plant_code × material_code × production_line` ("recipe-line").
   - Aggregations over COMPLETE orders with GR (`is_complete AND has_goods_receipt`):
     `run_count`, `median_yield_pct`, `p10_yield_pct`, `p90_yield_pct`
     (use `F.percentile_approx`), `median_duration_hours` + p10/p90 (duration =
     `last_gr_date - first_gr_date` in hours; guard zero/negative → null),
     `last_run_finish_date` = max(actual completion evidence available on the source).
   - Null `production_line` → group under literal `'UNASSIGNED'` (don't drop rows).
2. **Per-run comparison is computed in the app**, not gold: the Campaigns view already has
   per-campaign data; the new dataset supplies the benchmark distribution to compare against.
3. **Consumption views**: `vw_consumption_wm_operations_recipe_benchmark` in all three env
   files (counts are `long` in the contract; percentiles `double`).
4. **Contract + adapter**: `wm_operations.recipe_benchmark`, `SIMPLE_DATASETS` entry,
   field descriptions (UC-published).
5. **Frontend** (Campaigns view in `domain-integrations/wm-operations/src/views/`): a
   "Recipe benchmark" panel — when a campaign (or its material/line) is selected, show the
   matching benchmark row: run count, yield median with p10–p90 range, duration median with
   range, and where available position the selected campaign's own yield/duration within
   the band (simple horizontal band visual, CSS only — house pattern is CSS bars, see the
   Trends / S-curve implementations; no chart libraries).

## Gotchas

- `gold_wm_order_yield` `yield_pct` is null-guarded (null when planned qty 0/null) — your
  percentiles must ignore nulls (percentile_approx does; verify the count column counts
  only rows entering the distribution).
- Don't double-gate: order_yield already carries the plant scope; no extra plant gate.
- New gold table ⇒ add to `GOLD_TABLES` in the security generator + regen ALL variants.
- DLT dataset-name uniqueness check must pass.

## Acceptance

- Benchmark rows exist for recipe-lines with ≥1 complete run; UNASSIGNED bucket present.
- Median/percentile null-handling: a recipe-line with all-null yields has null percentiles
  but a correct run_count of qualifying runs (define and test the semantics).
- Campaigns view renders the panel with selection-driven lookup; error branch before
  empty-state.
- PySpark tests: percentile aggregation, duration guard, UNASSIGNED grouping, null yields.
