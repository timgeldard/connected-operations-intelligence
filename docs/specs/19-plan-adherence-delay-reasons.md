# Spec 19 — Plan Adherence & Delay-Reason Analytics (PAD) — MVP3

Read `docs/specs/_conventions.md`, `docs/specs/16-operational-risk-foundation.md`, and
`docs/specs/09-planning-board.md` first. Branch: `feature/plan-adherence`. Depends on spec 16;
heavy overlap with spec 09 (PAD is the **analytics layer behind** the planning board's read-only
Gantt — reuse its plan-board consumption view + `production_line` axis) and spec 04 (root-cause).

## Objective

Per process line: what was planned, what happened, where the plan slipped, and the most likely
delay reasons. Answers: did the line run to plan; which orders started/finished late; how far
behind/ahead; why it slipped; which delays recur; is the plan itself unstable. Read-only.

## Grounding (verify aliases before coding)

`gold_process_order_schedule_adherence` (planned vs actual, S-curve source), `gold_wm_adherence_root_cause`
(spec 04 — reuse for reason inference), `gold_wm_order_journey_summary` (scheduled/actual start+finish,
production_line, qty), `gold_wm_order_yield` (progress / pct_complete). `production_line` is the
recipe-map-enriched column (NOT raw CRVER — see spec 09's corrected note). All in
`gold/wm_operations_gold.py`.

## Design

1. **Gold `gold_wm_plan_adherence`** — order grain per line: plant_code, process_line, order_number,
   material, batch, planned_start, planned_finish, actual_start, actual_finish, status,
   planned_qty, confirmed_qty, completion_pct. Reuse journey_summary + adherence; do not recompute.
2. **Adherence KPIs** (PAD-002) — orders planned / started-on-time / started-late / not-started /
   completed-on-time / completed-late, planned vs confirmed qty, qty-attainment %, schedule-adherence
   %, avg start delay, avg finish delay. The on-time/late CLASSIFICATIONS that compare to *planned*
   (a fixed date) are deterministic; "not-started as of now" / "at-risk" are query-time.
3. **Late-start** (PAD-003): Not-due / On-time / At-risk / Late-start / Started-late / **Unknown** —
   compare actual_start vs planned_start. **Late-finish** (PAD-004): On-track / Projected-late /
   Finished-late / Finished-on-time / Unknown.
4. **Progress-vs-plan** (PAD-005, active orders): planned-elapsed %, actual-confirmed %,
   expected-qty-at-now, variance, projected_finish — all **query-time** (depend on now). Reuse the
   lineside/yield projection logic; never put `current_*` in the gold MV.
5. **Delay-reason inference** (PAD-006/007): primary + contributing reasons from the foundation
   taxonomy (material-not-staged, shortfall, TR/TO-aged, quality-hold, not-released,
   previous-order-overran, confirmation-missing, line/resource-unavailable, no-activity,
   schedule-changed, stale, **Unknown**) with EVIDENCE + confidence — e.g. "Primary: material not
   staged; evidence: 3 components open, oldest TO 4h22m, staging 61%, start due in 18m." Reuse spec
   04 root-cause; this presents primary+contributing+evidence+confidence per order.
6. **Plan volatility** (PAD-008): schedule-change count, first vs latest planned start, movement
   minutes, moved-inside-frozen-window, added/removed from day plan — **ONLY where the source
   carries schedule-change history.** If process_order replication is SCD1 (current-state only, no
   change history), this is NOT derivable — scope it out honestly and add an ingestion/CDC note;
   do NOT fabricate volatility from a single snapshot.
7. **Previous-order dependency** (PAD-009): for sequential orders on a line (order by
   planned_start within plant×line), surface previous order, its planned vs actual/projected finish,
   and the delay passed downstream. Window function with explicit ordering (deterministic) for the
   linkage; the projected-finish part is query-time.
8. **Trend + Pareto** (PAD-010/011): line attainment trend (daily/shift), start/finish adherence,
   avg delay, top delay reason, recurring blockers; delay Pareto by line/plant/material-family/
   order-type/shift/day-week-month.
9. **Risk emission:** late-start/late-finish rows feed `gold_operational_risk_item` (domain=production,
   reasons ORDER_NOT_STARTED / PRODUCTION_BEHIND_PLAN / PREVIOUS_ORDER_OVERRUN / + the inferred cause).

## Timezone governance (PAD-014 — CENTRAL here, do not skip)

All start/finish comparisons use a documented time basis: **plant-local for operational display,
canonical UTC for storage/computation**, explicit conversion rules, and tests for plants in
different timezones. Use the foundation's UTC date util on the frontend (parse parts → `Date.UTC`,
never `new Date(isoString)` for date-only — the bug class fixed in the trends + planning-board
reviews). "Late" by plant-local midnight vs UTC midnight must be correct for +offset plants.

## Backend + Frontend

Consumption views (order-grain adherence, KPIs, delay-reason detail, trend, Pareto), contracts, OKF,
SQL (all variants). View extends/complements the planning board: plan-vs-actual table, attainment
trend, delay-reason cards (primary+evidence+confidence), Pareto chart (CSS, no chart libs),
drill-through to staging/components/TR-TO/quality/confirmations/movements/prev-next order.
**Read-only** (PAD-013) — no reschedule/SAP actions (foundation wording guard). Configurable-cadence
react-query. Tolerances (late-start grace, etc.) configurable per SHD-008.

## Gotchas

- Timezone governance is the headline risk — be explicit and test multi-tz.
- Determinism: classifications vs fixed planned dates = gold; everything vs *now* (at-risk,
  not-started, projected, expected-at-now) = query-time view.
- plant_code axis on any order×evidence join (conventions §2).
- Plan-volatility needs change history — gate it on source availability; Unknown-not-fabricated.

## Acceptance

- Fixtures: on-time vs late start and finish classify correctly; a +offset-timezone plant's
  late/on-time is correct (multi-tz test); a delay surfaces primary+contributing reasons + evidence
  + confidence; previous-order overrun propagates downstream; missing evidence → Unknown.
- Plan-volatility either computes from real change history OR is documented out-of-scope (no fake).
- `tests/golden/pad.md`. Determinism guard passes; read-only.
