# Spec 10 — PI / Cycle-Count Analytics

Read `docs/specs/_conventions.md` first. Branch: `feature/pi-cycle-count-analytics` off main.
No Databricks/deploys.

## Objective

Inventory-accuracy analytics on top of the EXISTING physical-inventory recon. Raw count-vs-book
evidence is already governed (`gold_physical_inventory_recon` + `vw_consumption_wm_operations_
physical_inventory`); this adds the **aggregated KPI + trend layer**: count accuracy %, count
coverage, adjustment value, recount rate — by plant × storage-zone × period × ABC cycle-count
indicator — plus an accuracy trend over time. A new "Inventory Accuracy" view in the wm-operations
workspace (Insight group). This does NOT re-expose the raw recon.

## Source (verified — `gold_physical_inventory_recon` via dlt.read, built in warehouse_flow_gold.py)
Item grain: plant_code, storage_location_code, material_code, batch_number, fiscal_year,
`count_date`, `planned_count_date`, posting_date, `book_quantity`, `counted_quantity`,
`delta_quantity`, `abs_delta_quantity`, `delta_value` (local currency), currency,
`cycle_counting_indicator` (ABC), `difference_reason_code`, `physical_inventory_status`
(NOT_COUNTED / RECOUNT_REQUIRED / DIFFERENCE_POSTED / MATCHED), is_counted / is_recount_required /
is_difference_posted. VERIFY each against `warehouse_flow_gold.py` `gold_physical_inventory_recon`
and `silver/tables/inbound.py physical_inventory_document` before use (cite file:line in report).

## New data layer
1. **`gold_wm_pi_accuracy`** in `gold/wm_operations_gold.py` — aggregate `dlt.read(
   "gold_physical_inventory_recon")` to plant_code × storage_zone × cycle_counting_indicator ×
   count-period grain:
   - join `_storage_zone_mapping` (the existing helper) on storage_type/location to add
     `storage_zone` — VERIFY the join key (PI carries `storage_location_code` (LGORT); the zone
     mapping is keyed on storage_type/warehouse — if LGORT→storage_type isn't directly mappable,
     group by `storage_location_code` and note storage_zone as best-effort/null rather than forcing
     a wrong join).
   - count-period: derive `count_month` = `date_trunc('month', count_date)` (deterministic — a
     transform of an existing column, NOT current_date; allowed in the MV). For "recent N-day"
     windows use a query-time filter in the consumption/_live layer, NOT the MV.
   - metrics: `counted_lines`, `matched_lines`, `count_accuracy_pct` =
     matched/ counted (guarded 0 denom → null), `recount_required_lines`, `recount_rate_pct`,
     `lines_with_difference`, `total_adjustment_value` = Σ delta_value, `abs_adjustment_value` =
     Σ |delta_value|, `net_adjustment_qty`. Counts are `long`.
   - coverage: `due_lines` (all PI lines in period) vs `counted_lines` → `coverage_pct`. (Honest:
     "due" = PI documents created in the period; document the definition in the table comment.)
2. **`vw_consumption_wm_operations_pi_accuracy`** — projects the above; any "last N days" /
   period-relative slicing is query-time here. plant + period filterable.

(If an accuracy-trend-by-day surface is cleaner as its own view, add
`vw_consumption_wm_operations_pi_accuracy_trend` at plant × count_date grain.)

## Backend + Frontend
- Route(s) under wm_operations adapter (SIMPLE_DATASETS if the shape fits): `/api/wm-operations/
  pi-accuracy` (+ optional period/plant params, validated/bound).
- New "Inventory Accuracy" view (Insight group): KPI strip (overall accuracy %, coverage %, abs
  adjustment value, recount rate), an accuracy **trend** (CSS bars/line — no chart libs, mirror the
  Trends/S-curve style), and a by-zone / by-ABC-class breakdown table. Error-branch before
  empty-state; react-query; deep-link to the existing Physical Inventory (raw recon) view for drill.

## Governance / validation / acceptance
New contract `wm_operations.pi_accuracy` (+ trend) in the manifest with descriptions, counts `long`;
add `gold_wm_pi_accuracy` to GOLD_TABLES + regenerate ALL security variants; consumption views in all
3 env files; `_live` serving view if any query-time column; regenerate contracts + OKF
(`make generate-okf`). Full offline guard battery + FastAPI route pytest + pnpm typecheck/eslint +
PySpark tests (accuracy/coverage maths, zero-denom guards, ABC grouping, zone-join handling, period
truncation). Acceptance (orchestrator, live): accuracy/coverage/value reconcile to the recon for a
plant+period; trend renders; honest "due" definition; no raw-recon duplication.

## Gotchas
- `count_accuracy_pct` IS computed in the MV — it is a ratio of two aggregates
  (matched/counted), fully deterministic, so it belongs in `gold_wm_pi_accuracy` (this corrects an
  earlier contradiction in this spec). What is query-time-only is **period-relative slicing**
  ("last N days"), which lives in the consumption/_live layer. `count_month` is a deterministic
  `date_trunc` transform and also lives in the MV. No `current_date` in the `@dlt.table`.
- delta_value is local currency — surface currency; do not sum across currencies silently (group/flag).
- Reuses `gold_physical_inventory_recon` + `_storage_zone_mapping` — confirm columns, don't rebuild.
