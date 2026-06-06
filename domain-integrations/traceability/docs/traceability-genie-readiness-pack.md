# Traceability Genie Readiness Pack

**Date:** 2026-05-20  
**Status:** Domain-scoped pilot surface implemented; live Databricks Genie integration still not implemented  
**Domain:** `di-traceability` / `trace-investigation`

---

## 1. Purpose

This pack defines the safest first question set for the current V2 Traceability assistant pilot and any future live Traceability Genie integration.

The first usable scope is intentionally narrow: **focal batch summary** and **visible lineage explanation** only. Customer exposure, supplier exposure, mass balance, CoA/release reasoning, and recall-readiness claims remain blocked until their underlying V2 evidence is live-validated and source-truthful.

The current V2 implementation is a deterministic Trace Assistant Pilot inside the Trace Investigation workspace. It uses the approved Traceability pack and cites `BatchHeaderPanel` and `TraceGraphPanel`. It does not call an external LLM or Databricks Genie backend.

---

## 2. Current readiness position

Traceability has the clearest V1 precedent for a contextual assistant beyond POH: V1 Trace2 shipped a page-context-aware Genie surface and transfer-explanation prompts.

For V2, the safe first scope is split across two different evidence tiers:

- `BatchHeaderPanel` is browser-verified through the V1-backed `legacy-api` route.
- `TraceGraphPanel` is browser-verified through the native `databricks-api` graph route.

Everything else should stay blocked for a first Genie pack because those slices are mock-only, partially verified, or explicitly DDL/source blocked.

---

## 3. Source inventory mapped to V2 panels, queries, and adapters

| User-facing slice | V2 panel / view surface | Query hook | Adapter method | Current source/readiness | Genie pack status |
|---|---|---|---|---|---|
| Batch header / focal batch summary | `BatchHeaderPanel` | `useBatchHeaderSummary()` | `Trace2LegacyApiAdapter.getBatchHeaderSummary()` | Browser-verified against V1 `legacy-api` batch-header route | **Approved starting slice** |
| Lineage graph | `TraceGraphPanel` / `trace-tree` view | `useTraceGraph()` | `Trace2LegacyApiAdapter.getTraceGraph()` | Browser-verified native `databricks-api` route on 2026-05-18 | **Approved starting slice** |
| Customer exposure | `CustomerImpactPanel` | `useCustomerExposureSummary()` | `getCustomerExposureSummary()` | Mock / parity-incomplete | **Blocked** |
| Supplier exposure | `MaterialSupplierExposurePanel` | `useSupplierExposureSummary()` | `getSupplierExposureSummary()` | Mock / parity-incomplete | **Blocked** |
| Mass balance | `MassBalancePanel` / `mass-balance` view | `useMassBalanceSummary()` | `getMassBalanceSummary()` | Native path still blocked on DDL/source verification | **Blocked** |
| CoA / release status | `CoAReleaseStatusPanel` | `useCoAReleaseStatus()` | `getCoAReleaseStatus()` | Mock / partial parity only | **Blocked** |
| Event timeline | `EventTimelinePanel` | `useTraceEvents()` | `getEventTimeline()` | Mock-only | **Blocked** |
| Risk signals | `RiskSignalsPanel` | `useRiskSignals()` | `getRiskSignals()` | Mock-only | **Blocked** |
| Related investigations | `RelatedInvestigationsPanel` | `useRelatedInvestigations()` | `getRelatedInvestigations()` | Mock-only | **Blocked** |
| Trace exposure for release | `TraceExposureForReleasePanel` | `useTraceExposureForRelease()` | `getTraceExposureForRelease()` | Mock-only | **Blocked** |

---

## 4. Approved question list for a future pilot pack

These are the **approved starter questions** for a future Traceability Genie pilot, provided the answer is constrained to the approved slices above and cites them explicitly.

1. Summarize the focal batch currently loaded in the batch header.
2. Summarize the lineage currently visible in the trace graph for batch `<batchId>`.
3. Which upstream and downstream nodes are currently visible in the graph?
4. Explain the currently visible lineage graph and its source split.
5. Is the current graph truncated, and are there any graph warnings visible?
6. Identify which parts of the answer came from `legacy-api` batch-header evidence and which came from `databricks-api` trace-graph evidence.

### Important limit

These questions are about the **currently visible evidence**, not about all real-world exposure or the full historical truth of the batch. The assistant must say that clearly.

---

## 5. Blocked question list

The following topics must stay blocked from a first V2 Traceability Genie pilot:

- Are there no downstream exposures?
- Is this batch safe to release?
- Should we close the recall / investigation?
- Which customers are definitely affected?
- Which suppliers are definitely implicated?
- What is the true mass balance and variance root cause?
- What is the quality or CoA decision for this batch?
- Give me the complete investigation timeline.
- Recommend regulatory, QA, recall, or SAP actions.

These topics depend on blocked or mock-only panels, or they cross into prohibited decision support.

---

## 6. Citation and answer rules

Any future Traceability Genie implementation should follow these rules:

1. **Cite the panel and source mode.** Example: “`BatchHeaderPanel` (`legacy-api`) shows … while `TraceGraphPanel` (`databricks-api`) shows …”
2. **Treat visible graph scope as partial evidence.** A visible node/edge set is not the same as complete downstream or upstream truth.
3. **Never convert missing evidence into “no exposure”.**
4. **Do not cross into release or recall authority.**
5. **Ask for `batchId`, `materialId`, and `plantId` when the trace graph scope requires them.**
6. **Respect source differences.** Batch-header and graph answers may come from different backends and different verification states.
7. **Refuse blocked topics instead of guessing.**

---

## 7. Validation dataset / golden examples

| Purpose | Material | Batch | Plant | Current evidence |
|---|---|---|---|---|
| Trace-graph browser-verification anchor | `20052009` | `0008602411` | `C061` | Browser-verified on 2026-05-18 for native trace graph route and user-facing trace workspace |
| Legacy / historical reference anchor | `000000000020052009` | `0008602411` | `C061` | Same business candidate appears in older trace docs, but material-ID padding differs across views; do not assume ALPHA-padding behaviour |
| Partial stock/summary validation anchor | `20035129` | `8000049668` | `C061` | Recorded in `golden-test-batches.md` as the confirmed UAT candidate for stock/summary work; full graph/session validation still pending |

### Recommended first pilot anchor

Use **material `20052009`, batch `0008602411`, plant `C061`** as the first trace-graph pilot anchor because it already has a browser-verification trail on the final Trace workspace route.

---

## 8. Explicit out-of-scope topics

The first Traceability Genie pack should remain out of scope for:

- customer exposure summarization
- supplier exposure summarization
- recall-readiness claims
- mass-balance interpretation
- CoA / release / quality decision logic
- cross-batch comparison
- production-history summarization
- cross-domain release recommendations

---

## 9. Carry-forward from V1

The following V1 Trace2 Genie concepts should inform a future V2 implementation:

- app-provided page context
- transfer-specific explanation prompts
- domain-owned prompt composition rather than a generic chat layer
- clear separation between domain semantics and shell-level UX plumbing

V2 should **not** carry forward the V1 global “Ask Genie” experience until multiple domains have validated packs and the cross-domain citation model is proven.

---

## 10. Next gate before implementation

Before any Traceability Genie UI/runtime work starts, complete these gates:

1. Keep the first pack limited to `BatchHeaderPanel` and `TraceGraphPanel`.
2. Record one canonical user journey where the header and graph are both demonstrated together with their source badges.
3. Leave customer exposure, supplier exposure, mass balance, and quality/release topics blocked until their live data paths are validated.
4. Preserve the visible-evidence framing in all prompts and documentation.

---

## 11. References

- `docs/migration/v1-genie-discovery-and-v2-parity-roadmap.md`
- `docs/deployment/trace-native-browser-verification.md`
- `docs/migration/trace2-functional-parity-matrix.md`
- `domain-integrations/traceability/docs/golden-test-batches.md`
- `domain-integrations/traceability/src/adapters/trace2-queries.ts`
- `domain-integrations/traceability/src/adapters/trace2-legacy-api-adapter.ts`
