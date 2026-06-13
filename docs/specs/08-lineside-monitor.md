# Spec 08 — Lineside Monitor (PEX-E-35)

Read `docs/specs/_conventions.md` first. Branch: `feature/lineside-monitor`.

## Objective

A **wall-mounted TV display** for a production line — glanceable, unattended, auto-rotating,
no interaction required. One screen per `(plant, process_line)`, configured by URL params so a
fixed display can be pointed at a line and left running. It answers, in rotation: what's running
now, what phase, what's next, what's blocked/at-risk, are materials staged, and are we on plan.

A Claude-Design draft is provided separately (`LineSide Monitor.zip` → `kerry/` JSX + `monitor.css`
+ Kerry fonts/assets). It is the **visual & interaction starting point** — port it into the app
using the existing Kerry design system; this spec describes every panel and its data so the feature
is buildable without the zip. Do NOT ship the draft's mock data (`monitor-data.jsx`) — replace it
with governed queries.

## ⚠ CRITICAL DEPENDENCY — read before estimating

This is a **near-real-time** surface, but the data product currently refreshes on a **daily/triggered
cadence and the scheduled cadence is presently PAUSED** (see ADR 017 + product backlog). A lineside
monitor showing day-old "what's running now" is a demo, not an operational tool. **This feature is
operationally gated on the ADR 017 pilot cadence decision (15-min triggered silver+gold, ideally a
faster sub-cadence for the fast-silver tables that carry operation confirmations / TR-TO).** Build
it now (the data shapes are ready), but the spec, the UI freshness stamp, and the rollout note MUST
be honest that live value depends on that cadence. Surface the actual data age prominently in the
header (the draft already has an "Updated · refresh Ns" slot — drive it from real freshness, not a
fake clock).

## The draft's structure (port this)

- **Header:** Kerry logo, eyebrow `PEX-E-35 · Lineside Monitor`, plant + shift, a clock, a
  data-freshness indicator, a config cog (Shift+C).
- **Six rotating panels** (`PANEL_DEFS`), auto-advancing on a timer; "Blocked/At-Risk" interleaves
  2× when blocks are present:
  1. **Now Running** — orders in execution on this line right now.
  2. **Current Activity** — the current phase/operation per running order.
  3. **What's Next** — upcoming orders for this line, with staging readiness.
  4. **Blocked / At Risk** — what is stopping or threatening progress.
  5. **Staging Readiness** — staged/pick/TR/not-ready distribution.
  6. **Plan vs Actual** — shift attainment.
- **Footer ticker:** blocked count · at-risk count · staged-to-line count · not-ready count.
- **Config panel (cog):** plant, process_line, which panels enabled, rotation seconds, refresh
  seconds. (The draft's generic `tweaks-panel.jsx` edit-mode shell is NOT needed in production —
  replace with a real config panel writing to URL params / localStorage.)
- Kerry design system: `colors_and_type.css`, Noto fonts, the `lsm-*` classes in `monitor.css`,
  `--forest`/`--valentia-slate`/`--sunrise`/`--sunset` tokens. Reuse the existing `.kerry-wm`
  scoping pattern from the wm-operations package.

## Configuration axis (the core requirement)

Everything is filtered by `(plant_code, production_line)`:
- `production_line` is `process_order.production_line` (AUFK CRVER — already carried on
  `gold_wm_order_yield`, `gold_wm_order_journey_summary`, `gold_wm_adherence_*`; VERIFY the alias in
  `silver/tables/process_order.py`). It is the canonical line axis (see the process-line concept:
  line = collection of resources; recipe vocabulary; `PRO_LINE_DES` is an artefact, not the key).
- URL params drive the unattended display: `?workspace=lineside-monitor&plant=C061&line=<CRVER>`
  (or a standalone route mirroring the connected-quality-lab-board standalone). The config cog sets
  the same params for on-screen setup.
- A **lines list** is needed for the picker: distinct `(plant_code, production_line)` with an order
  count / friendly label. Add a small governed view (see Data Layer) — do NOT scrape it client-side.

## Data layer

Most panels reuse existing governed gold. Build the minimum new surface; reuse the rest.

### New (one gold MV + one lookup view)

1. **`gold_wm_lineside_now`** in `gold/wm_operations_gold.py` — order-grain, the "running + current
   phase" surface that no single existing table provides. Grain: plant_code × production_line ×
   order_number for orders **in execution** (released, `actual_finish_date IS NULL`, has at least one
   confirmed operation OR a GR). Columns: order_number, material_code, material_name, batch (if a
   single batch is determinable — else null), `pct_complete` (delivered/planned from
   `gold_wm_order_yield` via dlt.read, guarded 0–100), `planned_minutes`
   (scheduled_finish − scheduled_start), `production_first_actual_start`, current-phase fields:
   `current_operation_number`, `current_operation_description`, `current_activity_type`
   (Run/Setup/etc. — derive from the latest confirmed/in-progress `process_order_operation`; reuse
   the journey OPERATION_CONFIRMED logic — read `gold_wm_order_journey_events`/`_summary` and
   `process_order_operation`). `elapsed_minutes` and `projected_finish` are computed AT QUERY TIME in
   the consumption view (wall-clock rule — NO current_timestamp in the @dlt.table).
   - Plant axis discipline: orders are the axis; drop source-side `plant_code` before order joins
     (the #106 lesson). Verify every column against silver/gold defs.
2. **`vw_consumption_wm_operations_lines`** (+ a tiny gold/agg if needed) — distinct
   (plant_id, line_id, line_label, active_order_count) for the line picker. Source: process_order /
   order_yield grouped by plant_code, production_line. `notRequired`/label handling honest.

### Reuse (existing governed views — confirm columns, do not rebuild)

| Panel | Source |
|---|---|
| 01 Now Running | new `gold_wm_lineside_now` (+ pct from `gold_wm_order_yield`) |
| 02 Current Activity | `gold_wm_lineside_now` current-operation fields (+ `gold_wm_order_operations` if richer) |
| 03 What's Next | `gold_wm_order_readiness` (released/planned, not-started, on the line) ordered by scheduled start; staging status (staged/pick/tr/none) from its TR-coverage fields |
| 04 Blocked / At Risk | `gold_wm_order_readiness` (QUALITY_BLOCKED, not-staged) + `gold_wm_adherence_root_cause` (late = at-risk) + `gold_wm_exceptions` / `gold_wm_order_shortage_projection` (material). Map to the draft's `type`: material / staging / quality / late |
| 05 Staging Readiness | `gold_wm_order_readiness` (or `worklist_summary`) aggregated to the line: staged / pick_complete / tr_created / no_tr / not_required counts |
| 06 Plan vs Actual | `gold_process_order_schedule_adherence` (the repaired MV) + `gold_wm_order_yield`, filtered to line, today/shift: planned vs actual units, % shift elapsed (query-time), variance |
| Footer | aggregates of 04 + 05 |

All consumption views filter by `plant_id` AND `line_id` (production_line) and inherit RLS through
the `_secured`→`_live` chain. Counts are `long` in contracts; query-time bands/elapsed are computed
in the `_live`/consumption layer, never in the base MV.

## Backend

- Routes under the wm_operations adapter, parameterized by `plant` + `line` (and optional `shift`):
  e.g. `GET /api/wm-operations/lineside/now`, `/lineside/next`, `/lineside/blocked`,
  `/lineside/staging`, `/lineside/plan-actual`, `/lineside/lines` (picker). Follow the
  `SIMPLE_DATASETS` pattern where the shape fits; hand-write where a param-filtered spec is needed
  (mirror the lab board's `days`/`plant` param handling — strip/validate params, bind safely).
- Reuse the governed plants endpoint (`/api/wm-operations/plants`) for the plant picker; add the
  lines endpoint for the line picker.
- A combined freshness value (max gold/silver refresh timestamp for the line's sources) for the
  header "Updated" indicator — surface real age, not a clock.

## Frontend

- New view `lineside-monitor` in the wm-operations workspace **and** a standalone unattended route
  (the connected-quality-lab-board standalone is the precedent for a no-chrome wall display).
- Port the draft: rotation engine, six panels, footer ticker, Kerry `lsm-*` styles, CSS-only
  progress bars/shimmer (no chart libs). Replace `monitor-data.jsx` mock with react-query hooks
  per panel; replace the fake `useClock` with the real freshness stamp.
- Config: plant + line selectors (react-query off the plants/lines endpoints — NOT manual fetch),
  panel enable toggles, rotation/refresh seconds; persist to URL params (unattended) + localStorage.
- Conventions: error-branch before empty-state (CI-checked), react-query hooks, useMemo with full
  deps, large-format legible type (it's a TV — verify the draft's sizes hold at 1080p/4K from ~3 m).
- Auto-refresh: poll on the configured interval; show the freshness stamp; if data is older than a
  threshold (e.g. > 2× refresh, or > the cadence interval) show a clear STALE banner — honesty on a
  wall display matters more than anywhere.

## Contracts + OKF

New contracts for the new consumption views (`wm_operations.lineside_now`, `…lineside_lines`, and
any new param-filtered shapes) in `app_contract_manifest.yml` with field descriptions; bump versions;
**regenerate contracts + OKF (`make generate-okf`)** in the same PR (mandate — CI blocks drift).
Add the new gold table(s) to `generate_gold_security_sql.py` GOLD_TABLES and regenerate ALL security
variants (dev/uat/prod strict + harden + dev/uat fixture + open). Register the new `lineside-monitor`
adapter usage so the migration-registry guard (now deny-by-default) passes.

## Validation (offline — no Databricks)

py_compile + ruff on python; `check_gold_mv_determinism.py` (no wall-clock in @dlt.table — bands/elapsed
are query-time); `check_dlt_dataset_names_unique.py`; `check_app_adapter_contract_ids.py`;
`check_app_migration_registry_guard.py`; `check_okf_bundle_fresh.py`; pytest the new routes
(FastAPI, offline); pnpm typecheck + eslint for the frontend package. PySpark tests for
`gold_wm_lineside_now` (running-order selection, current-phase derivation, pct guard, line filter,
null-batch handling) — written for CI (no local JVM).

## Acceptance (orchestrator verifies live post-merge)

- For a real `(plant, line)` (e.g. C061 + a CRVER with active orders), each panel renders governed
  data; running orders show a sane current phase + pct; what's-next ordered by schedule with staging
  status; blocked/at-risk reflect readiness/adherence/shortage; plan-vs-actual ties to the adherence
  MV; footer counts reconcile.
- Header freshness reflects the **real** last refresh; STALE banner triggers when data is old.
- Unattended URL (`?…&plant=&line=`) drives a fixed display with zero interaction.
- Honest scope note in the PR: full operational value requires the ADR 017 cadence (15-min triggered);
  at the current paused/daily cadence the monitor is demonstrable but not live-accurate.

## Gotchas specific to this item

- **Freshness is the whole game** — do not let it ship implying live data on a daily cadence.
- `production_line` is CRVER; a line may have a friendly recipe-derived name but the KEY is the code.
- "Current phase" is the trickiest derivation — there's no single existing table; reuse the journey
  operation-confirmed logic, don't invent a new operations source.
- Multiple concurrent orders per line are expected (the draft models `runningOrders: []`) — the
  grain and UI must handle 0, 1, and N running orders per line.
- Shift windows: the draft hardcodes shifts; if shift-awareness is required, source shift calendar
  (T552A/shift config) — likely NOT replicated, so v1 may treat "today" as the window and flag shift
  bucketing as a follow-up rather than inventing it.
