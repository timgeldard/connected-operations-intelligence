# Product Backlog — Connected Operations Intelligence

> **Maintenance rule:** this document is the single source of truth for the development
> queue, agreed with the product owner (Tim Geldard). It must be updated in the same PR
> as any change that ships, parks, or reprioritises an item. Status date is below; if the
> status date is stale relative to recent merges, treat git history as authoritative and
> update this file.
>
> **Knowledge & documentation mandate:** any change to the data contracts
> (`app_contract_manifest.yml`) or the data product's governed surface MUST be
> accompanied in the same PR by (a) updated documentation and (b) a regenerated OKF
> bundle (`make generate-okf`); CI (`check_okf_bundle_fresh.py`) blocks drift.

**Status date:** 2026-06-13

---

## 1. Accepted development queue — ALL SHIPPED 2026-06-13

Items 1–7 (spec'd in `docs/specs/`) were built spec→agent→review→merge and rolled out to
UAT 2026-06-13 (app live 09:23 UTC): data bundle deployed, reference+gold pipelines run,
secured/serving/consumption/metadata SQL applied, app two-step deployed. Expiry confirmed
on real MCH1 data (`gold_wm_expiry_risk` 99.5% expiry_date populated).

| # | Item | Status |
|---|------|--------|
| 1 | Worklist: TO priority scoring | SHIPPED (#133) |
| 2 | Campaigns: recipe benchmarking | SHIPPED (#134) |
| 3 | Expiry & shelf-life risk (MCH1 `batch_master`) | SHIPPED (#141) |
| 4 | Production Progress: adherence repair + root-cause | SHIPPED (#136) |
| 5 | Shortage projection board | SHIPPED (#139) — runtime `material_code` ambiguity fixed post-merge (#145) |
| 6 | Readiness: quality-release dimension | SHIPPED (#138) |
| 7 | QM Command Centre: characteristic drill | SHIPPED (#137) — data C351-only until QAMR stall clears |

## 1b. Architecture-review remediation (from docs/review/architecture_review_report.md, assessed 2026-06-13)

Orchestrator assessment of the external review: agreed items below; **rejected as stale**:
R1 "missing `/cq/lab/plants` (P0)" — overstated, active picker uses the working
`/api/wm-operations/plants`, only a dead legacy path hits 404 (→ Phase 0 cleanup); R8
"envmon broken tab" — false, envmon-consumer is intentionally mock-only.

- **Phase 0 (in flight, `chore/arch-review-phase0`):** R2 migration-registry guard → deny-by-default
  (scan all `apps/api/adapters/*`, fail on unregistered) + register quality_lab/wm_operations;
  R1 remove dead `useConnectedQualityLabPlants`/`/cq/lab/plants` path; R8 trim any dangling
  di-envmon-*monitoring* build alias (leave envmon-consumer).
- **Phase 1 — hardening:** R6 data-bundle deploy path is user-scoped (`/Workspace/Users/<me>/...`) —
  move UAT/prod to a CI/CD service-principal `/Workspace/Deployments/` path; R5 integration-test
  baseline (FastAPI route ↔ mocked Statement API) then incremental E2E; R7 verify+fix outbound
  delivery header-delete anti-join (orphaned items).
- **Phase 2 — product/governance:** R4a align `quality_lab` adapter to `resolve_contract_object`
  (cheap — contract + consumption view already exist); R3 replace `RoleAwareHome` mock widgets with
  live consumption-view-backed routes.
- **Phase 3 — roadmap:** R4b contract-govern trace2/spc/poh/cq (large; per-domain sequencing).

## 1c. Operational Intelligence Risk Suite (ACCEPTED 2026-06-13 — specs 16–20)

A four-capability program for cross-domain operational risk, requested by the product owner.
Specs in `docs/specs/`. **Largely a composition layer over existing gold** (readiness,
adherence-root-cause, shortage-projection, QM lot/UD, journey, lineside, expiry, delivery) plus
four genuinely-new shared primitives. All read-only/advisory; Unknown is a first-class state.

| # | Spec | Capability | Reuses / overlaps |
|---|------|-----------|-------------------|
| 16 | `16-operational-risk-foundation` | **Foundation** (keystone — build first): `OperationalRiskItem` contract, reason taxonomy, evidence-confidence framework, per-domain freshness service (extends `gold/freshness.py`), read-only wording guard, UTC date util | all of the below |
| 17 | `17-operational-risk-cockpit` | **ORC** — next-24h cross-domain risk worklist, severity, domain grouping, freshness, drill-through, shift handover | subsumes parked *exceptions-triage*; unions all domain producers |
| 18 | `18-warehouse-production-impact` | **WPI** — staging readiness → production-start risk; candidate-warehouse-impact classifier; recurring-issue + time-to-stage analytics | extends spec 04 root-cause + readiness + staging-pace |
| 19 | `19-plan-adherence-delay-reasons` | **PAD** — line plan-vs-actual, late-start/finish, delay-reason inference + Pareto, plan volatility, previous-order dependency | extends spec 09 planning board + spec 04 + `gold_process_order_schedule_adherence` |
| 20 | `20-quality-release-ageing` | **QRS** — quality-hold ageing queue, block-reason, UD analytics, service/customer + production exposure, conservative language | extends spec 06 readiness-QM + spec 07 QM Command Centre + spec 03 expiry |

**MVP phasing** (product owner's §6): MVP1 = ORC foundation (worklist/severity/domain/freshness/
drill-through, no predictive scoring); MVP2 = WPI; MVP3 = PAD; MVP4 = QRS. Foundation (16) gates
all four.

**The 10 first epics** (product owner's §7) map to the specs as: E1 cross-domain risk object model
+ E2 reason taxonomy + E7 evidence-confidence + E8 freshness service + E10 read-only guardrails →
**spec 16 (Foundation)**; E3 next-24h cockpit → **spec 17**; E4 staging-readiness contract →
**spec 18**; E5 plan-adherence contract → **spec 19**; E6 quality-hold impact contract → **spec
20**; E9 UAT golden scenario pack → per-capability `tests/golden/` deliverable in each spec.

**Dependencies / sequencing:** 16 → then 17 (needs the union MV) → 18/19/20 can proceed in
parallel after 16 (each is an independent domain producer + view). Blocked-data caveats inherited:
QRS MIC-result depth limited by the QAMR stall (§4); WPI capacity/line-scheduling needs the KAPA
gap closed (§4); PAD plan-volatility needs schedule-change history if source carries it.

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
pipeline observability dashboard (durations/freshness/cost) · supplier quality scorecard ·
Order Journey stage-SLA overlays · Staging Pace bulk-drop-log upgrade (`ZWMA_BULK_DROP_TO_LOG`).

> Promoted out of parked: PI & cycle-count analytics, Trends baseline bands, plant-onboarding
> tooling (now specs 10–12, built). Exceptions-triage workflow's *read* side is subsumed by the
> Operational Risk Cockpit (§1c spec 17); the ack/snooze state-store remains a separate future item.

## 4. Blocked on external parties

| Blocker | Impact | Owner |
|---|---|---|
| **QAMR replication stalled** — C061+P817 since 2026-03-25, P806 since 2026-04-20 (only C351 current; QAMV is fine) | Lab Board beyond C351; item 7; any MIC-result consumer | Aecorsoft / ingestion team (escalation raised by product owner) |
| `traceability-readers` UC group not provisioned (UAT) | Real-user access to trace edge/event-ledger/vendor objects | Platform team |
| `users` group + corporate `security.model` entitlements | Consumer-agnostic access (Power BI / Genie / dashboards) to `_secured` views | Platform team |
| Site lifecycle business review (`site_lifecycle_review.csv`) | Anchorable-plant scope for Final Trace; SOLD/DIVESTED exclusions only activate on explicit confirmation | Business / plant teams |
| QM sources not replicated to DEV | DEV parity for quality features | Ingestion team |
| KAPA replication gap — `shiftparametersavailablecapacity_kapa` missing DAFBI/DAFEI (review R9) | `silver.capacity_utilisation` disabled; adherence CAPACITY class + future line-scheduling have no data | Aecorsoft / ingestion team |
| `warehouse360_app_users` group + prod `published_prod.security.model` entitlements (review R10) | Prod RLS verification / prod cutover | Platform team |

## 5. Strategic / scheduled items

- **Refresh cadence / factory-floor latency path — see ADR 017** (decided 2026-06-12 after
  external-review convergence): Enzyme-managed MVs, silver/gold cadence coupled, pilot
  cutover = 15-min triggered + chained gold; sequencing gates: quiet-day Enzyme fallback
  report → pilot SLA definition → cadence change. Maintenance regime: Predictive
  Optimization (pending enablement approval).
- `reservation_requirement` size investigation (4.33 GB ≈ 747 B/row across 25 cols;
  OPTIMIZE and REORG PURGE both no-ops — structural/encoding cause suspected; low priority,
  liquid clustering bounds per-query scans). See ADR 017 §6.
- **Pipelines quiesced 2026-06-13:** Refresh Cadence job (`313093032786158`) PAUSED on
  instruction; all pipelines manual-trigger-only, nothing scheduled incurs cost. The
  cost-observation baseline window ended here. Re-unpause that job to resume the daily cadence.
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
