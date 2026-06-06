# Quality / Batch Release Domain Integration

This directory houses the Quality and Batch Release domain-integration components, including adapters, queries, views, workspaces, and Evidence Panels.

## Current Readiness & Source Status

- **Current Source Mode**: Hybrid / Simulated Mock Data (`source: 'mock'`) for release-decision components, and Legacy API (`source: 'legacy-api'`) for the Connected Quality Lab Board.
  - **Release Queue**: mock only
  - **Release Summary**: mock only
  - **Deviations**: mock only
  - **CoA Readiness**: mock only
  - **Quality Results**: mock only
  - **Release Actions / right rail**: simulation only, no SAP write-back
  - **Connected Quality Lab Board**: legacy API path, live browser verification pending
  - **Databricks integration**: no Databricks quality adapter exists yet
- **V1 discovery status**: A V1 Quality/QM source discovery was completed on 2026-05-21 and is documented in `docs/quality-v1-source-discovery.md`. V1 contains real read-only inspection/MIC/usage-decision/CoA-result evidence across ConnectedQuality, POH, and Trace2, but does not prove a governed production batch-release workflow.
- **Read-only evidence foundation status**:
  - Source discovery complete.
  - Databricks source verification pack ready; no source has been marked authoritative.
  - Read-only Quality evidence contract design ready in `@connectio/data-contracts`.
  - Read-only Quality evidence adapter skeleton ready; it returns `pending-source-verification` and does not fetch live data.
  - Read-only Quality evidence panel scaffold mounted in the Quality Evidence view; it shows source verification pending, not live evidence.
  - Quality/SPC shared MIC evidence boundaries documented.
  - Native Databricks Quality route/UI evidence implementation remains UAT-pending.
- **Data Veracity**: Batch release decision queue, deviation lists, CoA readiness, and overall release recommendations are simulated mock representations. The Connected Quality Lab Board is preserved from V1 via FastAPI proxy but remains pending live browser verification in V2.
- **Regulatory Status**: Do **not** use the simulated release queue, decision recommendations, or mock CoA statuses for regulatory decisions, shipping approval, or operational release signatures. Physical release blocks must be verified and resolved directly within the SAP QM system of record before any shipping occurs.
- **Readiness Wording**: V2 Quality Batch Release is currently simulation/trust-hardened. A source-validated native read-only Quality implementation is required before live Quality UAT. Missing usage-decision, CoA, or deviation evidence must not be interpreted as accepted, released, or no issue.

## Integration Gates & Out-of-Scope Items

1. **SAP QM Write-Backs**: Write-back operations (e.g. submitting usage decisions, placing batch holds, requesting lab re-tests) are out of scope for the current design phase and run in read-only simulation mode.
2. **Databricks SQL Execution**: Direct Databricks SQL querying is not yet implemented for the Quality domain; all release decision tables utilize in-memory mock adapters.
3. **Verification Status**: No live write-back API verification or Databricks catalog verification has been performed for Quality decisions. All components run using mock representations of the adapter response contract.
4. **Usage Decision / CoA / Deviation Semantics**: V1 evidence shows read-only sources for parts of usage decision, MIC results, and CoA-like result evidence, but release status, CoA document approval, and deviation workflows remain unverified for V2 release decisions.
5. **SPC Boundary**: Quality MIC/result/specification evidence may become a future SPC measurement-input candidate, but Quality specification limits are not SPC control limits and usage decisions are not SPC control status.

## Remaining Production Readiness Milestones

To migrate from the hybrid/mock sandbox mode to a production-ready state, the following validation gates must be passed:
- **SAP QM Live API Mapping**: Map release queue, deviation summary, CoA status, and decision history queries to live SAP QM service endpoints.
- **Read-Only Evidence First**: Build and validate source-backed inspection lot and MIC result evidence before any release-status or action workflow.
- **Write-Back Service Wiring**: Wire up the submit/write action handlers in the right-rail Actions panel to authorized SAP write endpoints (e.g. via OData or RFC).
- **Electronic Signatures (e-Sig) Audit Trail**: Implement compliance with regulatory electronic signature standards (e.g., 21 CFR Part 11) for any release write action.
- **Error-State Validation**: Validate how the UI handles network failures, timeout limits, and invalid data responses returned from live backend services.
- **Security & Authorization**: Validate role-based write authorization (`quality.release.write`) in the live staging environment.
