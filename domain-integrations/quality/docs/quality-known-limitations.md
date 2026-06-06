# Quality / Batch Release Known Limitations

This document lists the architectural limitations and scope boundaries for the Quality / Batch Release workspace in the current Phase 2 release. These limitations must be resolved before any operational deployment.

---

## 1. Simulated Release Decisions & Data Views

Except for the Lab Board view (which is wired to the legacy V1 API proxy), all data rendered across the decision cockpit is simulated using mock data adapters:
- **Release Queue**: The queue of batch cases is a static, simulated mock list.
- **Release Decision Summaries**: Overall readiness status (`ready`, `blocked`, `conditional`) and Recommended Actions (`release`, `reject`, `escalate`) are simulated by rules in the mock adapter.
- **CoA Readiness**: Certificate of Analysis completeness checklists and missing field highlights are simulated in-memory records.
- **Quality Results**: Overall inspection lot statuses, category results (MIC, chemical, physical, sensory), and specific pathogen failures (such as Listeria spp. counts) are simulated.
- **Deviation Summaries**: Active deviation counts, severity tiers, and release-blocking attributes are simulated.

*Operational Impact*: Do **not** trust the completeness or accuracy of any batch information displayed on these views.

---

## 2. Simulation-Only Actions & Write-Backs

All interactive forms in the right-rail Actions panel run in simulated mode:
- **Release Batch**: Submitting a release decision or conditional release displays a success dialog and emits console logs, but does **not** update the SAP QM system or modify database records.
- **Place on Hold**: Placing a batch on hold is a mock action and does not apply an actual warehouse block or SAP hold status.
- **Request Retest**: Triggers a simulated success screen; no request is dispatched to laboratory systems.
- **Escalate Deviation**: Simulation only.

*Operational Impact*: The cockpit does **not** possess write permissions to any Kerry system. All release actions must be performed manually in SAP GUI.

---

## 3. Regulatory Compliance & e-Signatures

- **No 21 CFR Part 11 Compliance**: The simulated "Signoff Name" and "Rationale" input fields do not perform cryptographic signatures, dual-authorization checks, password re-entry, or secure database logging.
- **No Secure Audit Trail**: Decisions made in the cockpit are lost on page refresh and are not saved to a persistent, tamper-evident database audit log.

*Operational Impact*: Under no circumstances should this V2 frontend prototype be used as a final authority for GxP release actions.

---

## 4. Databricks SQL Integration

- **No Databricks-API Adapter**: Databricks-API mode is not implemented for the Quality domain. The adapter factory ignores `databricks-api` mode and falls back to legacy-api/mock mode.
- **No Unity Catalog Grants**: No Unity Catalog schemas, row-level filters, or column security masks have been verified for quality tables.
- **QM Usage-Decision Verified, Broader Pack Pending**: `qm-usage-decision-source-verification.md` verified `gold_inspection_usage_decision` schema (13 columns), grain (`INSPECTION_LOT_ID + USAGE_DECISION_COUNTER`), inspection-lot join, and 9 raw usage-decision codes via Databricks CLI on 2026-05-21 (TRACE-P1-012). All 9 usage-decision codes have a governed mapping confirmed by the Kerry Quality/QM process owner (2026-05-21). This confirmation supports read-only display labels only — it does not authorise release/reject actions, SAP QM write-back, e-signature, or a batch-level release decision. The broader `quality-databricks-source-verification.md` pack for inspection-lot, MIC result, specification, CoA-like, and deviation objects remains pending — no SQL has been run against those objects.

---

## 5. Read-Only Evidence Foundation

- **UI/State Model Code-Ready (2026-05-21)**: The read-only evidence state model is defined in `quality-readonly-evidence-state-model.md`. Usage-decision display helpers are implemented in `src/lib/usage-decision-display.ts`. 12 fixture scenarios cover all state model states. Source-truthfulness test coverage is complete (196 tests). The panel is hardened with per-state copy, inspection lot rows, per-lot usage decision display, MIC/CoA sections, and deviation unavailable warnings.
- **Contracts Extended**: `QualityInspectionLotEvidenceSchema` now supports per-lot usage decision fields (`usageDecisionCode`, `usageDecisionText`, `usageDecisionMappingStatus`, `usageDecisionCreatedAt`). The summary schema supports `evidenceState`, `sourceStatus`, `lotCount`, `multipleLotsWarning`, and `missingLotWarning`. No release-authority fields were added.
- **Routes Not Live**: No native Quality evidence route has been wired. Live Databricks source wiring remains pending.
- **No Release Semantics**: The contracts intentionally omit `releaseApproved`, `canRelease`, release/reject actions, and official CoA document approval. Usage decision fields remain source evidence only. No output ever contains "Released", "Can release", "Approved", "Cleared", or "Release ready".
- **SPC Boundary**: Quality MIC/result/specification evidence may help future SPC source mapping, but Quality specification limits are not SPC control limits, MIC valuation is not a Western Electric/Nelson signal, and usage decision is not SPC control status.
- **Live UAT Blocked**: Quality read-only evidence UI and source-truthfulness state handling are code-ready with fixture coverage. Live Databricks source wiring remains pending. Quality live UAT remains blocked until verified source routes and candidates are implemented.

---

## 6. V1 Source Discovery Findings

A V1 Quality/QM discovery was completed on 2026-05-21. It found usable read-only inspection/MIC/usage-decision/CoA-result evidence in V1 ConnectedQuality, POH, and Trace2 paths, but did not find a governed production batch-release workflow, SAP QM write-back, e-signature, GxP audit trail, or live deviation/nonconformance source.

*Operational Impact*: Missing usage-decision, CoA, or deviation evidence in V2 must not be interpreted as accepted, released, or no issue. The next safe implementation tranche is read-only inspection lot and MIC evidence, not release/reject actions.
