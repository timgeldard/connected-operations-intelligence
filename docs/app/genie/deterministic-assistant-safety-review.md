# Deterministic Assistant Safety Review

**Date:** 2026-05-21
**Status:** Active
**Branch:** feature/genie-assistant-safety-hardening
**Scope:** POH and Traceability deterministic assistant pilot surfaces

---

## 1. Summary of Assistant Surfaces Reviewed

Two deterministic assistant pilot surfaces exist in V2. Both are scoped, evidence-only, and refuse topics outside approved scope.

| Surface | Location | Snapshot inputs |
|---|---|---|
| **POH Genie Pilot Engine** | `domain-integrations/operations/src/panels/poh-genie-pilot-engine.ts` | Process order header, operations, confirmations, goods movements |
| **Trace Genie Pilot Engine** | `domain-integrations/traceability/src/panels/trace-genie-pilot-engine.ts` | Batch header summary, trace graph |

Both engines are called by their respective view components but have **no live Databricks Genie runtime**, no LLM API call, and no open-ended chat. All responses are deterministically generated from the currently loaded panel data passed as a snapshot object.

---

## 2. Blocked Topic List

### 2a. Governed Decision Questions (Cross-Domain)

These patterns are checked **first** in both engines via `DECISION_BLOCKED_PATTERNS` from `@connectio/product-model`. A question matching any of these returns the `DECISION_BLOCKED_TEMPLATE` response — no domain-specific text is appended.

| Pattern | Question examples | Rationale |
|---|---|---|
| Release / batch acceptance | "Can I release this batch?", "Is this batch accepted?" | Requires SAP QM write-back, GxP e-signature, and QA governance — outside assistant scope |
| Batch rejection | "Can I reject this batch?" | Same as above — governed QA decision |
| Recall closure | "Can I close the recall?", "Is the recall contained?", "Close this recall" | Recall closure is a regulatory/QA governance event — not derivable from evidence alone |
| Exposure status | "Is customer exposure zero?", "Is exposure zero?" | Absence of returned records ≠ absence of exposure — this is a high-risk overclaim |
| Customer identification completeness | "Are all customers identified?" | Cannot be confirmed from lineage-only evidence |
| Supplier fault | "Is the supplier at fault?" | Requires full root-cause investigation — outside evidence assistant scope |
| Process control decision | "Is this process in control?" | SPC decisions require qualified procedures and approved control limits — not a chat answer |
| Warehouse clear | "Is the warehouse clear?" | Inventory completeness cannot be confirmed from available evidence |
| Deviation absence | "Are there no deviations?" | Absence of returned deviation records ≠ confirmed absence of deviations |
| CoA approval | "Is the CoA approved?" | CoA approval is a governed QA record — must not be inferred from evidence |
| SAP posting | "Post this in SAP", "SAP posting" | The assistant has no write-back capability; SAP actions are out of scope |

### 2b. Domain-Specific Blocked Topics (POH)

These are handled by the existing `BLOCKED_KEYWORDS` list in the POH engine and return the pilot-scoped blocked response:

- Lateness and root-cause analysis
- OEE, schedule adherence, benchmarking
- Planning, day-view, lineside workflows
- Downtime and operator notes
- Genealogy and related-batch inference
- Release reasoning and decision support
- Staffing and escalation recommendations
- Vessel-planning questions

### 2c. Domain-Specific Blocked Topics (Traceability)

Handled by the existing `BLOCKED_KEYWORDS` list in the Trace engine:

- Customer exposure claims (generic "customer" keyword)
- Supplier exposure claims
- Mass-balance interpretation
- Quality, CoA, release, recall, regulatory, QA, SAP decisions
- Timeline and event-history claims

**Note:** For the 11 governed decision questions listed in 2a, the cross-domain check fires first, producing the `DECISION_BLOCKED_TEMPLATE` response. Domain-specific keyword checks handle the broader set of related blocked topics.

---

## 3. Blocked Topic Response Template

The standard decision-blocked response (from `DECISION_BLOCKED_TEMPLATE` in `@connectio/product-model`) is:

> V2 is an evidence assistant, not a decision authority. This question requires a governed QA, recall, SAP, or process-control decision that must be made through your organisation's qualified procedures. The app can show source evidence and gaps, but cannot confirm release, rejection, recall closure, exposure status, or regulatory compliance decisions.

This template is returned verbatim, with no additional approved-topic hints or scope notes appended, to avoid any appearance of a partial positive claim.

---

## 4. Safe Response Template Requirements

All non-blocked (approved) answers from both engines must satisfy the following requirements. These are enforced in `buildAssistantReply` in `@connectio/product-model`:

1. **Source evidence cited** — every approved reply opens with `Based on <citation>:` and closes with `Citations: <panel> (<source>).`
2. **Evidence assistant caveat** — every approved reply appends `EVIDENCE_ASSISTANT_CAVEAT` (see below) immediately after the scope note.
3. **Scope note** — every approved reply includes the domain-specific scope note describing what is and is not answered.
4. **Mock warning** — when any cited panel is running in `mock` mode, a source warning is appended.
5. **No operational decision claim** — approved replies must not contain "you can release", "batch is approved", "recall is closed", or "exposure is zero".

### Evidence Assistant Caveat (always appended to approved answers)

> Evidence caveat: No records returned from a source must not be interpreted as absence of exposure. Source evidence shown here may be partial, unavailable, mock, or live — check the citations above.

### Example safe wording (from Traceability engine, graph-summary intent)

> Based on the currently loaded evidence, I can summarise the visible records, but I cannot confirm recall containment or release status. No records returned from a source must not be interpreted as absence of exposure.

---

## 5. Source and Citation Wording Standards

- Source attribution format: `<PanelName> (<adapter-source>)` — e.g. `TraceGraphPanel (databricks-api)`.
- If source is unknown, `unknown-source` is used — never silently omitted.
- Freshness: the engines do not claim data is "up to date"; they report "currently loaded" evidence only.
- Mock mode: when any source is `mock`, a visible warning is appended. No approved reply may omit the mock warning when mock data is present.
- Partial data: when a conditional slice is unavailable (e.g. POH header), the reply explicitly states the slice is "not currently included" rather than omitting it silently.

---

## 6. Test Coverage Summary

### POH Genie Pilot Engine (`poh-genie-pilot-engine.test.ts`)

**Pre-existing tests (3):**
- Builds a cited combined answer for approved questions
- Refuses blocked lateness questions (existing domain-blocked)
- Returns unsupported response for out-of-pack questions

**New: blocked topics regression tests (11):**
Each of the following governed decision questions is asserted to:
1. Return `kind === 'blocked'`
2. Have non-empty text
3. Not match `/\byes\b/i`, `/\bapproved\b/i`, or `/\bconfirmed\b/i`
4. Contain `DECISION_BLOCKED_TEMPLATE` exactly

Questions tested:
- "Can I close the recall?"
- "Is customer exposure zero?"
- "Can I release this batch?"
- "Is this batch accepted?"
- "Are all customers identified?"
- "Is this process in control?"
- "Can I reject this batch?"
- "Is the recall contained?"
- "Is the supplier at fault?"
- "Post this in SAP"
- "Is the CoA approved?"

**New: safe answer requirements tests (3):**
- Approved answers contain source/evidence citations
- Approved answers contain the evidence assistant caveat
- Approved answers do not contain operational decision claims

**Total: 17 tests (3 existing + 14 new)**

### Trace Genie Pilot Engine (`trace-genie-pilot-engine.test.ts`)

**Pre-existing tests (3):**
- Builds a cited graph summary
- Refuses blocked customer exposure questions (existing domain-blocked)
- Returns unsupported response for out-of-pack questions

**New: blocked topics regression tests (11):** Same 11 questions as POH (identical assertions).

**New: safe answer requirements tests (3):**
- Approved answers contain source/evidence citations
- Approved answers contain the evidence assistant caveat
- Approved answers do not contain operational decision claims

**Total: 17 tests (3 existing + 14 new)**

---

## 7. Known Limitations

1. **Pattern matching is exact-phrase only.** The `DECISION_BLOCKED_PATTERNS` use word-boundary regex. A user who rephrases a decision question without exact trigger words (e.g., "Is it okay to proceed with dispatch?") will not be caught. The engines will classify such questions as `unsupported` rather than `blocked` — which still prevents a positive decision claim but does not produce the decision-blocked response.

2. **No semantic understanding.** Both engines are purely pattern-matching classifiers. They cannot detect indirect decision questions or context-dependent phrasing. Lateral coverage is intentionally narrow and conservative.

3. **Approved answers are evidence summaries, not analysis.** The engines summarise counts, statuses, and graph shapes from currently loaded panels. They cannot confirm completeness, correctness, or freshness of the underlying source data.

4. **No live Databricks Genie runtime.** There is no connection to any Genie space, AI/BI endpoint, or LLM. These are deterministic string-building functions called with in-memory snapshot objects.

5. **No SPC process control answers.** Neither engine answers SPC-related questions. The "is this process in control?" pattern is blocked by `DECISION_BLOCKED_PATTERNS` and routed to the decision-blocked template.

6. **Source freshness is not validated.** The engines cite the adapter source type (`mock`, `legacy-api`, `databricks-api`) but cannot validate when data was last refreshed in the source system.

---

## 8. Explicit Not-Production-Ready Statement

**Live Genie integration is not production ready and has not been added.**

The following items remain blocked before any live Genie or LLM-backed assistant could be considered for production:

- No Databricks Genie space has been created or configured for V2.
- No LLM API call exists in the codebase.
- No semantic pack (space.yaml, glossary, rules, joins, sample SQL) has been validated against live V2 gold views.
- The deterministic pilot engines are evidence-summary tools only — they are not parity with V1 Genie.
- Production use of any assistant surface requires:
  - Live UAT validation of all cited source panels against live Databricks gold views.
  - Unity Catalog and OAuth token forwarding verified in the deployed environment.
  - Quality process owner governance for any code or decision-status displays.
  - Explicit sign-off that no governed decision claim is exposed to users.

See [Genie Readiness Index](../migration/genie-readiness-index.md) and [V2 Shell Genie Decision Record](../migration/v2-shell-genie-decision-record.md) for the full readiness gating criteria.
