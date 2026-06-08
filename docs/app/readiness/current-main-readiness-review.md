# Post-Merge Main Readiness Review

**Branch basis:** `main` after merging PR #61 (QM usage-decision source verification) and PR #62 (POH hardening)
**Date:** 2026-05-21
**Purpose:** Honest status snapshot to coordinate controlled UAT entry and future Databricks-enabled validation.
**Constraint:** No Databricks access assumed. No new verification claimed. No production readiness claimed.

---

## 1. Executive Summary

Main is now in a strong documentation and code-foundation state across Traceability and POH. Quality/QM has progressed from discovery-only to technically verified usage-decision source documentation and read-only implementation planning. Broader Quality evidence remains verification-pending, no live runtime route is wired, and release decisions remain blocked. SPC has a complete verification pack but no native implementation. Warehouse and Quality release remain blocked for live UAT.

The next phase is **evidence capture in a deployed environment**, not further feature expansion. Two domains are ready for controlled UAT evidence runs (Traceability, POH). Two domains have actionable validation packs that require Databricks access (SPC, mass balance semantics). One domain (Quality read-only evidence) has its source verified and code mapping confirmed but no live runtime route yet.

No domain has passed live UAT. No production readiness is claimed.

---

## 2. Domain Status

### 2.1 Traceability

**Overall status:** `live-UAT-pending`

| Slice | Status | Notes |
|---|---|---|
| Batch header | `browser-UAT-pending` | Live Databricks route exists; `gold_batch_stock_v` + `gold_batch_summary_v` columns confirmed; plant-scoped query wired; browser E2E not yet performed |
| Trace graph | `browser-UAT-pending` | Native route functional and browser-verified as of 2026-05-18 in shell UI |
| Customer exposure (lineage-first) | `browser-UAT-pending` | Route wired; LINK_TYPE='DELIVERY' value not live-confirmed (DEF-TRACE-005) |
| Customer deliveries (V1-parity) | `browser-UAT-pending` | `gold_batch_delivery_v` 17 columns confirmed live 2026-05-20 (CD-1/CD-2/CD-3 done); CD-4 through CD-6 require browser UAT |
| Supplier exposure | `browser-UAT-pending` | Live first slice from `gold_batch_lineage` + `gold_supplier` (PR #57); per-supplier rows available where supplier attribution exists. Browser UAT pending. `openSupplierActions` unavailable; `highestRiskSupplier` absent — supplier risk governance pending. Not a supplier corrective-action list. |
| Production history | `browser-UAT-pending` | Native route and mapper exist; source from `gold_batch_production_history_v` |
| Mass balance | `source-semantics-pending` | Route live; 11 columns confirmed; MOVEMENT_CATEGORY mapping incomplete (TRACE-P1-010); BALANCE_QTY semantics unverified (TRACE-P1-011); panel shows caveats |
| Quality status (batch header) | `source-semantics-pending` | UD source/schema/grain verified; 9 codes governed (2026-05-21); runtime wiring still not implemented; `qualityStatus` shows `unknown`/`pending` from stock proxy only |
| Queried-at / confidence labels | `code-fixed` | Confidence badge, truncation banner, queried-at timestamps implemented |
| QM usage-decision runtime | `governance-pending` → now `docs-ready` | All 9 UD codes governed 2026-05-21; fan-out selection rule still needed before wiring |

**Open defects:** DEF-TRACE-001 (null exposure → UNKNOWN — code-fixed, live-pending), DEF-TRACE-002 (truncation banner — code-fixed, live-pending), DEF-TRACE-003 (depth-aware severity — schema-ready, live-pending), DEF-TRACE-005 (LINK_TYPE live confirmation pending), DEF-TRACE-006 (CD-4 through CD-6 browser UAT pending).

**Open backlog items:** TRACE-P1-010 (movement category mapping), TRACE-P1-011 (BALANCE_QTY semantics), TRACE-P1-012 (UD runtime wiring — source verified, codes governed, fan-out rule needed).

---

### 2.2 Process Order History (POH)

**Overall status:** `browser-UAT-pending`

| Slice | Status | Notes |
|---|---|---|
| Order header | `browser-UAT-pending` | Native route (`vw_gold_process_order`); mapper exists; some fields null in source |
| Operations | `browser-UAT-pending` | Native route (`vw_gold_process_order_phase`); work centre and dates absent in confirmed source |
| Confirmations | `browser-UAT-pending` | Native route (`vw_gold_confirmation`); no-record ≠ no confirmations |
| Goods movements | `browser-UAT-pending` | Native route (`vw_gold_adp_movement`); direction mapped; `materialDescription` absent |
| Component consumption | `code-fixed` | **PR #62:** Groups by `materialId + batchId + normalised UOM`; multiple batches separate; mixed UOMs not summed; zero/negative rows visible |
| Produced output | `code-fixed` | **PR #62:** Zero/negative net rows preserved (full reversals visible) |
| Source attribution | `code-fixed` | **PR #62:** `getSectionSource` derives from `AdapterResult.source`; tests TC-1–TC-8 added |
| Copy UAT evidence | `code-fixed` | Payload includes mode, section sources, completeness, counts, warnings |
| Browser E2E | `browser-UAT-pending` | No browser-verified run against live Databricks for POH routes yet |

**Known UAT candidate:** process order `7006965038`, plant `C113`.

---

### 2.3 Quality / QM

**Overall status:** `live-UAT-pending` (read-only evidence not yet wired)

| Item | Status | Notes |
|---|---|---|
| V1 source discovery | `docs-ready` | Completed 2026-05-21; read-only inspection/MIC/UD/CoA-result evidence found; no governed release workflow found |
| Read-only evidence contracts | `docs-ready` | Zod contracts in `@connectio/data-contracts`; no live route wired |
| QM UD source object/schema/grain | `source-object-verified` | `gold_inspection_usage_decision`; 13 columns; 15.47M rows; grain `(INSPECTION_LOT_ID, USAGE_DECISION_COUNTER)` — 0 duplicates |
| QM UD inspection-lot join | `source-object-verified` | Two-hop join to material/batch/plant via `gold_inspection_lot` confirmed |
| QM UD code mapping | `docs-ready` | All 9 codes governed 2026-05-21: A=Accepted, AE=Accepted(EM), AC=Accepted with concession, ACE=Accepted with concession(EM), A9=Accepted batch-restricted, R=Rejected, RE=Rejected(EM), RR=Rejected globally, ''=Pending/lot-open |
| QM UD runtime wiring | `live-UAT-pending` | No native route; no live display; fan-out selection rule (multiple lots per batch) still needed before wiring |
| Broader Quality source pack | `verification-pack-ready` | `quality-databricks-source-verification.md` pack exists; no SQL run against inspection-lot/MIC/CoA objects |
| Quality release decisions | `production-blocked` | No SAP QM write-back, e-signature, GxP audit trail. Permanent constraint in current phase |
| Quality Lab Board (Lab view) | `browser-UAT-pending` | V1 legacy proxy routes exist (`/api/cq/lab/fails`, `/api/cq/lab/plants`); browser E2E not confirmed |

---

### 2.4 SPC

**Overall status:** `contract-alignment-complete` (no native runtime wired)

| Item | Status | Notes |
|---|---|---|
| V1 source discovery | `docs-ready` | SPC data confirmed in `connected_plant_uat.gold`; V1 is material-centric, client-side rule computation |
| Databricks verification pack | `verified` | Executed in PR #65 (2026-05-21); 22 SPC objects inventoried; subgroup MV (~73M rows) and locked_limits (1 UAT row) confirmed; `spc_capability_detail_mv` and `spc_nelson_rule_flags_mv` NOT FOUND |
| Native contract alignment | `contract-alignment-complete` | PR #67 (Slices 1-7, merged 2026-05-21): audit + rewritten contract mapping + verified fixtures + pure mapper helpers + 55 mapper tests + native route prerequisite plan + minimal additive `operationId` on `SPCMonitoringContextSchema`. **No native runtime route wired.** V1 legacy bridge remains the recommended short-term path. |
| Native V2 chart-data route | `prerequisite-plan-ready` | `POST /api/spc/chart-data` shape documented in `spc-native-route-prerequisite-plan.md`; go/no-go gates not yet met (decision on backend signal calculation, governance for backend capability, plant-namespace mapping); not implemented |
| FastAPI proxy routes | `source-semantics-pending` | Routes in `apps/api/routes/spc.py` exist but are NOT browser-verified against live V1 backend |
| Mock cockpit | `docs-ready` | High-fidelity sandbox; source truthfulness banners active; control-limit provenance tracking in UI; mock data unchanged by the contract-alignment tranche |

---

### 2.5 Warehouse

**Overall status:** `source-semantics-pending`

| Item | Status | Notes |
|---|---|---|
| Overview route | `browser-UAT-pending` | Returned HTTP 200 in UAT; other routes partly blocked by schema alignment |
| Schema/source verification | `source-semantics-pending` | Specific missing columns/views not confirmed; warehouse migration audit pending |
| Expansion | `production-blocked` | Do not expand Warehouse in current tranche |

---

### 2.6 Genie / Natural-Language Assistant

**Overall status:** `docs-ready` (pilots scoped; shell blocked)

| Item | Status | Notes |
|---|---|---|
| POH Assistant Pilot | `browser-UAT-pending` | Scoped to approved operations, confirmations, movements, conditional header questions |
| Traceability Assistant Pilot | `browser-UAT-pending` | Scoped to focal batch summary and visible trace graph |
| Shell-wide assistant | `production-blocked` | Blocked until domain-level packs are validated and source-truthful |
| Genie readiness packs | `docs-ready` | POH and Traceability packs created; SPC Genie pack exists |

---

## 3. Recently Merged PR Impacts

| PR | Scope | Net impact on main |
|---|---|---|
| PR #62 — POH hardening | `order-history-view.tsx` + tests | Component consumption and produced output now group by `materialId + batchId + UOM`; zero/negative rows preserved; source attribution confirmed |
| PR #61 — QM usage-decision source verification | 10 `.md` docs only | Source object, schema, grain, join verified; 9 raw codes captured; governed code mapping confirmed (2026-05-21); fan-out gate added; cross-domain consumption rules defined; no runtime code changed |

Neither PR introduced new live Databricks routes, new Zod schema fields, or changes to any panel outside POH.

---

## 4. What Is Now Code-Fixed

| Item | Fixed in | Verification status |
|---|---|---|
| POH component consumption grouping (multi-batch, mixed UOM, zero rows) | PR #62 | Code-fixed; browser UAT pending |
| POH produced output zero/negative rows | PR #62 | Code-fixed; browser UAT pending |
| POH source attribution from AdapterResult.source | PR #62 | Code-fixed; tests added; browser UAT pending |
| DEF-TRACE-001: null customer exposure → UNKNOWN severity | Earlier PR | Code-fixed; live validation pending |
| DEF-TRACE-002: trace graph truncation banner | Earlier PR | Code-fixed; live validation pending |
| DEF-TRACE-004: batch header error/not-found banner | Earlier PR | Code-fixed; live validation pending |
| Customer deliveries (gold_batch_delivery_v) column names | Earlier PR | Databricks CLI verified; browser UAT pending |

---

## 5. What Is Source-Verified

(Verified via Databricks CLI with user-authorised access, no service-principal.)

| Source object | Verified items | Date |
|---|---|---|
| `gold_inspection_usage_decision` | Object name, 13 columns, grain `(INSPECTION_LOT_ID, USAGE_DECISION_COUNTER)`, inspection-lot join, 9 code values + governed meanings | 2026-05-21 |
| `gold_batch_delivery_v` | 17 columns; MATERIAL_ID + BATCH_ID as WHERE keys; UOM + COUNTRY_NAME present; live delivery rows confirmed | 2026-05-20 |
| `gold_batch_mass_balance_v` | 11 columns; MATERIAL_ID + BATCH_ID as keys; MOVEMENT_CATEGORY live values captured; BALANCE_QTY always 0 for UAT candidate | 2026-05-20 |
| `gold_batch_stock_v` | All columns confirmed; UNRESTRICTED/BLOCKED/QI_HOLD/RESTRICTED/TRANSIT present | 2026-05-19 |
| `gold_batch_summary_v` | Column names confirmed | 2026-05-19 |
| `gold_batch_lineage` | Downstream CTE and LINK_TYPE column existence confirmed (value 'DELIVERY' unconfirmed live) | 2026-05-18/19 |

---

## 6. What Is Still Governance-Pending

| Item | Why blocked | Required action |
|---|---|---|
| QM UD runtime wiring — lot selection rule | Multiple inspection lots per material/batch/plant may exist; governed selection rule (which lot is authoritative?) needed before batch-level display | Kerry QM process owner to confirm selection rule |
| Mass balance direction mapping (TRACE-P1-010) | MOVEMENT_CATEGORY values (STO Receipt, STO Transfer, Other (261), Other (321), Write-Off, etc.) have no confirmed directional meaning | Data platform / business owner to provide direction map |
| BALANCE_QTY semantics (TRACE-P1-011) | Column always 0 in UAT spot check; unclear if it is a precomputed balance, placeholder, or different source | Data platform team to clarify semantics |
| LINK_TYPE='DELIVERY' live value | Inferred from V1 source; not confirmed against live Databricks query | Run CE-4 scenario in UAT |
| Supplier risk governance | `openSupplierActions` and `highestRiskSupplier` remain blocked until QM/risk governance and supplier/batch causality rules are defined. Live first slice exists (PR #57) but risk fields are not wired. | Define supplier risk rules with data platform and QM process owner |
| Quality release workflow | No governed SAP QM write-back, e-signature, GxP workflow exists | Permanent constraint — out of scope |

---

## 7. What Is Still Databricks-Verification-Pending

These items have verification pack SQL templates ready but no SQL has been run against the live objects:

| Item | Pack location | Blocking wiring |
|---|---|---|
| SPC: contract alignment vs verified schema | `domain-integrations/spc/docs/spc-native-contract-alignment-audit.md` (done 2026-05-21) | Native SPC chart-data route prerequisite plan now exists |
| Quality: inspection lot object | `domain-integrations/quality/docs/quality-databricks-source-verification.md` | Quality inspection lot display |
| Quality: MIC result object | Same pack | Quality MIC/result display |
| Quality: CoA-like result object | Same pack | Quality CoA evidence display |
| Quality: deviation object | Same pack | Quality deviation display |
| QM UD: PO→lot→UD join | `qm-usage-decision-grain-and-joins.md` §5 | POH QM UD display |
| QM UD: multiple lots per batch fan-out | Same doc §7 | Batch-level UD display |
| `gold_batch_delivery_v` CD-4–CD-6 browser scenarios | `uat-validation-ledger.md` DEF-TRACE-006 | Browser UAT sign-off |

---

## 8. What Is Still Browser-UAT-Pending

| Domain | What needs browser validation |
|---|---|
| Traceability | Full E2E run: batch header, trace graph, customer exposure, customer deliveries, mass balance, quality status display — against deployed app with `databricks-api` mode and live OAuth |
| POH | All 4 routes (header, operations, confirmations, goods movements) in the deployed UI; component consumption rows compared to SAP source; produced output rows |
| Quality Lab Board | `/api/cq/lab/fails` and `/api/cq/lab/plants` routes against live V1 Connected Quality backend |
| Warehouse | Overview and sub-routes against live source with schema alignment confirmed |

---

## 9. What Must Remain Blocked

| Item | Reason | Status |
|---|---|---|
| SAP QM release/reject write-back | No governed GxP workflow; no e-signature | Permanent — out of phase scope |
| Quality governed UD display labels (batch-level) | UD codes are governed for read-only display labels only — BUT lot-selection rule still needed before batch-level display. "Accepted"/"Rejected" are governed source labels only, not release authorisations or app decisions. | Blocked pending lot-selection rule |
| SPC native Databricks routes | Verification pack not yet run; data model not established | Blocked until pack executed |
| Warehouse expansion | Source validation still pending | Deferred |
| Shell-wide Genie/assistant | Domain packs not yet live-validated | Blocked |
| Service-principal fallback for Databricks reads | Security rule — all reads must use end-user OAuth | Permanent |
| Mock data shown as live | UX truthfulness rule | Permanent |

---

## 10. Recommended Next Order of Work

| Priority | Action | Owner type | Databricks required | Business owner required |
|---|---|---|---|---|
| 1 | Run Traceability UAT evidence runbook against deployed app | QA / developer with UAT access | No (direct SQL); deployed app in `databricks-api` mode required | No (initially) |
| 2 | Run POH UAT evidence runbook against deployed app | QA / developer with UAT access | No (direct SQL); deployed app in `databricks-api` mode required | No (initially) |
| 3 | Resolve TRACE-P1-010 (movement category directions) with data-platform owner | Data platform / business | No (governance) | Yes |
| 4 | Resolve TRACE-P1-011 (BALANCE_QTY semantics) with data-platform owner | Data platform | No (governance) | Yes |
| 5 | Confirm lot-selection rule for QM UD batch-level display | Kerry QM process owner | No (governance) | Yes |
| 6 | Run SPC Databricks verification pack against live objects | Developer with Databricks access | Yes | No |
| 7 | Wire QM UD read-only display (after lot-selection rule confirmed) | Developer | Yes | No |
| 8 | Run Quality broader source verification pack (inspection-lot, MIC, CoA) | Developer with Databricks access | Yes | No |
| 9 | Confirm supplier risk governance rules | Data platform / QM process owner | No (governance) | Yes |
| 10 | Warehouse source schema alignment | Developer with Databricks access | Yes | No |

---

## 11. Merge Checkpoint

| Area | Safe for controlled UAT? | Direct Databricks SQL required? | Business governance required? | Next action |
|---|---|---|---|---|
| Traceability | Yes — with mass-balance caveats | No for browser UAT; Yes for semantic validation | Yes for mass-balance direction and QM lot-selection | Run UAT evidence runbook |
| POH | Yes | No for browser UAT | No initially | Run POH UAT runbook |
| Quality | Not yet — no live runtime route wired | Yes for broader source verification | Yes for release/lot-selection | Finalise read-only UD display gate; verify broader sources |
| SPC | No | Yes | Later — for control-limit/use interpretation | Run SPC verification pack |
| Warehouse | No | Yes | Possibly | Defer until higher-priority domains unblocked |

---

## 12. Data-Layer Completion Audit

A full cross-domain map of adapter methods, routes, contracts, source objects, and verification states is available in [`docs/data-layer/`](../data-layer/README.md) (audit completed 2026-05-21).

| Document | Purpose |
|---|---|
| [Completion inventory](../data-layer/data-layer-completion-inventory.md) | 49 capabilities across 9 domains with dual status taxonomy |
| [Contract-route matrix](../data-layer/contract-route-coverage-matrix.md) | Zod schemas → FastAPI routes → generated Python models |
| [Adapter coverage audit](../data-layer/adapter-coverage-audit.md) | All adapter methods, fallback risks, source-badge compliance |
| [Source verification coverage](../data-layer/source-verification-coverage.md) | Master ledger of all source objects and verification dimensions |
| [Implementation backlog](../data-layer/data-layer-implementation-backlog.md) | 14 ranked work packages with owners and blockers |
