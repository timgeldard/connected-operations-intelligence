# Spec 17 — Operational Risk Cockpit (ORC) — MVP1

Read `docs/specs/_conventions.md` and `docs/specs/16-operational-risk-foundation.md` first.
Branch: `feature/operational-risk-cockpit`. **Depends on spec 16** (the `gold_operational_risk_item`
union MV, reason taxonomy, evidence-confidence helper, freshness service, wording guard, UTC util).

## Objective

A read-only **"next 24 hours at risk"** cockpit spanning production, warehouse, quality, logistics,
and data-trust. Answers: what's at risk, what to action first, why (which domain), which
orders/deliveries/batches/materials/customers, is the data current, and who acts. It is an
**aggregation + presentation layer over `gold_operational_risk_item`** (spec 16) — it adds almost
no new gold, only the cockpit serving view (time-relative fields), the prioritisation-score
expression, role filters, and the frontend.

## Design

1. **Gold:** none new beyond spec 16, EXCEPT a thin `gold_operational_risk_score_inputs` only if
   the prioritisation inputs aren't already on `gold_operational_risk_item` — prefer putting the
   deterministic score *inputs* (impact magnitudes, evidence confidence, risk age basis) directly
   on the union MV in spec 16 and computing the *blended score* query-time (it mixes time-to-event,
   which is wall-clock). Do not duplicate the union.
2. **Consumption / `_live` view** `vw_consumption_operational_risk_cockpit` over
   `gold_operational_risk_item` (and `vw_consumption_data_freshness`), computing the time-relative
   fields (convention §4 — these CANNOT live in gold):
   - `time_remaining` = `planned_event_at − current_timestamp()`.
   - **Horizon filter** (ORC-001): a query parameter selecting next-4h/8h/24h/today/tomorrow/custom;
     default **24h**. Bind/validate the window (ISO; reject malformed → 422).
   - **Effective severity** = `base_severity` (from gold, evidence-only) escalated when
     `time_remaining` is short (e.g. a High due in <1h → Critical). The escalation rule is
     configurable (SHD-008). **Never downgrade to Low on missing evidence** — `Unknown` stays
     `Unknown` (carried from gold; ORC-003).
   - **Prioritisation score** (ORC-006, EXPLAINABLE): a weighted blend of time-to-event,
     operational/customer/line/quality-food-safety impact, qty affected, #orders/#deliveries,
     evidence confidence, and risk age. Surface the **component contributions** alongside the
     total (the view returns each weighted term, not just the score) so the UI can show "why this
     ranks here". Weights configurable.
3. **Domain summary** (ORC-002): grouped counts by `risk_domain` (production/warehouse/quality/
   logistics/data_trust) with severity breakdown — a `GROUP BY risk_domain, effective_severity`
   over the filtered view.
4. **Data-Trust** (ORC-009/010): the cockpit reads `vw_consumption_data_freshness` for the
   per-domain freshness banner, and surfaces the `STALE_SOURCE` risk rows the foundation emits
   into the union ("Warehouse TO data is 87 min old; staging risk may be understated").
5. **Risk trend** (ORC-011): increasing/decreasing vs 1h-ago / start-of-shift / same-time-yesterday
   / weekday baseline. HONEST CAVEAT: this needs a time-series of risk counts. v1 ships the
   feasible baselines from data we retain (same-time-yesterday / weekday baseline are derivable if
   `gold_operational_risk_item` is snapshotted, or via the underlying source dates); if a true
   "1h-ago" snapshot isn't retained, scope it out and say so rather than fake it. Flag any snapshot
   table needed as a follow-on.
6. **Shift-handover mode** (ORC-012) + export (SHD-010): a filtered projection (open criticals,
   new-this-shift, resolved-this-shift, ageing-beyond-SLA, stale warnings, advisory next actions),
   copy/export to text.

## Backend + Frontend

- Routes under the wm_operations (or a new `operations`) adapter: `/api/.../risk-cockpit` (worklist,
  horizon+role params), `/risk-cockpit/summary` (domain×severity), `/risk-cockpit/handover`,
  `/risk-cockpit/freshness`. Validate/bind params. SIMPLE_DATASETS where shape fits.
- **Role default filters** (ORC-008): Plant Mgr = all criticals; Warehouse Mgr = warehouse domain;
  Production Supervisor = production; Planner = production+warehouse readiness; Quality Lead =
  quality; Logistics Lead = logistics. A `role` param sets the default domain/severity emphasis
  (the data is the same governed view; this is presentation default, not RLS).
- View: a worklist table (sortable by score/severity/time-remaining) with the ORC-005 fields, a
  domain-summary strip, a freshness banner, the explainable-score popover (component breakdown),
  drill-through deep links (ORC-007 — reuse journey/order/delivery patterns, SHD-005), and a
  handover panel. Error-branch-before-empty-state; react-query with the **configurable
  refresh-cadence** pattern (`staleTime=refetchInterval=<const>`, `refetchOnWindowFocus:false`).
- **Read-only/advisory wording only** (ORC-013/SHD-006) — the foundation wording guard enforces it.

## Gotchas

- Determinism split is the crux: base_severity / score-inputs / reason / confidence in gold;
  time_remaining / horizon / effective-severity-escalation / blended-score query-time. The
  determinism guard must pass on any gold touched.
- **Unknown is first-class** — a missing-evidence risk shows `Unknown` severity, never Low/OK.
- Plant + role RLS via the existing `_secured`→`_live`→consumption pattern (SHD-001).
- Don't rebuild domain producers — the cockpit is downstream of `gold_operational_risk_item`.

## Acceptance

- Fixture: a risk row with missing evidence renders `Unknown` (severity + confidence), never Low.
- Horizon filter is query-time (no `current_*` in gold); default 24h; custom window validated.
- The prioritisation score returns its component contributions (explainability) — a test asserts
  the components sum to the total under the configured weights.
- Domain summary counts reconcile to the worklist; freshness banner reflects
  `vw_consumption_data_freshness`; a stale domain produces a Data-Trust row.
- `tests/golden/orc.md`: golden plant/order/batch/delivery with expected domain, severity, primary
  reason, responsible function (orchestrator runs live post-merge).
- No prohibited action wording (guard passes); read-only.
