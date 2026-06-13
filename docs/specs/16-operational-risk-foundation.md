# Spec 16 — Operational Intelligence Foundation (shared primitives)

Read `docs/specs/_conventions.md` first. Branch: `feature/op-risk-foundation`.

This is the **keystone** for specs 17–20 (Operational Risk Cockpit, Warehouse→Production
Impact, Plan Adherence, Quality Release Ageing). It defines the four shared primitives those
capabilities consume. Build this FIRST; the capability specs depend on its contracts. It maps
the product owner's SHD-001…SHD-010 shared requirements + the cross-cutting ORC items
(reason taxonomy, severity, confidence, freshness) onto this repo's medallion + governed-serving
architecture.

## Design principle

These capabilities are a **composition / orchestration layer over gold that largely already
exists** (readiness, adherence root-cause, shortage projection, QM lot/UD, journey, lineside,
expiry, delivery). Do NOT rebuild those. The genuinely new work is the four primitives below
plus the per-capability aggregators (specs 17–20).

## Primitive 1 — `OperationalRiskItem` contract (the unified risk grain)

A single canonical risk row shape that every domain emits, so the cockpit (spec 17) can union
them and the other capabilities can reuse the taxonomy. Implement as a **gold view/MV**
`gold_operational_risk_item` that UNIONs ALL domain risk producers, each projecting to this
exact schema. Source producers (each is an existing gold table, filtered to its risk rows):

| domain | producer (existing gold) | risk rows |
|---|---|---|
| production | `gold_wm_adherence_root_cause`, `gold_process_order_schedule_adherence` | late/projected-late starts & finishes |
| warehouse | `gold_wm_order_readiness`, staging-pace, `gold_wm_order_shortage_projection` | staging shortfall, aged TR/TO, projected-short |
| quality | `gold_wm_qm_lot_status` (+ readiness QM dimension) | held/unreleased lots, missing UD |
| logistics | `gold_delivery_pick_status` / outbound delivery gold | at-risk OBD, missed PGI, incomplete pick |
| data_trust | Primitive 4 (freshness) | stale source beyond threshold |

Canonical columns (counts `long`; see conventions §6):
`risk_id` (deterministic hash of domain+object key+reason — stable across runs, NO wall-clock),
`risk_domain` (enum: production/warehouse/quality/logistics/data_trust),
`plant_code` (canonical axis), `process_line`, `order_number`, `material_code`, `batch_number`,
`delivery_number`, `customer_id`, `planned_event_at` (the deadline timestamp — e.g. scheduled
start, planned GI, UD-due), `current_status`, `primary_reason_code` (Primitive 2),
`secondary_reason_codes` (array), `responsible_function`, `evidence_confidence` (Primitive 3),
`base_severity` (evidence-only severity, deterministic — see §below), plus the impact-scoring
inputs (`stock_qty_affected`, `orders_affected`, `deliveries_affected`, `customer_impact_flag`,
`food_safety_flag`).

**Determinism split (conventions §4 — this is the crux):**
- GOLD MV holds everything that's a function of the data only: reason, base_severity (from
  evidence, NOT time), confidence, the impact inputs, `planned_event_at`. `risk_id` is a hash
  — deterministic, NO `current_*`.
- QUERY-TIME (consumption/`_live` view) holds everything relative to *now*: `time_remaining`
  (planned_event_at − now), the horizon filter (next 4h/8h/24h/today/tomorrow — ORC-001), and
  the **time-escalated severity** (base_severity escalated when time_remaining is short). So
  `gold_operational_risk_item` is deterministic; `vw_consumption_..._operational_risk_live`
  computes time-relative fields.

`base_severity` enum: Critical / High / Medium / Low / **Unknown**. Rule (ORC-003): **never
emit Low when evidence is missing — emit Unknown.** Encode this in the severity CASE: a branch
with insufficient evidence → `Unknown`, never falls through to Low.

## Primitive 2 — Risk reason taxonomy (canonical, configurable)

A single canonical set of reason codes shared across domains (ORC-004, WPI/PAD/QRS reason lists,
SHD-008). Implement as a small **reference table** `gold_risk_reason_taxonomy` (code, domain,
label, default_responsible_function, default_severity_hint) seeded from a checked-in config
(mirror the `site_config_plant.csv` single-source pattern — config file + a CI parity guard, NOT
a hardcoded dict in two places). Codes must cover at minimum the union of the product owner's
lists: `MATERIAL_SHORTFALL, STAGING_INCOMPLETE, TR_AGEING, TO_UNCONFIRMED, ORDER_NOT_STARTED,
PRODUCTION_BEHIND_PLAN, QUALITY_HOLD, INSPECTION_LOT_OPEN, UD_MISSING, MIC_RESULT_MISSING,
MIC_RESULT_FAILED, OUTBOUND_PICK_INCOMPLETE, DELIVERY_PAST_GI, PREVIOUS_ORDER_OVERRUN,
SCHEDULE_CHANGED, STALE_SOURCE, MISSING_MAPPING, UNKNOWN`. Mappings configurable (SHD-008) — the
config file is the tunable surface; reason→responsible_function and reason→severity_hint live
there.

## Primitive 3 — Evidence-confidence framework

A shared, reusable derivation of `evidence_confidence` ∈ {High, Medium, Low, **Unknown**}
(SHD-004 — Unknown is first-class, never collapsed to OK/zero/Low). Define a single helper
(PySpark column expression in `gold/` shared module, e.g. `gold/risk_common.py`) parameterised
by "which evidence links are present" so every capability scores identically:
- High = all expected linkages present (e.g. order+component+TR/TO+staging for WPI; lot+batch+
  stock+UD+MIC+impact for QRS).
- Medium = primary linkage present, detail/impact partial.
- Low = partial linkage only.
- Unknown = missing data prevents assessment (and forces `base_severity=Unknown`, not Low).
Provide it as a function the capability gold tables call, so confidence semantics are uniform.

## Primitive 4 — Data-freshness service (per-domain, configurable thresholds)

**Partly exists — extend, don't rebuild.** `gold/freshness.py` already defines per-table
freshness with SLA minutes + watermark (outbound_delivery 480, purchase_order 1440, …). Extend it
to:
- Group tables into the SHD-003 domains (warehouse TR/TO, process orders, quality lots/results,
  deliveries, stock, traceability) with **configurable warning/critical thresholds per domain**
  (config-driven, not hardcoded — SHD-003/SHD-008).
- Expose a consumption view `vw_consumption_data_freshness` (domain, last_refresh_at,
  age_minutes computed query-time, status warning/critical/ok) the cockpits read (ORC-009).
- Surface a **Data Trust risk row** when a domain is stale beyond critical (ORC-010,
  `STALE_SOURCE` reason) — "Warehouse TO data is 87 min old; staging risk may be understated."
  **Determinism reconciliation:** the staleness test is query-time (`now − last_refresh`), so
  these Data-Trust rows are NOT materialised into the deterministic `gold_operational_risk_item`
  MV. The gold freshness table stores only the `last_refresh` watermark (deterministic); the age
  comparison AND the data-trust row's emission both live in the `_live`/consumption layer. The
  cockpit's risk feed is therefore: **the deterministic gold union MV (evidence-derived domain
  rows) UNIONed at the view layer with the query-time data-trust rows.** (This keeps Primitive 1's
  MV purely evidence-derived — the `data_trust` arm is the one producer that joins in query-time,
  not in gold.)

## Shared conventions (apply to all of specs 17–20)

- **SHD-001 Plant + role RLS:** reuse the existing two-tier `_secured`→`_live`→`vw_consumption_*`
  pattern; every new gold table goes through `GOLD_TABLES` + the security generator (ALL variants).
- **SHD-006 / ORC-013 read-only advisory wording:** these are read-only. Add a CI **wording
  guard** (`scripts/ci/check_advisory_wording.py`, sibling to the route-model guard) that scans
  the new views' frontend for prohibited action verbs in risk/quality contexts ("Release",
  "Approve", "Confirm TO", "Reschedule", "Safe to ship", "Cleared") and fails the build; only
  advisory phrasing allowed ("Investigate…", "Review…", "Contact…", "Quality evidence pending").
- **SHD-002 evidence panel:** each capability view renders an evidence panel (source object, last
  refresh, confidence, row count, assumptions, limitations) — a shared component.
- **SHD-005 drill-through consistency:** reuse the existing journey/order/delivery deep-link
  patterns for the common objects (plant/line/order/material/batch/lot/delivery/customer/TR/TO).
- **SHD-007 auditability:** evidence views accessed in quality/trace contexts must be queryable
  through the governed serving layer (which already carries user identity); note any audit-log
  requirement as a follow-on if write-side logging is needed (out of scope for read-only v1).
- **SHD-009 UAT golden packs:** each capability ships a `tests/golden/<capability>.md` naming
  golden plants/orders/batches/deliveries + expected risk/severity/reason/quality outcomes for
  post-merge live validation (the orchestrator runs them; offline tests use fixtures).
- **Timezone governance (PAD-014, and applies broadly):** plant-local for display, canonical
  UTC for storage/computation, explicit conversion, tests for multi-timezone plants. Frontend
  date math MUST be UTC-safe (parse parts → Date.UTC), per the bug class fixed in the trends +
  planning-board reviews — bake into the shared date util.

## Build order / deliverables

1. `gold/risk_common.py` (confidence helper + reason-code constants loader + severity rule).
2. `gold_risk_reason_taxonomy` (reference table) + its config file + CI parity guard.
3. Extend `gold/freshness.py` → domain grouping + `vw_consumption_data_freshness` + Data-Trust
   risk emission.
4. `gold_operational_risk_item` (the UNION MV) + `vw_consumption_..._operational_risk_live`
   (time-relative fields).  NOTE: this can ship with a SUBSET of domain producers and grow as
   specs 17–20 land — build it so a domain producer is a pluggable UNION arm.
5. Contracts (manifest) + OKF + security/consumption SQL (all variants) per house pattern.
6. The advisory-wording CI guard + the shared evidence-panel + UTC date util (frontend shared).

## Acceptance

- `gold_operational_risk_item` is deterministic (determinism guard passes); all time-relative
  logic is in the `_live`/consumption view. Unknown is emitted (never Low) when evidence absent —
  fixture tests prove a missing-evidence row scores `Unknown`/`Unknown`, not `Low`/`High`.
- Reason taxonomy config ↔ table parity guard passes; confidence helper unit-tested for all four
  levels. Freshness view returns sane per-domain ages; a stale domain emits a `STALE_SOURCE` risk.
- Wording guard fails on a planted "Release batch" string and passes on advisory phrasing.
- No existing gold/contract is mutated destructively; everything additive (regression-safe).
