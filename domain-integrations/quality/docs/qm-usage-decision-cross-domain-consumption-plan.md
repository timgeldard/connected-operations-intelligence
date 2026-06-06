# QM Usage-Decision — Cross-Domain Consumption Plan

**Status:** source verified 2026-05-21; no live wiring added; domain rules remain conservative pending QM process-owner code-mapping governance (TRACE-P1-012)
**Created:** 2026-05-21
**Related:** `qm-usage-decision-source-verification.md`, `qm-usage-decision-code-semantics.md`, `qm-usage-decision-grain-and-joins.md`

This document defines how each V2 domain may consume usage-decision evidence once the source is verified, and what each domain must never do with usage-decision data.

---

## 1. Governing Principles

1. Usage-decision data is read-only evidence only. V2 does not perform SAP QM write-back, release/reject posting, or any approval action.
2. Missing usage-decision evidence must not be interpreted as accepted, released, or no issue.
3. Usage-decision code/text is displayed verbatim from source. V2 does not remap codes to release-status labels without a governed mapping confirmed by the Kerry Quality/QM process owner.
4. Usage-decision is not SPC control status, batch stock status, CoA document approval, or production history quality_status.
5. Source object, schema, grain, and inspection-lot join are now verified (2026-05-21, see `qm-usage-decision-source-verification.md` §14). The remaining gate before any domain wiring is code-to-release-status mapping governance from the Kerry Quality/QM process owner.

---

## 2. Per-Domain Consumption Rules

### 2.1 Traceability

#### Batch Header

| Rule | Description |
|---|---|
| **Permitted** | Display source usage-decision code/text as read-only evidence alongside `qualityStatus`. Label clearly as "Usage decision (source)". |
| **Permitted** | Show `qualityStatus: pending` when inspection lot is open and no decision is recorded. |
| **Permitted** | Show `qualityStatus: unknown` when no inspection lot is found. |
| **Required** | Join must use verified keys and must be a LEFT JOIN — batches without an inspection lot must still return a batch header row. |
| **Blocked** | Do not map to `qualityStatus: accepted/rejected/conditional` until the governed code mapping is verified (see `qm-usage-decision-code-semantics.md` §7). |
| **Blocked** | Do not treat UNRESTRICTED stock as evidence of accepted usage decision. |
| **Blocked** | Do not expose `_derive_quality_status_with_qm` in `quality-decision-source-plan.md` until column names and codes are verified. |
| **Source evidence required** | Object existence, schema, grain, join keys (§14 Go in `qm-usage-decision-source-verification.md`) |

#### Supplier Exposure

| Rule | Description |
|---|---|
| **Permitted** | After source is verified: display UD evidence as supplemental read-only information for a specific batch, not as a supplier-level risk signal. |
| **Blocked** | Do not calculate `openSupplierActions` or `highestRiskSupplier` from usage-decision data until supplier/batch causality and risk rules are separately defined and governed. |
| **Blocked** | Do not derive a supplier quality failure rate from UD data — this requires a governed rule that maps UD codes to failure events at supplier level. |
| **Current state** | `openSupplierActions = 0` and `highestRiskSupplier` absent; disclaimer rendered in panel (TRACE-P1-012). |
| **Source evidence required** | Same as batch header, plus: supplier-to-batch join path and risk-rule governance |

#### Production History

| Rule | Description |
|---|---|
| **Permitted** | After source is verified: display UD code/text alongside each production history row as a separate evidence field. |
| **Permitted** | Keep `quality_status` (Pass/Fail from `gold_batch_production_history_v`) distinct and separately labelled. Do not merge or substitute. |
| **Required** | The existing disclaimer must be preserved: "Pass/Fail label from production history source — not a release decision." |
| **Blocked** | Do not replace the `quality_status` field with a UD-derived value. |
| **Blocked** | Do not imply that a UD "Pass" row means the batch passed a formal QM release. |
| **Source evidence required** | Object existence, schema, join to material/batch confirmed |

#### Mass Balance

| Rule | Description |
|---|---|
| **Blocked** | Do not use usage-decision data in mass balance calculations or display. |
| **Rationale** | Mass balance is a quantity reconciliation; QM usage decision is an inspection outcome. They are unrelated. |

---

### 2.2 Quality

#### Read-Only Evidence Panel

| Rule | Description |
|---|---|
| **Permitted** | After source is verified: display UD code/text as read-only evidence in the Quality Evidence view. |
| **Permitted** | Show `pending-source-verification` state until §14 Go criteria are met (current state). |
| **Required** | Label clearly: "Usage decision (source) — read-only evidence. Not a release authorization." |
| **Required** | Show "No usage decision recorded" when code/text is null — never show "Released" or "Accepted" by default. |
| **Blocked** | Do not implement a release queue backed by UD data. |
| **Blocked** | Do not display a "release decision" or "can-release" field. |
| **Blocked** | CoA-like result evidence must remain separate from UD evidence. |
| **Source evidence required** | Object existence, schema, grain, join keys verified; governed code mapping for any status label |

---

### 2.3 Process Order History (POH)

| Rule | Description |
|---|---|
| **Permitted** | After source is verified: display UD evidence for the process order if a join to the process order via inspection lot is verified. |
| **Required** | Label as "Inspection/usage-decision evidence for this process order — read-only." |
| **Blocked** | Do not imply order release approval from UD data. |
| **Blocked** | Do not surface UD data for POH until the process-order-to-inspection-lot join path is verified (see `qm-usage-decision-grain-and-joins.md` §5). |
| **Source evidence required** | `PROCESS_ORDER_ID` present on UD or inspection lot source; join path verified |

---

### 2.4 SPC

| Rule | Description |
|---|---|
| **Permitted** | SPC may reference MIC/result/specification evidence from Quality sources (see `quality-spc-shared-mic-evidence.md`). |
| **Blocked** | Do not use usage decision as a substitute for SPC rule signals or control-limit status. |
| **Blocked** | Do not display a UD code on a control chart or alongside SPC signals in a way that implies they are related concepts. |
| **Rationale** | Usage decision is a QM inspection outcome. SPC is a process-control signal. They are independent in SAP QM. |

---

### 2.5 Genie / Natural-Language Assistant

| Rule | Description |
|---|---|
| **Permitted** | Genie may cite source usage-decision code and text as read-only evidence in response to investigative questions. |
| **Permitted** | Genie may say "The usage decision recorded for this batch is [code]: [text]." |
| **Blocked** | Genie must not answer "Can this batch be released?" as a decision. |
| **Blocked** | Genie must use blocked-topic behaviour for: release authority, recall closure, disposition decisions, and any question requiring a governed QM decision. |
| **Blocked** | Genie must not infer "Released" or "Accepted" from a null or absent usage-decision row. |
| **Required** | Genie must always prefix UD evidence with "The source records..." and must state that V2 does not make release decisions. |

---

## 3. Domain Consumption Summary Table

| Domain | Permitted Use | Prohibited Use | Required Source Evidence | UI / Response Wording |
|---|---|---|---|---|
| Traceability — Batch Header | Display source UD code/text as read-only evidence | Map to accepted/released/rejected without governed mapping; use stock status as UD proxy | Object, schema, grain, material/batch join | "Usage decision (source): [code] — [text]" |
| Traceability — Supplier Exposure | Supplemental batch UD evidence only | Calculate supplier risk; populate openSupplierActions/highestRiskSupplier | Same + supplier risk rule governance | "Usage decision evidence for this batch (read-only)" |
| Traceability — Production History | Display UD alongside quality_status; keep distinct | Substitute UD for quality_status; remove Pass/Fail disclaimer | Object, schema, material/batch join | "Usage decision (source): [code]" + existing Pass/Fail disclaimer preserved |
| Traceability — Mass Balance | Not applicable | Any use | n/a | n/a |
| Quality — Read-Only Evidence | Display UD code/text as read-only evidence | Release queue; can-release field; status mapping without governance | Object, schema, grain, join keys; governed code mapping for status labels | "Usage decision (source) — read-only evidence. Not a release authorization." |
| POH | Display UD for PO if join verified | Imply order release approval | Object, schema, PO→lot join path | "Inspection/usage-decision evidence for this process order — read-only" |
| SPC | Reference MIC/result/spec evidence only | Use UD as SPC signal or control status | n/a | n/a |
| Genie | Cite source UD code/text | Answer release authority questions; infer accepted from null | n/a | "The source records usage decision [code]: [text]. V2 does not make release decisions." |

---

## 4. Readiness Gates

Before any domain wires live usage-decision evidence:

| Gate | Status | Notes |
|---|---|---|
| Source object verified (DESCRIBE evidence) | **verified** | `connected_plant_uat.gold.gold_inspection_usage_decision`, 2026-05-21 — see `qm-usage-decision-source-verification.md` §13 |
| Column names confirmed (not assumed) | **verified** | 13 columns — see `qm-usage-decision-source-verification.md` §4 |
| Grain verified (≤1 row per lot or documented exceptions) | **verified** | Grain = `(INSPECTION_LOT_ID, USAGE_DECISION_COUNTER)`; multiple rows per lot are historical — see `qm-usage-decision-grain-and-joins.md` |
| Join key to material/batch confirmed | **verified** | Two-hop via `gold_inspection_lot`; fan-out risk documented in `qm-usage-decision-grain-and-joins.md` §7 |
| Raw code/text distribution captured | **verified** | 9 code variants observed — see `qm-usage-decision-code-semantics.md` §2 |
| Governed code mapping confirmed by QM process owner | **confirmed** | All 9 codes confirmed 2026-05-21 (tim.geldard@kerry.com); empty string = lot open, stock in QI, no decision taken |
| No release/reject actions in scope | confirmed | Permanent constraint |
| No SAP QM write-back in scope | confirmed | Permanent constraint |
| No service-principal fallback introduced | confirmed | Per Databricks security rules |

---

## 5. Change Log

| Date | Change | Author |
|---|---|---|
| 2026-05-21 | Initial plan created | Claude / AI agent |
| 2026-05-21 | §4 readiness gates updated to reflect verified source and partial code-mapping governance | Claude / AI agent |
