# Next Action Plan — Post Main-Sync Readiness

**Date:** 2026-05-21
**Branch basis:** `main` after PR #61 (QM UD source verification) and PR #62 (POH hardening)
**Related:** `current-main-readiness-review.md`

This plan defines the recommended next order of work after the post-merge readiness sync. It clearly separates developer tasks from Databricks-enabled validation and business governance work. It does not propose broad feature expansion before validation is complete.

---

## Action Plan

### Action 1 — Run Traceability UAT Evidence Runbook

| Field | Value |
|---|---|
| Owner type | QA / developer with deployed UAT environment access |
| Direct Databricks SQL access required | No. Deployed app in `databricks-api` mode required: Yes. Tester must have access to the deployed UAT app and be authenticated via AAD/OAuth. |
| Business owner required | No (initially) — purely technical evidence capture |
| Expected output | Filled-in `traceability-uat-evidence-runbook.md`; UAT run table row in `uat-validation-ledger.md`; screenshots per panel |
| Blocked by | Deployed Databricks Apps environment with OAuth and `databricks-api` adapter mode |
| Risk if skipped | No evidence that live Databricks routes return correct data; cannot claim any live parity; DEF-TRACE-005 (LINK_TYPE) and TRACE-P1-010/011 remain uninvestigated in browser |

**Runbook:** `domain-integrations/traceability/docs/traceability-uat-evidence-runbook.md`
**Candidate batch:** material `20035129` / batch `8000049668` / plant `C061`

---

### Action 2 — Run POH UAT Evidence Runbook

| Field | Value |
|---|---|
| Owner type | QA / developer with deployed UAT environment access |
| Direct Databricks SQL access required | No. Deployed app in `databricks-api` mode required: Yes. Tester must have access to the deployed UAT app and be authenticated via AAD/OAuth. |
| Business owner required | No (initially) |
| Expected output | Filled-in `poh-uat-evidence-runbook.md`; screenshots per section; component consumption rows captured showing material + batch + UOM |
| Blocked by | Deployed environment; confirmed `databricks-api` adapter mode for POH |
| Risk if skipped | PR #62 component consumption fix cannot be confirmed as working correctly in live mode; source attribution cannot be validated |

**Runbook:** `domain-integrations/operations/docs/poh-uat-evidence-runbook.md`
**Candidate:** process order `7006965038`, plant `C113`

---

### Action 3 — Resolve Mass Balance MOVEMENT_CATEGORY Mapping (TRACE-P1-010)

| Field | Value |
|---|---|
| Owner type | Data platform engineer or business analyst with SAP MM knowledge |
| Databricks access required | No (governance decision); Yes for SQL verification |
| Business owner required | Yes — direction assignment requires business / data-platform confirmation |
| Expected output | All rows in the approval table in `mass-balance-movement-category-register.md` filled in; `_MOVEMENT_CATEGORY_MAP` in backend updated; TRACE-P1-010 closed |
| Blocked by | Data-platform or business owner availability; decision on QUANTITY sign semantics |
| Risk if skipped | Mass balance panel continues to show incomplete category mapping caveat; balance figures cannot be trusted for any investigative conclusion |

**Pack:** `domain-integrations/traceability/docs/mass-balance-semantic-validation-pack.md`

---

### Action 4 — Resolve BALANCE_QTY Semantics (TRACE-P1-011)

| Field | Value |
|---|---|
| Owner type | Data platform engineer |
| Databricks access required | Yes — spot-check across multiple batches required |
| Business owner required | No (technical clarification) |
| Expected output | All rows in `BALANCE_QTY Decision Table` in `mass-balance-semantic-validation-pack.md` filled in; V2 display updated (either use confirmed column or compute own balance); TRACE-P1-011 closed |
| Blocked by | Data platform availability; depends on QUANTITY sign clarity from Action 3 |
| Risk if skipped | `runningBalance` in mass balance panel remains untrustworthy; panel caveat cannot be removed |

---

### Action 5 — Confirm Lot-Selection Rule for QM UD Batch-Level Display

| Field | Value |
|---|---|
| Owner type | Kerry QM process owner |
| Databricks access required | No (governance decision) |
| Business owner required | Yes — which inspection lot is authoritative when a batch has multiple? |
| Expected output | Written confirmation of lot-selection rule; §6 of `qm-usage-decision-runtime-implementation-plan.md` updated; "go" issued for batch-level UD wiring |
| Blocked by | QM process owner availability; may also require data-platform to confirm whether multiple lots per batch are common |
| Risk if skipped | Batch-level UD evidence display cannot be safely wired; per-lot display is possible without this rule but requires explicit multi-lot UI |

---

### Action 6 — SPC Native Implementation Decision (post-PR #65 + post-contract-alignment)

| Field | Value |
|---|---|
| Owner type | Architecture / Kerry QM process owner (governance); Developer (implementation, follow-up) |
| Databricks access required | Yes — once a route is approved |
| Business owner required | Yes — for signal-calculation approach (frontend vs backend) and backend capability algorithm governance |
| Expected output | Decision recorded (proceed with `POST /api/spc/chart-data` minimum route per `spc-native-route-prerequisite-plan.md`, OR defer further). If proceeding: route implementation PR + frontend adapter PR + browser UAT against PR #65 candidates 1 and 2 |
| Blocked by | Governance decisions on signal calculation location, capability backend calculation, plant-namespace (`P`/`C`) mapping |
| Risk if skipped | SPC stays on V1 legacy bridge for the foreseeable future. The V1 bridge is documented as not browser-verified (`apps/api/routes/spc.py`); browser-verifying the V1 bridge is a separate task if Action 6 is deferred. |

**Background:** PR #65 verified the SPC schema in Databricks. The
contract-alignment tranche (PR #67, Slices 1-7, merged 2026-05-21) reconciled
V2 SPC contracts, fixtures, helper mappings, and an implementation plan to
that verified schema — but **deliberately did not wire any native runtime
route**. Action 6 is now a decision /
implementation gate, not a verification gate.

**Documents:**
- [`spc-databricks-verification-results-summary.md`](../../domain-integrations/spc/docs/spc-databricks-verification-results-summary.md)
- [`spc-native-contract-alignment-audit.md`](../../domain-integrations/spc/docs/spc-native-contract-alignment-audit.md)
- [`spc-v2-contract-mapping.md`](../../domain-integrations/spc/docs/spc-v2-contract-mapping.md) (rewritten 2026-05-21)
- [`spc-native-route-prerequisite-plan.md`](../../domain-integrations/spc/docs/spc-native-route-prerequisite-plan.md)
- [`spc-native-migration-readiness-checklist.md`](../../domain-integrations/spc/docs/spc-native-migration-readiness-checklist.md)

---

### Action 7 — Wire QM UD Read-Only Display (after Actions 5 and 6 gates pass)

| Field | Value |
|---|---|
| Owner type | Developer |
| Databricks access required | Yes — live route execution requires UAT environment |
| Business owner required | No (if lot-selection rule already confirmed in Action 5) |
| Expected output | Native `POST /api/quality/usage-decision` route; read-only display in Quality Evidence view; per-lot evidence table; governed labels from code mapping; all tests passing |
| Blocked by | Action 5 (lot-selection rule); Unity Catalog grants for `gold_inspection_usage_decision` + `gold_inspection_lot`; latest-row SQL template validated against live data |
| Risk if skipped | UD evidence remains mock-only in Quality and Traceability views |

**Plan:** `domain-integrations/quality/docs/qm-usage-decision-runtime-implementation-plan.md`

---

### Action 8 — Run Quality Broader Source Verification Pack

| Field | Value |
|---|---|
| Owner type | Developer with Databricks access |
| Databricks access required | Yes — pack covers inspection-lot, MIC result, specification, CoA-like, and deviation objects |
| Business owner required | No |
| Expected output | Evidence tables in `quality-databricks-source-verification.md` filled in; golden quality candidates updated |
| Blocked by | Databricks access |
| Risk if skipped | Quality read-only MIC/CoA/deviation display cannot be safely wired; column names and grain unconfirmed |

---

### Action 9 — Confirm Supplier Risk Governance Rules

| Field | Value |
|---|---|
| Owner type | Data platform engineer / QM process owner |
| Direct Databricks SQL access required | No for governance decision. Databricks access may be needed later to quantify supplier fan-out. |
| Business owner required | Yes — risk rules and supplier/batch causality must be confirmed before populating risk fields |
| Expected output | Governed rules for `openSupplierActions` and `highestRiskSupplier` defined; supplier risk field wiring can be planned |
| Blocked by | QM/risk governance; supplier/batch causality rule definition |
| Risk if skipped | `openSupplierActions` and `highestRiskSupplier` remain blocked indefinitely. Live first slice exists (PR #57) but risk fields cannot be wired without defined rules. |

---

### Action 10 — Warehouse Source Schema Alignment

| Field | Value |
|---|---|
| Owner type | Developer with Databricks access |
| Databricks access required | Yes |
| Business owner required | No (initially) |
| Expected output | Missing columns and views identified; warehouse migration audit updated; at least one route browser-verified |
| Blocked by | Databricks access; lower priority than Actions 1–5 |
| Risk if skipped | Warehouse360 remains trust-hardened but source-unverified |

---

## Summary Matrix

| # | Action | Dev task | Databricks needed | Business owner needed | Priority |
|---|---|---|---|---|---|
| 1 | Traceability UAT runbook | Yes | App access only (no direct SQL) | No | P0 |
| 2 | POH UAT runbook | Yes | App access only (no direct SQL) | No | P0 |
| 3 | Mass balance direction mapping | No | Optional | Yes | P1 |
| 4 | BALANCE_QTY semantics | Yes | Yes | No | P1 |
| 5 | UD lot-selection rule | No | No | Yes | P1 |
| 6 | SPC native implementation decision (contract alignment done 2026-05-21) | Yes (once approved) | Yes (when approved) | Yes (signal/capability governance) | P2 |
| 7 | Wire QM UD read-only display | Yes | Yes | No | P2 (after 5) |
| 8 | Quality broader source pack | Yes | Yes | No | P2 |
| 9 | Supplier risk governance | No | No (governance) | Yes | P2 |
| 10 | Warehouse schema alignment | Yes | Yes | No | P3 |

---

## What NOT to Do Next

- Do not add new live Databricks routes before Action 1 and 2 evidence is captured.
- Do not wire a native SPC Databricks route before Action 6's governance decisions
  are recorded and the prerequisite plan's go/no-go checklist passes.
- Do not wire UD batch-level display before the lot-selection rule (Action 5) is confirmed.
- Do not implement Quality release/reject actions, e-signature, or SAP QM write-back — these are out of scope for the current phase.
- Do not claim production readiness for any domain until live UAT evidence is captured and reviewed.

---

## Do Not Start Yet

The following must not be started until their stated gate is passed:

- **Do not start native SPC Databricks routes** until the SPC verification pack (Action 6) is run and all 7 gold view objects are confirmed.
- **Do not start Quality release workflow.** No SAP QM write-back, release/reject actions, e-signature, or GxP approval flow — permanent constraint in this phase.
- **Do not add release/reject/approve/can-release UI.** These imply release authority and must not be introduced.
- **Do not remove mass-balance caveats** (TRACE-P1-010, TRACE-P1-011 banners) until MOVEMENT_CATEGORY direction is confirmed by data-platform/business owner and BALANCE_QTY semantics are verified.
- **Do not map MOVEMENT_CATEGORY direction** without business/data-platform validation (Action 3).
- **Do not use BALANCE_QTY as a running balance** until source semantics are confirmed (Action 4).
- **Do not expand Warehouse** until source validation catches up (Action 10 is P3 — defer until P0–P2 complete).
- **Do not make Genie shell-wide or decision-authoritative** until domain-level packs are live-validated and source-truthful.
- **Do not show mock/unavailable data as live.** Any panel not backed by a confirmed live route must retain its mock/unavailable label.

---

## Merge Checkpoint

| Area | Safe for controlled UAT? | Direct Databricks SQL required? | Business governance required? | Next action |
|---|---|---|---|---|
| Traceability | Yes — with mass-balance caveats | No for browser UAT; Yes for semantic validation | Yes for mass-balance direction and QM lot-selection | Run UAT evidence runbook |
| POH | Yes | No for browser UAT | No initially | Run POH UAT runbook |
| Quality | Not yet — no live runtime route wired | Yes for broader source verification | Yes for release/lot-selection | Finalise read-only UD display gate; verify broader sources |
| SPC | No | Yes | Later — for control-limit/use interpretation | Run SPC verification pack |
| Warehouse | No | Yes | Possibly | Defer until higher-priority domains unblocked |

---

## Data-Layer Completion Audit

A full cross-domain map of adapter methods, routes, contracts, source objects, and verification states is available in [`docs/data-layer/`](../data-layer/README.md) (audit completed 2026-05-21). The [ranked implementation backlog](../data-layer/data-layer-implementation-backlog.md) replaces the per-action next-steps in this document for data-layer work items.
