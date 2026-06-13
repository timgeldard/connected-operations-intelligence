# Product Backlog — Connected Operations Intelligence

> **Maintenance rule:** this document is the single source of truth for the development
> queue, agreed with the product owner (Tim Geldard). It must be updated in the same PR
> as any change that ships, parks, or reprioritises an item. Status date is below; if the
> status date is stale relative to recent merges, treat git history as authoritative and
> update this file.

**Status date:** 2026-06-12 (evening)

---

## 1. Accepted development queue

Items the product owner has explicitly accepted, in suggested execution order.
Specs for coding agents live in `docs/specs/` (one file per item, same numbering).

| # | Item | Type | Status / notes |
|---|------|------|----------------|
| 1 | **Worklist: TO priority scoring** — rank worklist TOs by demand-wave urgency (staging-pace demand model computes the wave) instead of creation order | Extension | Ready — cheap, builds on staging-pace gold |
| 2 | **Campaigns: recipe benchmarking** — duration/yield distribution across runs of the same recipe/process line | Extension | Ready — reuses `gold_wm_order_yield`; process-line axis on `process_order.production_line` |
| 3 | **Expiry & shelf-life risk** — stock value at risk by expiry horizon, estate-wide FEFO-violation detection, write-off forecasting | New build | In review — `feature/expiry-shelf-life-risk` |
| 4 | **Production Progress: adherence root-cause tagging** — classify misses (late release / material short / capacity) | Extension | **Prerequisite:** investigate why `gold_process_order_schedule_adherence` is empty at gold level (S-curve currently renders empty state) |
| 5 | **Shortage projection board** — forward-looking readiness: open orders vs stock vs inbound, projecting *when* an order goes short | New build | Ready |
| 6 | **Readiness: quality-release dimension** — component batch QM release status joined into readiness bands | Extension | Ready — QM lot/UD silver is estate-wide since ADR 016 §4 widening (2026-06-12) |
| 7 | **QM Command Centre: characteristic-level drill** — MIC results Pareto + UD-code analytics from QAMR/QASR | Extension | **Gated:** QAMR replication stall limits data to C351 until resolved (see §4) |

## 2. Trace track (Final Trace migration, ADR 016)

- ~~Phase 2 — governed fan-out switchover~~ **SHIPPED 2026-06-12** (PR #129).
- **Phase 3 — governed lookups** (PR open: `feature/trace-governed-lookups`):
  `gold_trace_material` / `gold_trace_plant` / `gold_trace_batch_material` + adapter
  switchover. Post-merge: deploy + gold run + capability grants.
- **Phase 4 — remaining legacy views (corrected inventory, 3 not 1):**
  `gold_batch_delivery_v` (customer panel) and `gold_batch_production_history_v`
  (production history) need governed derivations (plausibly from the event ledger);
  `gold_batch_quality_result_v` (CoA panel, 345M-row legacy estate view) awaits a product
  decision — governed result-grain is plant-gated, so options are: accept gated scope /
  widen result grain / retire the panel.
- **Legacy `gold` schema retirement** — after Phase 4 + confirmation that no external
  consumer (Power BI etc.) reads the legacy views. Legacy 168M-edge
  `gold.gold_batch_lineage` is already unread by the app.
- MCH1 (batch master) is now represented in the source catalogue as `crossplantbatch_mch1`;
  queue item 3 uses it behind a guarded `silver.batch_master` definition.
- ADR 016 rename: Final Trace mount (`traceability-workspace`) → workspace id `trace`
  (unblocked by the legacy `trace` workspace decommission).
- Batch passport surface; i18n phases; trace2 parity leftovers (B1 customer/delivery tables,
  B2 supplier table, B4 cross-workspace drill-through, C1–C5).

## 3. Parked proposals (not accepted — promote explicitly)

KPI alerting service (email/Teams thresholds on gold KPIs) · master-data quality monitor ·
governed Genie space · mock-recall drill mode (timed trace exercise for BRC/FSMA) ·
pipeline observability dashboard (durations/freshness/cost) · PI & cycle-count analytics ·
supplier quality scorecard · Order Journey stage-SLA overlays · exceptions triage workflow
(ack/snooze, needs state store) · Staging Pace bulk-drop-log upgrade (`ZWMA_BULK_DROP_TO_LOG`)
· Trends baseline bands · plant-onboarding tooling.

## 4. Blocked on external parties

| Blocker | Impact | Owner |
|---|---|---|
| **QAMR replication stalled** — C061+P817 since 2026-03-25, P806 since 2026-04-20 (only C351 current; QAMV is fine) | Lab Board beyond C351; item 7; any MIC-result consumer | Aecorsoft / ingestion team (escalation raised by product owner) |
| `traceability-readers` UC group not provisioned (UAT) | Real-user access to trace edge/event-ledger/vendor objects | Platform team |
| `users` group + corporate `security.model` entitlements | Consumer-agnostic access (Power BI / Genie / dashboards) to `_secured` views | Platform team |
| Site lifecycle business review (`site_lifecycle_review.csv`) | Anchorable-plant scope for Final Trace; SOLD/DIVESTED exclusions only activate on explicit confirmation | Business / plant teams |
| QM sources not replicated to DEV | DEV parity for quality features | Ingestion team |

## 5. Strategic / scheduled items

- **Refresh cadence / factory-floor latency path — see ADR 017** (decided 2026-06-12 after
  external-review convergence): Enzyme-managed MVs, silver/gold cadence coupled, pilot
  cutover = 15-min triggered + chained gold; sequencing gates: quiet-day Enzyme fallback
  report → pilot SLA definition → cadence change. Maintenance regime: Predictive
  Optimization (pending enablement approval).
- `reservation_requirement` size investigation (4.33 GB ≈ 747 B/row across 25 cols;
  OPTIMIZE and REORG PURGE both no-ops — structural/encoding cause suspected; low priority,
  liquid clustering bounds per-query scans). See ADR 017 §6.
- **WH360 Gate C / prod cutover** (Gates A & B passed).
- **SPC Phase 1 merge** — held until the cost-observation window completes. Data point
  2026-06-12: the lab-board 5-year QAMR materialisation ran in ~3 min wall-clock on the
  quality pipeline (plant-gated, pushdown effective) — encouraging for SPC scan costs.
- Security-mode drift guard — something applied strict-CSM secured views over the UAT
  fixture mode unnoticed (2026-06-12 incident, blanked the app); add a CI/runbook check.
- Post-deploy smoke checklist must include consumption-view queries (not just gold tables)
  — second 2026-06-12 incident class (views never applied / contracts missing).

## 6. Recently shipped (context)

**2026-06-12** (PRs #109–#126): T3 trace anchor MV + governed batch-search/trace-graph cutover;
Yield & Loss view; QM Lab Board migrated to governed model (then: 5-year window, ALL/360/180/30
day filter, plant picker); six legacy workspaces decommissioned (~18k LOC); single contract
manifest (data-products copy is the only source; apps/api copy is a deploy artefact) + id/column
CI guards; UC contract metadata publication (view/column comments + tags from the manifest);
QM lot/UD gate widened to trace-relevant estate (ADR 016 §4); trace Phase 1 governed foundations
(`gold_batch_event_ledger`, `gold_batch_stock_summary`, `gold_trace_vendor`).
