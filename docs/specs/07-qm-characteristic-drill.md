# Spec 07 — QM Command Centre: characteristic-level drill

Read `docs/specs/_conventions.md` first. Branch: `feature/qm-characteristic-drill`.

## ⚠ Data scope caveat (display honestly, do not work around)

MIC-level results come from the lab-board result-grain silver
(`quality_lab_inspection_result` / `quality_lab_characteristic_spec` in
`silver/tables/quality_lab.py`) — gated to the QM-enabled plants AND currently affected by
the **QAMR replication stall**: C061+P817 have no results since 2026-03-25, P806 since
2026-04-20; only C351 is current. Your feature must state its data window per plant rather
than imply completeness (a freshness line in the UI fed by a max-result-date column).
Do NOT widen any silver gate in this spec.

## Objective

The QM Command Centre shows lot-level status. Quality managers need the level below:
**which characteristics (MICs) fail most** (Pareto) and **how usage decisions distribute**
(UD code Pareto), filterable by plant/material/time.

## Design

1. **Gold** (new module section or `gold/quality_lab.py` — read it first; the severity rule
   and material enrichment live there and should be reused, not duplicated):
   a. `gold_qm_characteristic_pareto` — grain: plant_code × material_code ×
      characteristic_id (+ characteristic_text, unit):
      `result_count`, `fail_count`, `warn_count` (reuse/refactor the EXISTING severity
      derivation from `gold_qm_lab_result_signal` — extract a shared helper rather than
      copy-pasting the rule), `fail_rate` (fail/result, null-guarded),
      `last_result_date` = max result recording date (the per-plant freshness signal).
      Source: the full result-grain silver (NOT the fails-only gold — Pareto needs the
      denominator of all results).
   b. `gold_qm_ud_code_pareto` — grain: plant_code × usage-decision code:
      `lot_count`, `accepted-vs-rejected` style classification if the UD silver carries a
      disposition/code text (verify `quality_inspection_usage_decision` aliases in
      `silver/tables/quality.py` — usage_decision code + text columns), plus
      `last_decision_date`. Source: UD silver joined to its parent lot for the plant
      (the QAVE.VWERKS lesson: plant comes from the LOT, never VWERKS).
2. **Consumption views + contracts + adapter** per house pattern
   (`wm_operations.qm_characteristic_pareto`, `wm_operations.qm_ud_code_pareto` — the QM
   Command Centre's existing datasets live under wm_operations; follow how qm_lot_status
   was wired).
3. **Frontend** (QM Command Centre in `domain-integrations/wm-operations/src/views/` —
   find the QM views from `wm-operations-workspace.tsx`): a "Characteristics" drill view or
   panel: MIC Pareto (CSS bars, fail_rate + counts, sorted by fail_count), UD-code
   distribution panel, plant filter consistent with the workspace's plant scope, and the
   per-plant data-freshness line ("results to 2026-03-25" style) fed by `last_result_date`.

## Gotchas

- Severity rule reuse: `gold_qm_lab_result_signal` computes fail/warn (explicit warn limits
  when present, 5%-of-span fallback). Extract to a module-level helper in
  `gold/quality_lab.py` used by BOTH tables — single source of the rule.
- The result silver's window is `qm_lookback_years` (5y) — your Pareto inherits it; the UI
  may add a query-time period filter (mirror the lab board's days param pattern if cheap,
  else ship 5y-window v1 and note it).
- Quantitative vs attributive results: MBEWERTG/valuation columns — non-numeric results
  have null result_value but still carry pass/fail valuation; the existing signal logic
  handles this (read it); your counts must include attributive results.
- Two new gold tables ⇒ generator + ALL variants + dataset-name check; QM sources absent
  in dev ⇒ table_exists/guard patterns throughout.

## Acceptance

- Pareto counts reconcile to the silver result counts for a fixture; severity helper is
  shared (one definition, grep-provable).
- UD plant attribution via parent lot proven in a fixture where QAVE plant ≠ lot plant.
- UI shows per-plant freshness; no implication of estate completeness.
