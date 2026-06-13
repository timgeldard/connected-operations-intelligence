# Spec 11 — Trends: baseline bands

Read `docs/specs/_conventions.md` first. Branch: `feature/trends-baseline-bands` off main.
No Databricks/deploys.

## Objective

The Trends view shows daily-activity metrics as bare time series. Add **baseline bands** — a
"what good looks like" reference (median + p10–p90) per metric per plant — so a day reads as
above/below normal at a glance, instead of an unanchored line. Mirror the proven Staging-Pace
baseline technique and the `gold_wm_recipe_run_benchmark` percentile pattern (`F.percentile_approx`).

## Source (existing — confirm columns)
- `gold_wm_daily_activity` (`gold/wm_operations_gold.py`, ~L1077) + `vw_consumption_wm_operations_
  daily_activity`. Read its actual metric columns (e.g. per plant × day: TO confirmations, picks,
  goods movements, etc.) — VERIFY before use; the baseline is computed per those metrics.

## New data layer
1. **`gold_wm_daily_activity_baseline`** in `gold/wm_operations_gold.py` — `dlt.read(
   "gold_wm_daily_activity")` aggregated to plant_code × metric × **day_of_week** (and/or an overall
   per-plant baseline): `median` (`percentile_approx(metric, 0.5)`), `p10`, `p90`, `sample_days`
   (count). Day-of-week baseline captures weekday/weekend rhythm (verify a date column exists to
   derive `dayofweek` — deterministic transform, allowed in MV). `gold_wm_daily_activity` is **wide**
   (one column per metric: `to_items_confirmed`, `active_operators`, `trs_created`,
   `goods_receipt_lines`, `goods_issue_lines` — see `gold/wm_operations_gold.py` ~L1077).
   **Unpivot it to long `(metric_name, metric_value)` first** (e.g. `F.expr("stack(5, ...)")`),
   THEN group + percentile — one percentile expression instead of repeating it per column.
   Document the unpivot.
   - Exclude the current/partial day from the baseline sample (a day still in progress would drag
     the median) — exclude via a query-time filter in the consumption layer, OR compute baseline
     over completed days only (define "completed" without wall-clock in the MV — e.g. all days
     present in the source are already closed daily snapshots; confirm and document).
2. **`vw_consumption_wm_operations_daily_activity_baseline`** — projects plant × metric × dow median/
   p10/p90/sample_days. plant filterable.

The Trends view then overlays, per metric line: the median as a reference line and p10–p90 as a
shaded band, with the current series on top — today's point coloured by where it falls (in-band =
normal, above p90 / below p10 = flagged). Keep the existing daily_activity series; the baseline is
additive (a new query + overlay), the existing view/contract is NOT broken.

## Backend + Frontend
- Route `/api/wm-operations/daily-activity-baseline` (plant param). SIMPLE_DATASETS if it fits.
- Trends view: add the band overlay (CSS — shaded rect behind the existing CSS bars/line, a median
  reference line; today/last point coloured by band position). A small legend ("normal range
  p10–p90 · median"). Error-branch before empty-state; react-query; useMemo.

## Governance / validation / acceptance
New contract `wm_operations.daily_activity_baseline` (counts `long`, percentiles `double`) +
descriptions; add the gold table to GOLD_TABLES + regen ALL security variants; consumption views in
3 envs; regenerate contracts + OKF. Full guard battery + route pytest + pnpm typecheck/eslint +
PySpark tests (percentile maths null-safe, dow grouping, partial-day exclusion, wide-vs-long
handling). Acceptance (live): bands render behind the existing series; a clearly-abnormal day is
flagged; existing Trends series unchanged (regression-pin).

## Gotchas
- Match `gold_wm_daily_activity`'s actual shape (long vs wide) — don't assume; read it first.
- Only deterministic date transforms (dayofweek/trunc) in the MV; partial-day exclusion and any
  "recent window" are query-time.
- Additive only — do not alter the existing daily_activity contract/view (regression-pin one case).
- percentile_approx ignores nulls (good); ensure `sample_days` counts only contributing days.
