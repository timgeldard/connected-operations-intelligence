# V1 Genie Discovery and V2 Parity Roadmap

**Date:** 2026-05-20  
**Status:** Discovery complete; implementation intentionally deferred  
**Target audience:** Product owners, architects, UAT leads, and future implementation agents

---

## 1. Purpose

This document records the current evidence for Databricks Genie and Genie-adjacent functionality in the ConnectIO-RAD V1 estate, then maps those findings onto a conservative V2 parity roadmap.

This tranche does **not** implement Genie in V2. It defines what exists in V1, what is reusable, what is unsafe to carry forward unchanged, and what must be blocked until V2 source validation and truthfulness controls are stronger.

---

## 2. Executive findings

1. **V1 has explicit Genie support in four places:** the platform shell, Process Order History (POH), Trace2, and SPC.
2. **POH contains the richest semantic assets in source control:** a Genie space definition, business context, glossary, table rules, behavioral rules, joins, expressions, and curated sample SQL.
3. **Trace2 and SPC prove the UI/API integration pattern, not a portable semantic pack:** both ship assistant surfaces and backend routes, but the durable semantic governance assets are much thinner than POH's.
4. **Warehouse360, Quality, EnvMon, Maintenance, and Production Staging show no explicit Genie coverage in the V1 repo-wide search.**
5. **V2 now has a domain-scoped POH assistant pilot, but it does not yet have a live external Genie integration or a shell-wide assistant.** The current POH surface is deterministic and constrained to the approved POH pack.
6. **V2 parity should still start with domain-scoped, evidence-citing assistants, not a global cross-domain assistant.** A shell-level assistant should remain blocked until at least two domains have validated, source-truthful question packs.

---

## 3. Hard boundaries for V2 Genie parity

Any future Genie work in V2 must preserve the existing product rules:

- Genie is an **evidence assistant**, not a decision authority.
- Genie must not hide whether evidence came from `mock`, `legacy-api`, or `databricks-api`.
- Genie must not treat missing rows as proof of absence.
- Genie must not make release, recall, QA approval, SAP posting, or regulatory decisions.
- Genie must not bypass domain adapters, governed panels, or authenticated user-scoped Databricks access.
- Genie must remain blocked for any question set whose underlying V2 evidence is still mock-only or unverified.

---

## 4. V1 inventory — explicit Genie and Genie-adjacent assets

| V1 app / area | Key assets | Classification | What the evidence shows | Carry-forward stance |
|---|---|---|---|---|
| Platform shell | `apps/platform/README.md`, `apps/platform/frontend/src/App.tsx`, `apps/platform/frontend/src/genie/api.ts`, `apps/platform/frontend/src/genie/useGenieConversation.ts`, `apps/platform/frontend/src/genie/GenieDrawer.tsx` | Global assistant shell, frontend assistant/chat UI, API client | V1 had a shell-mounted global Genie assistant with drawer UX and shared conversation plumbing. | **Block for now.** Useful pattern, but unsafe to reintroduce in V2 before domain-level validation. |
| Process Order History (POH) | `apps/processorderhistory/docs/genie/processorderhistory-genie-space.md`, `apps/processorderhistory/genie/space.yaml`, `apps/processorderhistory/genie/instructions/*.md`, `apps/processorderhistory/genie/queries/*.sql`, `apps/processorderhistory/genie/joins/joins.yaml`, `apps/processorderhistory/genie/expressions/expressions.yaml`, `apps/processorderhistory/frontend/src/genie/*`, `apps/processorderhistory/backend/processorderhistory_backend/genie_assist/*` | Explicit Genie configuration, semantic model, glossary, table rules, joins, expressions, sample questions/query pack, frontend UI, backend API | POH is the strongest V1 proof that Genie was treated as a governed semantic assistant rather than only a chat widget. | **Best V2 starting point.** Reuse conceptually after contract-by-contract revalidation against V2 sources. |
| Trace2 | `docs/trace2-genie-integration.md`, `apps/trace2/frontend/src/genie/*`, `apps/trace2/backend/trace2_backend/genie_assist/*`, `libs/shared-reporting/src/traceability/geniePrompt.ts` | Assistant integration doc, frontend UI, backend API, prompt helper | Trace2 had a deployed per-app assistant pattern with lineage-aware page context and transfer explanation prompts. | **Reusable pattern.** Keep the contextual prompt idea; do not copy the duplicated per-app plumbing unchanged. |
| SPC | `apps/spc/frontend/src/spc/genie/GenieView.tsx`, `apps/spc/backend/spc_backend/routers/genie.py` | Assistant UI, backend assistant API | SPC had a governed assistant UI with scope pills, starter prompts, and conversation reset behavior. | **Blocked for live V2 parity until SPC source mapping is complete.** |
| Shared traceability helper | `libs/shared-reporting/src/traceability/geniePrompt.ts` | Genie-adjacent shared prompt helper | V1 already started extracting domain-specific prompt composition for traceability explanations. | **Reusable pattern.** Future V2 implementations should prefer this style of domain-owned prompt building over generic free-form chat. |

### Important POH semantic evidence

POH is the clearest source-controlled semantic pack in V1:

- `apps/processorderhistory/docs/genie/processorderhistory-genie-space.md` defines the Genie Space as the **durable semantic layer** and says the app should send only ephemeral UI context.
- `apps/processorderhistory/genie/instructions/01_business_context.md` defines scope, freshness expectations, plant-code handling, and out-of-scope topics.
- `apps/processorderhistory/genie/instructions/04_behavioral_rules.md` defines query safety rules such as excluding cancelled orders, weighting OEE correctly, and refusing unsupported sources like `scale_verification_results`.
- `apps/processorderhistory/genie/queries/*.sql` captures curated sample answer/query patterns.

This is the strongest V1 evidence for how V2 should structure future domain-level Genie packs.

---

## 5. Repo-wide coverage summary

| V2 domain / capability area | V1 Genie evidence in repo | Current interpretation |
|---|---|---|
| Process Order Review / Operations | **Explicit** | Strongest parity candidate because V1 includes both semantic assets and runtime plumbing. |
| Trace Investigation / Traceability | **Explicit** | Good parity candidate for context-aware explanation workflows, but many V2 trace slices remain partly mock or pending source verification. |
| SPC Monitoring | **Explicit** | Runtime pattern exists in V1, but V2 SPC remains blocked by source-model and request-shape misalignment. |
| Cross-domain shell | **Explicit** | V1 platform had a global assistant, but V2 should not reintroduce that surface until domain packs are validated. |
| Warehouse 360 | **None found** | No V1 Genie parity obligation yet; treat as net-new if pursued in V2. |
| Quality Batch Release | **None found** | No V1 Genie parity obligation; extra caution required because release decisions are high-risk. |
| EnvMon | **None found** | No V1 Genie parity obligation; defer until domain evidence stabilizes. |
| Maintenance & Reliability | **None found** | No V1 Genie parity obligation. |
| Production Staging | **None found** | No V1 Genie parity obligation. |

---

## 6. What should carry forward into V2

### Carry forward in principle

1. **Domain-owned semantic packs**
   - POH shows the right split between durable semantic assets (`space.yaml`, glossary, rules, joins, expressions, sample SQL) and ephemeral page context.
   - Future V2 Genie work should keep semantic assets under source control per domain.

2. **Contextual prompting**
   - Trace2 and SPC both prove the value of app-provided context such as focal batch, selected transfer, plant, material, MIC, and date window.
   - In V2 this should come from governed workspace context and panel registrations, not ad hoc UI state alone.

3. **Conversation UX patterns**
   - Drawer-based interaction, starter prompts, conversation reset, and lazy query-result hydration are reusable UX ideas.
   - These are product patterns, not proof of source readiness.

4. **Per-domain configuration**
   - V1 used per-app space IDs and domain-specific prompt composition.
   - V2 should preserve domain ownership instead of routing every question through one undifferentiated assistant.

### Carry forward only after revalidation

- POH sample questions, joins, expressions, and table rules
- Trace2 transfer-explanation prompts
- SPC starter prompts and contextual scoping

These assets must be revalidated against V2 contracts, current Unity Catalog objects, and the current evidence-panel surface area before they are treated as approved.

---

## 7. What is unsafe, incomplete, or outdated for V2

| Asset / pattern | Why it is risky |
|---|---|
| Per-app duplicated Genie client/router plumbing in POH, Trace2, and SPC | It proves feasibility, but it is operational duplication and would be a poor direct carry-forward into V2's shared runtime architecture. |
| POH references to `scale_verification_results` in `01_business_context.md` and `04_behavioral_rules.md` | The file explicitly says the required Unity Catalog view does not exist. This is useful as a guardrail, but unsafe as an active V2 question area. |
| Hardcoded sample questions that imply currently unsupported analytics | Many V1 questions assume mature OEE, yield, planning, or genealogy semantics that V2 has not fully wired or validated. |
| Global shell assistant parity | A global assistant can easily over-promise across mixed source modes and incomplete domains. V2 should not surface this until domain-level packs are trustworthy. |
| Decision-like usage in Quality or cross-domain release workflows | V2 rules explicitly forbid using Genie to make release or regulatory decisions. |

---

## 8. Current V2 readiness position

### What V2 already has

- A governed evidence-panel architecture with declared ownership, permissions, freshness, confidence, and source badges.
- Domain-owned adapters with `mock`, `legacy-api`, and `databricks-api` modes.
- Existing readiness documentation, including:
  - `docs/readiness/domain-readiness-index.md`
  - `docs/adapters/mock-legacy-databricks-modes.md`
  - `domain-integrations/spc/docs/spc-v1-source-discovery.md`

### What V2 does not currently have

V2 does not currently have:

- a live Databricks Genie backend integration
- a shell-wide/global assistant surface
- approved assistant packs for domains beyond POH and Traceability readiness documentation

The shipped POH assistant pilot is intentionally local and deterministic. It is not evidence of shell-level readiness or live external Genie integration.

---

## 9. V2 parity roadmap by phase

| Phase | Scope | Deliverable | Entry gates | Exit condition |
|---|---|---|---|---|
| 0. Discovery baseline | This document only | Agreed inventory, carry-forward rules, blocked domains, question-pack strategy | None | Stakeholders can point to a single source of truth for V1 Genie evidence |
| 1. POH domain readiness pack | `di-operations` / `process-order-review` | Approved POH Genie pack: domain glossary, approved question list, blocked question list, citation rules, validation dataset | Keep current live/questionable slices separated; use only validated V2 POH evidence | POH has a conservative, domain-scoped pilot pack ready for future implementation |
| 2. Traceability readiness pack | `di-traceability` | Batch/lineage explanation pack with source-citation rules and transfer-context prompts | Batch header and lineage routes remain clearly source-badged; mock-only panels excluded from approved answers | Trace assistant can explain focal batch and transfer context without over-claiming missing data |
| 3. SPC readiness pack | `di-spc` | Material-centric SPC assistant pack aligned to real V1/V2 source model | `SPCMonitoringAdapterRequest`, routes, field mapping, and control-rule provenance must first be resolved | SPC question set becomes eligible for a future pilot only after live source validation |
| 4. Cross-domain shell consideration | `workspace-runtime` / shell UX | Decision record on whether to add a shared assistant surface | At least two domain packs validated; cross-domain context runtime stable; citation model proven | Shell assistant either approved with guardrails or explicitly deferred |

### Why POH should go first

POH has the best V1 source-controlled semantic evidence and the clearest separation between durable semantics and ephemeral UI context. It is also the least risky place to prove the V2 governance model because many questions can be constrained to read-only operational evidence rather than decision support.

---

## 10. Domain-by-domain readiness and blocked scope

| Domain | Recommended future Genie scope | Safe starting scope | Block until later |
|---|---|---|---|
| POH / Operations | Order explanation, milestone timing, confirmations, goods movements, delay reasoning | Header, operations, confirmations, goods movements, timeline slices already represented in V2 or current parity docs | OEE benchmarking, vessel planning, unsupported metric views, broad planning analytics, genealogy outside validated scope |
| Traceability | Focal batch explanation, lineage transfer explanation, visible graph traversal explanation | Explain selected batch, explain selected transfer, summarize currently loaded lineage evidence | “No exposure” claims, release/release-block decisions, recall closure, mass-balance answers before DDL/source verification |
| SPC | Capability, drift, OOC summaries, recent batch context | **No live approved scope yet** | All live SPC claims until material-centric mapping, route wiring, and rule validation are complete |
| Warehouse 360 | None yet | None | Entire domain until a governed use case exists |
| Quality Batch Release | None yet | None | Entire domain for assistant use; especially release/rejection/recommendation flows |
| EnvMon | None yet | None | Entire domain until natural-language use cases are defined and source-truthful |
| Maintenance / Production Staging | None yet | None | Entire domain until source readiness exists |

---

## 11. Proposed pilot question packs

These are **documentation-only candidate starter questions** for future validation. They are not approved for production use today.

### POH candidate starter questions

- What is the current status of process order `<processOrderId>`?
- Show the operations, confirmations, and goods movements for `<processOrderId>`.
- Where is the biggest delay between release, confirmation, and goods receipt for `<processOrderId>`?
- Which confirmed events in the current view are still missing a corresponding goods receipt?

### Traceability candidate starter questions

- Summarize the currently loaded evidence for batch `<batchId>`.
- Explain the selected transfer in the lineage graph.
- Which upstream and downstream nodes are currently visible for this investigation context?

### SPC candidate starter questions

No live starter pack should be approved yet. The V1 assistant surface exists, but V2 SPC remains source-blocked.

---

## 12. Safe-answer guardrails for future V2 Genie work

Any future V2 assistant should follow these rules in both documentation and implementation:

1. **Cite the evidence surface.** Answers should identify the domain/workspace or panel that the answer came from.
2. **Preserve source mode truthfulness.** If the underlying evidence is `mock`, the answer must say so.
3. **Treat missing as unknown.** No rows, unavailable slices, or blocked adapters must never be translated into “none”, “clear”, “safe”, or “in control”.
4. **Ask for missing scope when needed.** If plant, date range, process order, or batch is required, Genie should ask rather than assume.
5. **Do not answer outside approved slices.** If V2 has no validated evidence for the topic, the assistant must refuse or redirect.
6. **Do not recommend actions that require human authority.** No release decisions, recall closure, QA approval, SAP posting, or regulatory interpretation.
7. **Do not invent joins, metrics, or definitions.** Use only approved semantic packs and verified data contracts.
8. **Keep cross-domain joins explicit.** Any future cross-domain answer must identify which domains contributed evidence.
9. **Prefer page/workspace context over broad unrestricted querying.**
10. **Surface freshness and availability limits.** Query time is not source freshness; mock is not live; unavailable evidence is not negative evidence.

---

## 13. Recommended next documentation tranche

The next safe tranche is documentation and validation planning only:

1. Create a **POH Genie readiness pack** in V2 with:
   - approved question list
   - blocked question list
   - source inventory mapped to V2 panels and adapters
   - validation dataset / golden examples
   - explicit out-of-scope topics
2. Create a **Traceability Genie readiness pack** focused on focal-batch and transfer-explanation use cases only.
3. Keep **SPC Genie** in discovery state until the source model and request model are aligned.
4. Do **not** create a V2 shell-wide Genie assistant until domain packs exist and truthfulness guardrails have been proven.

The shell-level decision is now captured in:

- `docs/migration/v2-shell-genie-decision-record.md`

---

## 14. Source references

### V1 references

- `apps/platform/README.md`
- `apps/platform/frontend/src/App.tsx`
- `apps/platform/frontend/src/genie/api.ts`
- `apps/platform/frontend/src/genie/useGenieConversation.ts`
- `apps/platform/frontend/src/genie/GenieDrawer.tsx`
- `apps/processorderhistory/docs/genie/processorderhistory-genie-space.md`
- `apps/processorderhistory/genie/space.yaml`
- `apps/processorderhistory/genie/instructions/01_business_context.md`
- `apps/processorderhistory/genie/instructions/02_glossary.md`
- `apps/processorderhistory/genie/instructions/03_table_rules.md`
- `apps/processorderhistory/genie/instructions/04_behavioral_rules.md`
- `apps/processorderhistory/genie/queries/*.sql`
- `apps/processorderhistory/genie/joins/joins.yaml`
- `apps/processorderhistory/genie/expressions/expressions.yaml`
- `apps/processorderhistory/frontend/src/genie/*`
- `apps/processorderhistory/backend/processorderhistory_backend/genie_assist/*`
- `docs/trace2-genie-integration.md`
- `apps/trace2/frontend/src/genie/*`
- `apps/trace2/backend/trace2_backend/genie_assist/*`
- `libs/shared-reporting/src/traceability/geniePrompt.ts`
- `apps/spc/frontend/src/spc/genie/GenieView.tsx`
- `apps/spc/backend/spc_backend/routers/genie.py`

### V2 references

- `docs/architecture/overview.md`
- `docs/adapters/mock-legacy-databricks-modes.md`
- `docs/readiness/domain-readiness-index.md`
- `domain-integrations/spc/docs/spc-v1-source-discovery.md`
- `docs/migration/poh-functional-parity-audit.md`
- `docs/migration/v2-shell-genie-decision-record.md`
