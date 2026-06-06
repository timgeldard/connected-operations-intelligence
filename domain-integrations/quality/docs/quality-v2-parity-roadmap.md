# Quality V2 Parity Roadmap

**Status:** discovery-backed plan, no live release implementation claimed.
**Last updated:** 2026-05-21.

## Current State

V2 Quality Batch Release is currently simulation/trust-hardened. Release queue, summary, CoA readiness, deviations, decision history, release actions, hold actions, retest actions, and escalation actions are mock or simulation-only. The ConnectedQuality Lab Board is preserved through a legacy-api path, but browser/live UAT verification remains pending.

Missing usage-decision, CoA, or deviation evidence must not be interpreted as accepted, released, or no issue.

## Phased Plan

### Phase 0 — Discovery And Source Verification

- Verify authoritative Unity Catalog sources for inspection lots, MIC results, specifications, usage decisions, CoA result evidence, and stock/hold status.
- Confirm valuation and usage-decision code mappings with Quality/SAP QM owners.
- Identify one or more golden Quality UAT candidates with plant, material, batch, inspection lot, and expected source evidence.
- Keep release actions disabled/simulated.

### Phase 1 — Read-Only Inspection Lot And MIC Evidence

- Add a native read-only Quality route or adapter slice for batch/material/plant/inspection-lot evidence.
- Show inspection lots, MIC IDs/names/codes, numeric and qualitative results, tolerances/spec fields when present, valuation, sample ID, method, dates, and source status.
- Add no-record/unavailable/error states that do not imply acceptance or absence.
- Add Copy UAT Evidence with source names, row counts, candidate inputs, and warnings.

### Phase 2 — Usage Decision Mapping

- Display source usage-decision code/text/valuation/created-by/date only after verified mapping.
- Keep display read-only.
- Do not derive release/accepted/conditional states without governed mapping.

### Phase 3 — CoA Evidence

- Add CoA result evidence from verified sources such as `gold_batch_coa_results_v` if validated.
- Distinguish CoA result evidence from CoA document generation, CoA approval, CoA versioning, and CoA release status.
- Keep PDF/document generation out of scope until a document-backed source is proven.

### Phase 4 — Deviations / Notifications

- Discover and validate deviation, nonconformance, defect, or QM notification sources.
- If a source exists, add read-only evidence with severity/status/owner/due-date only as source-backed fields.
- Do not interpret no rows as no deviations until source coverage is validated.

### Phase 5 — Cross-Domain Links

- Add advisory links from Traceability batch quality records, POH order quality evidence, SPC signals, EnvMon signals, and Warehouse stock/hold context.
- Keep advisory links visually separate from release decisions.

### Phase 6 — Controlled Release Workflow

Only after governance, SAP write-back design, authorization, e-signature, and GxP audit trail are designed and approved:

- Controlled release/reject/conditional decisions.
- SAP QM usage-decision write-back.
- Hold/retest/deviation workflow actions.
- Persistent audit trail and dual-control requirements.

## Recommended Next Tranche

**Build read-only Quality inspection lot + MIC evidence V1.**

Acceptance for that tranche:

- No SAP QM write-back.
- No mock fallback in native Databricks mode.
- Source identifiers preserved as strings.
- Missing usage decision remains unknown/unavailable.
- No-record sections do not imply accepted/released/no deviations.
- Browser/UAT verification checklist prepared, but not claimed unless actually run.
