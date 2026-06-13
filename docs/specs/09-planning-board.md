# Spec 09 — Production Planning Board (read-only, line-laned)

Read `docs/specs/_conventions.md` first. Branch: `feature/planning-board` — **branch off
`feature/lineside-monitor`** (it reuses that branch's `vw_consumption_wm_operations_lines` and
`gold_wm_lineside_now`; final merge order is lineside → planning board). No Databricks/deploys.

## Objective

A **read-only** production planning board: a line-laned Gantt of scheduled process orders across a
date window, showing **progress vs plan** at a glance, configurable/filterable by plant and
**process_line** (not work-centre / resource), with easy date navigation. It replaces a
Claude-Design draft (provided as the `Process Order History` package: `planning-board.jsx`,
`data.js`, `colors_and_type.css`, `styles.css`, `order-detail.jsx`, etc.) — port its visuals but
**strip all scheduling/rescheduling**.

## What changes from the draft (the three explicit asks)

1. **READ-ONLY — remove every write/reschedule affordance:**
   - Drop the "Schedule plan" primary button, any drag-to-schedule on the backlog rail, and any
     block drag/move/resize. The backlog rail stays as an **informational** "unscheduled / overdue"
     list (no drag). "Print plan" may stay (read-only export) or be dropped — your call, keep it
     simple. No mutation endpoints exist or should be added.
2. **Date navigation:** add a selected-date control (default = today) with **◀ Yesterday · Today ·
   Tomorrow ▶** buttons and a **date picker**. The Gantt window derives from the selected date:
   day view = that day (hour ticks), week view = the week containing it (or selected ± 3d). Replace
   the draft's static window chip. Keep the day/week zoom toggle. "Scroll to now" only when the
   window includes today.
3. **Process_line lanes:** the draft already lanes by line (`data.lines`, lane header
   `t.headerLine`) — keep that, but key the lane on `process_order.production_line`. NOTE: this is
   NOT a raw `AUFK-CRVER` field — `silver.process_order` enriches `production_line` via a join to
   the `recipe_process_line` reference map (CRVER → INOB → AUSP → CAWNT). Use the `production_line`
   column as-is; don't hunt for a CRVER alias. NEVER lane by work-centre/resource. Lane label =
   line code + friendly name; lane meta (cap/shift) only if available, else omit honestly.

## Draft structure to port

- **Header / KPI strip** (8 cells): lines running, today's qty, utilization (next-24h capacity),
  on-time % (last 48h closed), at-risk count, shortages, downtime 24h, backlog count.
- **Toolbar:** date window + nav (rework per above), plant filter, category filter, legend,
  day/week zoom, WM-overlay toggle.
- **Gantt:** line lanes (left, sticky) × time grid (right, scrolling); day columns with today
  highlight + past shading; a **NOW** vertical line; per-line **status-coloured order blocks**
  positioned by scheduled start/finish, with a **progress fill** for running orders.
- **Backlog rail** (right): unscheduled / overdue orders — read-only.
- **WM replenishment overlay** (toggle): staging transfer status feeding each line
  (delivered / in-transit / pending / delayed).
- Kerry design system already in the repo (`.kerry-wm`, Noto fonts in `domain-integrations/
  wm-operations/`) — reuse it; do not re-import fonts. The draft's `colors_and_type.css`/`styles.css`
  are the visual reference.

## Progress vs plan (the core value — make it unmissable)

For each order block render BOTH the plan and the actuals so slippage is visible:
- **Planned extent** = scheduled_start → scheduled_finish (the block's base rectangle).
- **Progress fill** = `pct_complete` (from `gold_wm_order_yield` / `gold_wm_lineside_now`) for
  running orders.
- **Projected finish vs planned** = for running orders, project finish from elapsed/pct (lineside
  logic) and show overshoot **past** the planned end in the at-risk colour — the at-a-glance "is it
  going to be late" signal.
- **Status colour** maps to our data (no SAP codes): `running` (in execution), `firm` (released,
  not started), `completed` (`actual_finish_date` set), `atrisk` (adherence late / projected
  overshoot — from `gold_wm_adherence_root_cause`), `material-short` (from
  `gold_wm_order_shortage_projection` / readiness QUALITY_BLOCKED-or-not-staged). `changeover` /
  `cleaning` / `maintenance` / `downtime` from the draft likely have NO governed source
  (PM/operation-type data not replicated) — OMIT them with an honest note rather than fake them;
  `downtime` only if `gold_wm_downtime*` covers the line/window.
- **Per-day attainment** (suggested, see below): planned vs actual/projected qty per day column.

## Data layer

Reuse heavily; add the minimum.

### Reuse (confirm columns; from the lineside branch + existing gold)
| Element | Source |
|---|---|
| Lanes | `vw_consumption_wm_operations_lines` (from spec 08) |
| Running blocks + pct + current phase | `gold_wm_lineside_now` (spec 08) |
| Block plan window, material, qty | `gold_wm_order_journey_summary` (scheduled_start/finish, production_line, material, order_qty) |
| pct_complete / yield | `gold_wm_order_yield` |
| at-risk / late | `gold_wm_adherence_root_cause` |
| material-short / staging | `gold_wm_order_shortage_projection`, `gold_wm_order_readiness` |
| on-time %, plan-vs-actual | `gold_process_order_schedule_adherence` |
| downtime KPI | `gold_wm_downtime*` (if present) |
| backlog | `gold_wm_order_readiness` (unreleased/overdue) |

### New
- **`vw_consumption_wm_operations_plan_board`** — order-grain, date-windowable, one row per order
  scheduled in the window: plant_id, line_id (production_line), order_id, material_id/name, qty,
  `scheduled_start`, `scheduled_finish`, `actual_start`, `actual_finish`, `pct_complete`,
  `projected_finish` (query-time), `status` (the mapped kinds above, derived in the view from
  release/finish/adherence/shortage signals), staging status, is_backlog/is_overdue flags. Build it
  as a consumption view over a small new `gold_wm_plan_board` MV if a join is needed beyond what
  journey_summary+yield give; prefer reusing existing gold via the view if possible. Wall-clock rule:
  `projected_finish` / overdue / "today" comparisons are QUERY-TIME in the view, never in a base MV.
  Date windowing is a **query parameter** (start/end), NOT baked into the MV — the board passes the
  selected window.

## Backend
- Read-only routes under the wm_operations adapter, parameterized by `plant`, optional `line`,
  `from`/`to` (date window): `GET /api/wm-operations/plan-board` (blocks),
  `/api/wm-operations/plan-board/kpis`, `/api/wm-operations/plan-board/backlog`,
  `/api/wm-operations/plan-board/wm-overlay` (staging). Strip/validate date params (ISO dates;
  reject malformed → 422; default = today ±window). Bind safely. Reuse `/api/wm-operations/plants`
  and the new `/api/wm-operations/lineside/lines` (or `/api/wm-operations/plan-board/lines`) for the
  filters. A freshness value for the header. NO write/schedule endpoints.

## Frontend
- New `planning-board` view in the wm-operations workspace (it's an operator/planner tool, fits the
  workspace — unlike the lineside wall display it can live in-app with chrome).
- Port the Gantt/KPI/backlog/legend from the draft into the Kerry DS; **remove** the schedule button,
  backlog drag, and any block-move handlers; add the date nav (prev/next-day, today, date picker)
  driving the window + react-query refetch. react-query hooks (no manual fetch). Error-branch before
  empty-state. CSS-only bars (no chart libs). useMemo with full deps. The block layout maths
  (pxPerHour, day columns, NOW line) port directly.
- Clicking a block opens a **read-only** order drawer (reuse the draft's `order-detail.jsx` styling)
  with a deep-link to **Order Journey** for that order and to the **Lineside Monitor** for that line
  (cross-surface nav — see enhancements). No edit controls in the drawer.
- Freshness stamp + STALE banner when data age exceeds the cadence threshold (same honesty as
  lineside, less severe — planning is forward-looking, but "running now" / progress needs fresh data).

## Enhancements (you asked for suggestions — fold these in)
1. **Plan-ghost vs actual on each block** (the projected-overshoot described above) — the single
   most useful read-only signal; prioritise it.
2. **Per-day attainment bar** on each day-column header: planned qty vs actual+projected, coloured by
   variance — answers "are we on plan today?" without reading every block.
3. **Lane idle/utilisation shading**: gaps between blocks shaded as idle capacity; a small per-lane
   utilisation % in the lane meta — surfaces under-loaded lines.
4. **Cross-surface nav (repurpose the freed interaction budget):** block → Order Journey; lane →
   live Lineside Monitor for that line; shortage chip → Shortage Projection. The board becomes the
   planning entry point into the operational surfaces.
5. **"Materials at risk before start" marker:** flag blocks whose staging (WM overlay) won't be
   delivered before scheduled_start (join staging ETA vs scheduled_start) — proactive shortage
   warning on the plan itself.
6. **Date-jump conveniences:** "Today" snap + keyboard ←/→ for prev/next day; week strip you can
   click. Cheap, high-utility for a board people scrub through daily.

(Keep v1 scoped: 1, 2, 4 are high-value/low-cost; 3, 5, 6 are nice-to-have — implement what fits
cleanly, list any deferred.)

## Contracts + OKF + governance
New contract(s) for `vw_consumption_wm_operations_plan_board` (+ any new shapes) in
`app_contract_manifest.yml` with field descriptions, counts as `long`; regenerate contracts + OKF
(`make generate-okf`) in the same PR; add any new gold table to GOLD_TABLES + regenerate ALL security
variants; the wm_operations adapter dir is already registry-registered (deny-by-default guard passes).

## Validation (offline) + acceptance
Same guard battery as spec 08 (determinism, dataset-uniqueness, contract-ids, migration-registry,
okf-fresh), FastAPI route pytest, pnpm typecheck+eslint, PySpark tests for any new gold (status
derivation, date-window filtering done at query-time, line filter, backlog/overdue flags).
Acceptance (orchestrator verifies live): for a real plant+line+date, lanes are lines, blocks sit at
their scheduled times with progress fills and projected-overshoot for running orders; date nav moves
the window (yesterday/tomorrow/today/picker); KPIs reconcile; NO scheduling control exists anywhere;
freshness honest.

## Gotchas
- production_line (CRVER) is the lane key — never resource/work-centre.
- Read-only is absolute: grep the final diff for any onDrag/onDrop/schedule/mutate/POST — there must
  be none.
- changeover/cleaning/maintenance block kinds have no governed source — omit, don't fabricate.
- Date windowing is a query param, not MV-baked (keeps the MV deterministic + Enzyme-friendly).
- Reuses spec 08 objects — branch off `feature/lineside-monitor`; if lineside changes in review,
  rebase. Final merge: lineside first.
- Freshness: a planning board tolerates daily data better than the live monitor, but the progress/
  running-now elements still need the ADR 017 cadence to be truly accurate — stamp it honestly.
