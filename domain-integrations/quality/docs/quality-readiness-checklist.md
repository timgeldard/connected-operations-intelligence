# Quality Batch Release Production Readiness Checklist

**Domain:** `domain-integrations/quality`
**Last updated:** 2026-05-21 (UX hardening 2026-05-21)
**Purpose:** Gate criteria that must be satisfied before the quality batch release cockpit is used for real release decisions or operational coordination.

Status key: ✅ Done · 🔶 Partial / in progress · ❌ Not done · ⬜ Not applicable

---

## 1. Correctness

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 1.1 | Integration status banner visible on all views | ✅ | Renders `VerificationStatusBanner` in `BatchReleaseWorkspace.tsx` showing hybrid integration mode. |
| 1.2 | Advisory tone enforced in all alerts/warnings | ✅ | Footnotes added to summary, deviations, results, and CoA readiness panels to clarify that release actions are simulated and data is read-only. |
| 1.3 | Mixed-mode execution boundaries clearly defined | ✅ | Only Lab Board views are mapped to legacy V1 APIs; all other panels are simulated via mock adapters. |
| 1.4 | Null or missing data does not mask active defect status | ✅ | If an adapter fails or returns an error result, the wrapper `EvidencePanel` handles the error/loading states and does not assume a passing default. |

---

## 2. Evidence Quality

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 2.1 | Data source attribution (mock vs. legacy API) returned by all adapters | ✅ | All quality adapters explicitly return `source: 'mock'` on mock paths and `source: 'legacy-api'` on legacy paths. |
| 2.2 | Data source attribution visible in UI | ✅ | All 9 panels forward the `source` prop from the query hook results to `<EvidencePanel>` to render dynamic source badges. |
| 2.3 | Freshness policies declared and respected | 🔶 | Freshness policy declared in panel registrations; underlying SAP QM / CoA / usage-decision data freshness is not validated for mock release panels and live freshness is not surfaced. |
| 2.4 | Databricks source verification pack ready | ✅ | `quality-databricks-source-verification.md` provides the broad object inventory, DESCRIBE, grain, usage-decision, MIC/result/specification, CoA-like, deviation, and golden-candidate checks. A dedicated QM usage-decision verification pack (`qm-usage-decision-source-verification.md`) adds usage-decision-specific grain, join-key, code-semantics, and cross-domain consumption plans. **QM usage-decision verification complete (2026-05-21):** object `gold_inspection_usage_decision` schema (13 cols) + grain (`INSPECTION_LOT_ID` + `USAGE_DECISION_COUNTER`, 0 duplicates in 15.47M rows) + join keys (→ `gold_inspection_lot` → material/batch/plant) verified via Databricks CLI. 9 distinct codes captured: A (90.3%), AE (7.5%), AC (1.2%), R (0.6%), ACE, RE, A9, RR, '' empty (269 rows). UAT candidate (20052009 / 0008602411 / C061) confirmed. **Governance gate ACTIVE:** code-to-release-status mapping must be confirmed in writing by Kerry QM process owner before any accepted/released/rejected display. |
| 2.5 | Read-only evidence contracts designed | ✅ | `QualityEvidenceRequest`, inspection lot, MIC result, usage decision, CoA-like result, and summary contracts exist in `@connectio/data-contracts`; they do not include release approval or can-release fields. |
| 2.6 | Quality/SPC MIC boundary documented | ✅ | `quality-spc-shared-mic-evidence.md` separates Quality specification/valuation/usage-decision evidence from SPC control limits, rule signals, and control status. |
| 2.7 | Read-only evidence adapter skeleton ready | ✅ | `QualityReadOnlyEvidenceAdapter` returns `pending-source-verification` without fetching Databricks or falling back to mock evidence. Route plan is documented in `quality-readonly-evidence-route-plan.md`. |
| 2.8 | Read-only evidence panel scaffold ready | ✅ | `QualityReadOnlyEvidencePanel` is mounted in the Quality Evidence view and labels the state as source verification pending, not live evidence. |
| 2.9 | Read-only evidence state model documented | ✅ | `quality-readonly-evidence-state-model.md` defines all 12 evidence states with meanings, allowed copy, prohibited interpretations, and live-wiring gates. **COMPLETE (2026-05-21).** |
| 2.10 | Usage-decision display helpers implemented | ✅ | `buildUsageDecisionDisplay` in `src/lib/usage-decision-display.ts` produces governed display labels from raw UD codes. Never returns "Released", "Approved", "Cleared", or "Can release". **COMPLETE (2026-05-21).** |
| 2.11 | Fixture scenario coverage complete | ✅ | 12 named fixtures in `quality-readonly-evidence-mock-data.ts` covering all state model states. All fixtures include source-limitation warnings. None contain prohibited release terms. **COMPLETE (2026-05-21).** |
| 2.12 | Source-truthfulness test coverage complete | ✅ | Source-truthfulness test suite in `quality-readonly-evidence-panel.test.tsx` covers all fixture scenarios. 196 tests total passing. **COMPLETE (2026-05-21).** |
| 2.13 | Live Databricks source wiring | ❌ | Route not implemented. Broader quality source verification pack for inspection-lot/MIC/CoA objects remains pending. Lot-selection rule for multiple lots not confirmed (TRACE-P1-012). **PENDING.** |
| 2.14 | Verified live Quality UAT candidate | ❌ | No verified live Quality UAT candidate identified. **PENDING.** |

---

## 3. UAT Acceptance

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 3.1 | Golden test batches and release cases defined | 🔶 | Mock cases documented in `golden-quality-batches.md`; no verified live Quality UAT candidate found from V1 discovery. Candidate template is in `golden-quality-candidates.md`. |
| 3.2 | UAT acceptance testing conducted for Lab Board view | ❌ | Backend proxy endpoints wired, but live E2E browser tests are pending staging environment deployment. |
| 3.3 | Quality release actions validated in SAP QM test environment | ❌ | Release actions are currently read-only simulation. SAP write-back integration is out of scope for Phase 2. |

---

## 4. Tests

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 4.1 | Adapter contract tests cover mock data structures | ✅ | Schema correctness verified using Zod schemas from `@connectio/data-contracts`. |
| 4.2 | Panel component tests cover query states (loading, ready, error) | ✅ | Existing Vitest suites run and verify basic rendering. |
| 4.3 | Test coverage meets or exceeds 60% threshold | ✅ | `di-quality` test suites validated locally. |
| 4.4 | Source-truthfulness test coverage for all fixture states | ✅ | 196 tests pass (2026-05-21). No fixture or helper output produces "Released", "Can release", "Approved", "Cleared", or "Release ready". Panel renders no action buttons. |
| 4.5 | Usage-decision display helper tests | ✅ | 60+ tests in `usage-decision-display.test.ts` covering all 9 governed codes, null/empty/unknown inputs, and universal prohibited-term invariants. |

---

## 5. Security & Identity

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 5.1 | User OAuth identity enforced for Databricks data-access | ⬜ | Not applicable. Databricks-API mode is not yet implemented or wired for the Quality domain. |
| 5.2 | No service-principal fallback paths implemented | ✅ | Any future Databricks integration must block on identity controls rather than using app-side fallbacks. |
| 5.3 | Secret-scope environment variables used for proxy base URLs | ✅ | Frontend references FastAPI proxy, backend references secret-scoped environment variables. |

---

## 6. Deployment

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 6.1 | Rollback plan established | ❌ | To be defined by deployment engineering. |
| 6.2 | Mock mode disabled in production builds | 🔶 | Deployment convention documented; production enforcement not yet proven. Production deployment must explicitly disallow mock mode or fail readiness checks before operational use. |

---

## 7. Documentation

| # | Gate | Status | Notes |
|---|------|--------|-------|
| 7.1 | Domain integration README exists | ✅ | Documented under `domain-integrations/quality/README.md`. |
| 7.2 | UAT Candidate ledger created | ✅ | Documented under `domain-integrations/quality/docs/golden-quality-batches.md`. |
| 7.3 | Known limitations document created | ✅ | Documented under `domain-integrations/quality/docs/quality-known-limitations.md`. |
| 7.4 | UAT Acceptance script created | ✅ | Documented under `domain-integrations/quality/docs/quality-uat-acceptance-script.md`. |

---

## Readiness Summary

| Phase | Verdict |
|-------|---------|
| Development / Code Review | ✅ Ready |
| Internal Mock-Mode Demonstration | ✅ Ready |
| Read-Only Evidence Foundation | 🔶 State model documented; usage-decision display helpers complete; 12 fixture scenarios complete; source-truthfulness test coverage complete (196 tests); contract extended with per-lot UD and state fields. UI/UX code-ready. Live Databricks source wiring remains pending — native route, lot-selection rule, and verified UAT candidate all pending. QM usage-decision: schema/grain/join keys verified 2026-05-21; all 9 UD codes governed (2026-05-21). |
| UAT with Live Backend Data | ❌ Blocked — requires Databricks source verification and source-backed read-only inspection/MIC/usage-decision evidence before any live Quality UAT claim. |
| Production Go-Live | ❌ Blocked — requires UAT sign-off and Databricks security integration. |

## Discovery Update

V2 Quality Batch Release is currently simulation/trust-hardened. A V1 Quality/QM source and functional parity assessment was completed in `quality-v1-source-discovery.md`; it found read-only evidence candidates but no production-suitable release workflow. The read-only evidence foundation now includes a Databricks verification pack, source-truthful evidence contracts, Quality/SPC MIC boundary documentation, a full state model, usage-decision display helpers, 12 fixture scenarios, and source-truthfulness test coverage. Missing usage-decision, CoA, or deviation evidence must not be interpreted as accepted, released, or no issue.

## Next Steps (required before live UAT)

1. Run broader Quality Databricks source verification pack for inspection-lot/MIC/CoA/deviation objects.
2. Confirm lot-selection/fan-out rule for multiple inspection lots per batch (TRACE-P1-012 gate).
3. Implement read-only usage-decision route (FastAPI proxy + adapter).
4. Implement inspection lot/MIC/CoA-like read-only routes.
5. Identify at least one verified live Quality UAT candidate (plant/material/batch with confirmed inspection lot data).
6. Run Quality UAT evidence capture against live Databricks data.

**Quality live UAT remains blocked.** UI/state model code-ready with fixture coverage. Live Databricks source wiring remains pending.
