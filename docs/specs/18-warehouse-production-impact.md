# Spec 18 — Warehouse→Production Impact (WPI) — MVP2

Read `docs/specs/_conventions.md` and `docs/specs/16-operational-risk-foundation.md` first.
Branch: `feature/warehouse-production-impact`. Depends on spec 16 (confidence helper, reason
taxonomy, freshness, `gold_operational_risk_item` — WPI is a warehouse-domain producer into it).

## Objective

Show how warehouse execution (TR/TO ageing, staging completion, material availability) affects
**production-start performance**. Answers: which orders are at risk because materials aren't
staged; which TRs/TOs cause it; how often staging delays starts; which materials/storage-types/
warehouses/lines repeat; and — critically — whether a delay is truly warehouse-caused or only
correlated. Extends spec 04 (adherence root-cause) + readiness + staging-pace; does not rebuild them.

## Grounding (read before coding — verify the real aliases)

`gold/wm_operations_gold.py`: `gold_wm_order_readiness` (staging readiness, component counts),
the staging worklist/pace tables, `gold_wm_order_shortage_projection`, `gold_wm_adherence_root_cause`
(spec 04). `silver/tables/warehouse_flow.py`: `transfer_order` (LTAP/LTBK — TR/TO with creation/
confirmation timestamps + storage types; the `916`-staging signal lives here). `silver/tables/
process_order.py`: scheduled/actual start, `production_line` (recipe-map-enriched). Component
demand: `silver.reservation_requirement` (RESB — required/withdrawn qty, requirement date).

## Design

1. **Gold `gold_wm_production_staging_impact`** — order grain (one row per open process order in a
   horizon): plant_code (axis), process_line, order_number, scheduled_start, material_produced,
   order_qty, components_required, components_staged, fully_staged flag, staging_pct,
   missing_component_count, critical_missing flag. Reuse `gold_wm_order_readiness`; do not
   recompute readiness from scratch. (Time-to-start is query-time.)
2. **Component-grain drill** (WPI-002) — `gold_wm_production_staging_component` (or reuse the
   readiness component grain if it exists): component material, required/staged/open qty, available
   stock, batch, sloc, warehouse, open TR count, open TO count, oldest TR age, oldest TO age,
   staging status. Ages between existing timestamps = deterministic in gold; "as of now" ageing
   classification = query-time.
3. **TR/TO ageing vs production start** (WPI-003, WPI-006): classify Not-due / Due-soon / At-risk /
   Late / Production-impacting / **Unknown**. The novel rule: **rank by production impact, not raw
   age** — impact = function of (time-to-the-order's-scheduled-start, criticality), so a 2h-old TO
   for an order starting in 30m outranks a 24h-old TO for next week. The impact ordering uses
   time-to-start → query-time; the gold carries the inputs (TO age basis, linked order start).
4. **Candidate-warehouse-impact classifier** (WPI-004) — flag a late/projected-late order start as
   *candidate warehouse-caused* when: staging incomplete before scheduled start AND a required
   component has an aged TR / unconfirmed TO AND **no quality hold** explains it AND the order is
   released and otherwise executable. Label `candidate_warehouse_impact` — NOT definitive root
   cause (reuse spec 04's root-cause classes; this refines the "material/staging" class with TR/TO
   evidence). **False-positive exclusions** (WPI-012) — do NOT flag warehouse when the more-likely
   cause is: quality hold, unreleased order, missing production confirmation, line downtime, planned
   schedule change, missing master data, or stale data. Encode exclusions as explicit guards; when
   evidence is insufficient → `Unknown`, not "warehouse".
5. **Line-level aggregation** (WPI-005) — by process_line: orders due-to-start, fully/partially
   staged, critical-missing, avg staging_pct, oldest open TR/TO, projected line-start risk.
6. **Analytics** — recurring-issue counts (WPI-007) by plant/warehouse/storage-type/line/material/
   material-group/shift/order-type/staging-method; time-to-stage durations (WPI-008: release→TR,
   TR→TO, TO→confirmation, confirmation→staged, scheduled-start→actual-start — deterministic
   between timestamps); handoff performance (WPI-009: before/within-tolerance/after start / not
   staged); staging-method visibility (WPI-010: order-specific/consolidated/bulk-drop/dispensary/
   combined/fast-mover/SSCC-HU/**unknown** — derive where determinable, else Unknown).
7. **Confidence** (WPI-011) via the foundation helper: High (order+component+TR/TO+staging all
   linked) / Medium / Low / Unknown.
8. **Risk emission:** the candidate-impact rows feed `gold_operational_risk_item` (domain=warehouse,
   reasons STAGING_INCOMPLETE / TR_AGEING / TO_UNCONFIRMED / MATERIAL_SHORTFALL).

## Backend + Frontend

Consumption views (order-grain impact, component drill, line aggregate, analytics), contracts, OKF,
security/consumption SQL (all variants). View: at-risk-orders table + component-shortfall drill +
line-risk heat strip + recurring-issue/time-to-stage analytics; drill-through to order/TR-TO/quality;
read-only advisory wording; configurable-cadence react-query. Tolerances (due-soon, at-risk, TR/TO
ageing) are configurable per SHD-008.

## Gotchas

- **plant_code axis** (conventions §2): joining order × TR/TO × stock — drop the non-axis side's
  plant before joining (the order's plant is canonical; cross-plant staging exists). This is the
  AMBIGUOUS_REFERENCE class that only surfaces at DLT analysis — get it right offline.
- **"Candidate", not root cause** — the classifier asserts likelihood with evidence, never blame.
  Exclusions must be exhaustive; insufficient evidence → Unknown.
- Time-to-start / ageing-as-of-now / impact-ranking are query-time; durations between fixed
  timestamps are deterministic gold (no `current_*` in `@dlt.table`).
- KAPA capacity gap (backlog §4) means line-capacity inputs may be absent — scope projected
  line-start risk to staging evidence; don't depend on capacity until KAPA lands.

## Acceptance

- Fixture: an order with incomplete staging + aged TO + no quality hold + released → flagged
  `candidate_warehouse_impact`; the SAME order WITH a quality hold → NOT flagged (exclusion fires).
- Impact-ranking test: short-time-to-start young TO outranks old TO for a far-future order.
- Time-to-stage durations reconcile by hand on a fixture; confidence levels correct per linkage.
- `tests/golden/wpi.md`. Determinism guard passes; read-only; no destructive change to readiness.
