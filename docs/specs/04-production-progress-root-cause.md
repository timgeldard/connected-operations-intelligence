# Spec 04 — Production Progress: adherence repair + root-cause tagging

Read `docs/specs/_conventions.md` first. Branch: `feature/adherence-root-cause`.

## Objective

Two coupled problems on the Production Progress view:
1. `gold_process_order_schedule_adherence` is **EMPTY at gold level** in UAT (verified
   2026-06-12) — the S-curve renders its empty state. Repair it.
2. Once it has data: tag each adherence miss with a root-cause class
   (LATE_RELEASE / MATERIAL_SHORT / CAPACITY / UNCLASSIFIED) so the chart explains itself.

## Part A — repair the adherence MV (code-level diagnosis, no live data needed)

Read the `gold_process_order_schedule_adherence` definition in
`gold/dlt_gold_pipeline.py`. The known UAT replication facts that almost certainly explain
the emptiness (this exact bug class hit order-readiness before — see the fix in commit
`d8912d6` and the table comments around `gold_wm_order_readiness`):
- **AUFK PHAS0–3 status flags arrive BLANK** in the UAT replication → any filter on
  `is_released` / `is_completed` derived from PHAS flags eliminates every row.
- Reliable evidence columns that ARE populated: `actual_release_date` (AUFK FTRMI),
  `actual_finish_date` (AUFK GLTRI), `scheduled_start_date`/`scheduled_finish_date`
  (GSTRS/GLTRS) — verify all four aliases in `silver/tables/process_order.py`.

Fix accordingly: replace PHAS-flag predicates with date-evidence predicates
(`actual_release_date IS NOT NULL` for released; `actual_finish_date IS NOT NULL` for
completed), mirroring the readiness precedent. Keep the output schema identical (the
consumption view `vw_consumption_wm_operations_schedule_adherence_daily` and the S-curve
already consume it — read both to confirm no contract change). If you find a different
root cause in the code (e.g. an impossible join), fix that and document the reasoning —
but the PHAS hypothesis is strong and pre-verified for the sibling table.

## Part B — root-cause tagging

1. **Gold:** new table `gold_wm_adherence_root_cause` (order grain, late/missed orders only)
   in `gold/wm_operations_gold.py`:
   - An order is a "miss" when `actual_finish_date > scheduled_finish_date` or unfinished
     past schedule (the second condition needs query-time evaluation — gold carries the
     dates; the view derives `is_open_late`).
   - Classification (first matching rule wins; document precedence in the table comment):
     - `LATE_RELEASE`: `actual_release_date > scheduled_start_date`.
     - `MATERIAL_SHORT`: component shortfall evidence — join
       `gold_wm_order_component_variance` (via dlt.read; verify its merged grain:
       plant×order×material) for under-issue (variance_qty < 0 beyond a small tolerance)
       OR the readiness staging signals if cleaner (read `gold_wm_order_readiness`).
     - `CAPACITY`: released on time + materials fine, but first operation start lagged
       release materially — use `gold_wm_order_journey_summary` milestones via dlt.read
       (verify its column names for first op start / release).
     - else `UNCLASSIFIED`.
   - Carry the evidence columns used, so the UI can show WHY the tag applies.
2. **Consumption view + contract + adapter** per house pattern
   (`wm_operations.adherence_root_cause`).
3. **Frontend:** in `production-progress-view.tsx`: a root-cause breakdown panel (counts by
   class for the visible 8-week window — reuse the existing windowing, which lives in the
   parent view) + tag chips on a late-orders list with drill to Order Journey (existing
   deep-link pattern in this same view).

## Gotchas

- This view had a KPI/chart window-consistency bug before (fixed in #111's review) — wire
  any new panel to the SAME `visibleAdherence` window the parent computes.
- Don't filter the adherence MV to misses — Part A's table feeds the whole S-curve;
  the root-cause table is the separate miss-grain table.
- Two gold tables touched/added ⇒ generator regen ALL variants; secured/consumption views
  for the adherence table already exist — flag the post-deploy re-apply in your report.

## Acceptance

- Part A: adherence MV non-empty logic provable from code + tests with PHAS-blank fixtures
  (fixtures where all PHAS-derived flags are false/null but dates are present).
- Part B: every classified order carries consistent evidence columns; precedence tested.
- Orchestrator post-merge: gold run, verify S-curve renders, verify class distribution sane.
