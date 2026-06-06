# SPC Native Migration Readiness Checklist

**Date:** 2026-05-22 (updated; original 2026-05-21)
**Status:** Slice 1 native subgroup route implemented 2026-05-22. Browser UAT pending. Production readiness blocked.
**Purpose:** Gate checklist before implementing native V2 SPC Databricks routes

> **Status note (2026-05-22).** `GET /api/spc/subgroups` (slice 1) is now implemented in
> `apps/api/routes/spc.py` (databricks-api mode only). The route queries
> `spc_quality_metric_subgroup_mv` and returns a narrow `SPCSubgroupResponse`.
>
> **What is unavailable (locked at Literal[False] / Literal[True] in the contract):**
> - **Capability (Cp/Cpk/Pp/Ppk): unavailable** — `spc_capability_detail_mv` absent in UAT;
>   `capabilityAvailable: false` is a contract literal, not a runtime flag.
> - **Nelson stored flags: unavailable** — `spc_nelson_rule_flags_mv` absent in UAT;
>   `nelsonStoredFlagsAvailable: false` is a contract literal.
> - **Signals: client-side only** — `signalsClientSideOnly: true` is a contract literal;
>   frontend must calculate Nelson rule violations; the route never claims "in control".
> - **Locked limits: deferred to slice 2** — `lockedLimits: null` always in slice 1.
>
> **What remains blocked:**
> - Browser UAT: no end-to-end browser test has been run with the V2 frontend against
>   UAT Databricks. Do not claim browser-verified or production-ready.
> - Frontend wire-up: `SPCMonitoringDatabricksApiAdapter.getControlChartSeries` requires
>   `unitOfMeasure` and `ControlChartPoint.status`; deferred to slice 3.
> - Full chart-data route (`POST /spc/chart-data`): deferred — locked limits and control
>   limit block still unresolved.
>
> See [`spc-native-route-prerequisite-plan.md`](./spc-native-route-prerequisite-plan.md)
> for the full implementation notes.

> This checklist must be completed before any V2 native SPC route (either V1 proxy or direct
> Databricks API) is implemented, enabled, or tested against live data. All items are currently
> unverified. No item may be marked complete without the evidence documented in the linked
> verification documents.

---

## 1. Object Inventory

- [ ] **Object inventory complete** — `SHOW TABLES IN connected_plant_uat.gold LIKE '*spc*'` run
  and all objects listed in `spc-databricks-source-verification.md` Section 9.1
  - Evidence required: Screenshot or table output from Databricks SQL editor
  - Document: [spc-databricks-source-verification.md](./spc-databricks-source-verification.md)

- [ ] **All required SPC objects present** — at minimum these must exist:
  - `spc_quality_metric_subgroup_v`
  - `spc_locked_limits`
  - `spc_material_dim_mv`
  - `spc_plant_material_dim_mv`
  - `spc_characteristic_dim_mv`
  - Evidence required: `SHOW TABLES` output confirming all present

---

## 2. Object Types Confirmed

- [ ] **`spc_quality_metrics` confirmed as AI/BI Metric View** — NOT a signal or alarm table
  - Evidence required: `DESCRIBE EXTENDED spc_quality_metrics` output showing Type = METRIC_VIEW
  - Document: [spc-databricks-source-verification.md](./spc-databricks-source-verification.md) Section 6

- [ ] **`spc_quality_metric_subgroup_v` confirmed as regular VIEW** (not a table, not an MV)
  - Evidence required: `DESCRIBE EXTENDED` Type field

- [ ] **`spc_locked_limits` confirmed as Delta table** (MANAGED or EXTERNAL)
  - Evidence required: `DESCRIBE EXTENDED` Type field

- [ ] **`spc_capability_detail_mv` confirmed as MATERIALIZED_VIEW**
  - Evidence required: `DESCRIBE EXTENDED` Type field

---

## 3. Columns / Data Types Confirmed

- [x] **`spc_quality_metric_subgroup_v` columns verified against live DDL — with SCHEMA DIFFERENCES**
  - 34 columns confirmed 2026-05-21; significant differences from V1 expectations
  - V1-expected columns ABSENT: `sample_id`, `result_value`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`, `subgroup_sd`, `inspection_lot_id`, `unit_of_measure`
  - Replacements: `value` (not `result_value`); `batch_date` (not `sample_timestamp`); `sum_value`/`batch_n` for mean; `batch_range` for range
  - New columns: `material_name`, `plant_name`, `any_rejection`, `any_acceptance`, `normality_type`, `spec_type`, etc.
  - `usl_spec` and `lsl_spec` ARE present in this view
  - Evidence: 2026-05-21 Databricks CLI verification; see spc-databricks-source-verification.md Section 9.3
  - Document: [spc-data-model-grain-assessment.md](./spc-data-model-grain-assessment.md)

- [x] **`spc_locked_limits` columns verified against live DDL — 19 columns confirmed**
  - All 19 columns confirmed 2026-05-21; matches V1 migration-014 expectations
  - Column name discrepancy RESOLVED: `baseline_from`/`baseline_to` confirmed (not `effective_from`/`effective_to`); `locking_note` confirmed (not `provenance`)
  - No `usl`/`lsl` columns — spec limits are in subgroup view, NOT in locked_limits
  - Evidence: 2026-05-21 Databricks CLI verification; see spc-control-limit-provenance-verification.md
  - Document: [spc-control-limit-provenance-verification.md](./spc-control-limit-provenance-verification.md)

- [!] **`spc_capability_detail_mv` columns verified** — BLOCKED: object NOT FOUND in UAT
  - Finding: migration 013 not applied; all Cp/Cpk/Pp/Ppk columns unavailable
  - Document: [spc-capability-verification.md](./spc-capability-verification.md)

---

## 4. Grain Confirmed

- [ ] **`spc_quality_metric_subgroup_v` grain confirmed**
  - Must confirm: grain is `(material_id, plant_id, mic_id, operation_id, batch_id, sample_id)`
    with no duplicates, OR grain is understood if duplicates exist
  - Evidence required: HAVING COUNT(*) > 1 query returning 0 rows (or explanation)
  - Document: [spc-data-model-grain-assessment.md](./spc-data-model-grain-assessment.md)

- [ ] **`spc_locked_limits` grain confirmed**
  - Must confirm: whether multiple rows per (material_id, mic_id, plant_id, operation_id, chart_type)
    exist and if so, how to select the current one
  - Evidence required: HAVING COUNT(*) > 1 query result

- [ ] **`spc_capability_detail_mv` grain confirmed**
  - Must confirm: one row per (material_id, plant_id, mic_id)
  - Evidence required: HAVING COUNT(*) > 1 query result

---

## 5. Navigation Model Confirmed

- [ ] **Material-first navigation verified in data**
  - Must confirm: DISTINCT material_id values exist in `spc_material_dim_mv` or subgroup view
  - Evidence required: DISTINCT material query result
  - Document: [spc-navigation-model-verification.md](./spc-navigation-model-verification.md)

- [ ] **Plant-per-material navigation verified**
  - Must confirm: `spc_plant_material_dim_mv` rows exist and are scoped to material
  - Evidence required: WHERE material_id = candidate query result

- [ ] **MIC-per-material+plant navigation verified**
  - Must confirm: `spc_characteristic_dim_mv` rows exist for a candidate
  - Evidence required: WHERE material_id AND plant_id = candidate query result

- [ ] **`operation_id` values understood**
  - Must confirm: format of operation_id values and whether they map to V2 `workCentreId`
  - Evidence required: DISTINCT operation_id query result
  - Document: [spc-navigation-model-verification.md](./spc-navigation-model-verification.md)

---

## 6. Locked Limit Source Confirmed

- [ ] **`spc_locked_limits` has at least one row with non-NULL UCL/LCL/CL**
  - Evidence required: SELECT * LIMIT 20 showing populated limit values
  - Document: [spc-control-limit-provenance-verification.md](./spc-control-limit-provenance-verification.md)

- [ ] **Limit column name discrepancy resolved**
  - `usl`/`lsl` vs `spec_signature`, `effective_from` vs `baseline_from` — resolved by DDL check
  - Evidence required: `DESCRIBE TABLE` output confirming exact column names

- [ ] **Approval/provenance derivation confirmed**
  - `locked_by` field confirmed present and how approvalState is derived from it
  - Evidence required: Sample rows showing `locked_by` values

---

## 7. Control vs Specification Limits Separated

- [ ] **Control limits (UCL/LCL/CL) source confirmed**
  - Dual mode: live (computed) vs locked (`spc_locked_limits`)
  - Evidence required: live limits computed from subgroup statistics; locked limits from DDL

- [ ] **Specification limits (USL/LSL) source confirmed**
  - Must confirm whether from `spc_quality_metric_subgroup_v.usl_spec/lsl_spec` or `spc_locked_limits`
  - Evidence required: column value check in sample rows

- [ ] **V2 `upperSpecLimit` / `lowerSpecLimit` sources identified and distinct from UCL/LCL**
  - Document: [spc-control-limit-provenance-verification.md](./spc-control-limit-provenance-verification.md)

---

## 8. Rule / Signal Source Classified

- [x] **Absence of signal/alarm storage tables confirmed**
  - Finding: 0 objects for *signal*, *alarm*, *rule*, *violation* patterns confirmed 2026-05-21
  - Document: [spc-rule-signal-source-verification.md](./spc-rule-signal-source-verification.md)

- [!] **`spc_nelson_rule_flags_mv` exists and grain confirmed** — BLOCKED: NOT FOUND in UAT
  - Finding: migration 012 not applied; batch-level rule flag summaries unavailable from Databricks

- [ ] **V2 signal computation approach decided**
  - Decision: compute signals in V2 frontend like V1 (recommended) OR design new storage
  - Evidence required: team decision recorded in architecture doc or ADR

---

## 9. Capability Source Classified

- [ ] **`spc_capability_detail_mv` exists, has rows, and `cpk` is non-NULL for at least one row**
  - Evidence required: COUNT(*) > 0 and sample rows showing cpk values
  - Document: [spc-capability-verification.md](./spc-capability-verification.md)

- [ ] **Refresh cycle confirmed (expected: 4h)**
  - Staleness risk documented for V2 UI

- [ ] **Spec limit source for capability confirmed** (for `Cp = (USL-LSL)/6σ`)
  - Must confirm where USL/LSL comes from in the MV definition

---

## 10. At Least One Golden Candidate Verified

- [ ] **Discovery query run** and at least one material/plant/MIC combination with >= 20 sample
  points found in `spc_quality_metric_subgroup_v`
  - Evidence required: discovery query results
  - Document: [golden-spc-candidates.md](./golden-spc-candidates.md)

- [ ] **Candidate entry created in golden-spc-candidates.md** with all fields populated from
  actual query results (no invented values)

- [ ] **Sample chart data fetched** for the candidate — SELECT * LIMIT 50 on subgroup view

---

## 11. V2 Contract Mapping Completed

- [x] **All "pending verification" fields in spc-v2-contract-mapping.md updated** with verified
  source columns and source-truthful classifications (directly-sourced / derived /
  source-unavailable / blocked / legacy-bridge-only / unknown / requires-contract-change /
  requires-future-native-mapper) — rewritten 2026-05-21 against PR #65
  - Document: [spc-v2-contract-mapping.md](./spc-v2-contract-mapping.md)
  - Companion: [spc-native-contract-alignment-audit.md](./spc-native-contract-alignment-audit.md)

- [x] **Chart type rename mapping confirmed** (V1 `imr` → V2 `individuals`, etc.) — documented
  in `spc-v2-contract-mapping.md` §2

- [x] **`SPCAlarmHistoryItem` gap accepted** — acknowledged that no stored alarm history exists
  in V1 or in `connected_plant_uat.gold`, and the panel will remain mock-only or be deferred
  when a native route is wired. Documented in `spc-v2-contract-mapping.md` §12

- [x] **Semantic-model functional parity audit completed** — standalone `timgeldard/spc` app
  compared against ConnectIO-RAD and verified Databricks `spc_*` objects. Top findings:
  `spc_process_flow_source_mv`, `spc_lineage_graph_mv`, `spc_correlation_source_mv`, and
  `spc_attribute_subgroup_mv` are all present in UAT but unwired in ConnectIO-RAD (surfacing
  gaps, not source gaps). `spc_capability_detail_mv` and `spc_nelson_rule_flags_mv` remain
  confirmed absent. `CharacteristicCapabilitySchema.cp/cpk/pp/ppk` should be relaxed to
  optional in a follow-on contract PR.
  - Document: [spc-semantic-model-functional-parity.md](./spc-semantic-model-functional-parity.md)

---

## 12. Source Truthfulness Wording Updated

- [ ] **`spc-known-limitations.md` updated** with any new findings from verification
  - Document: [spc-known-limitations.md](./spc-known-limitations.md)

- [ ] **SPC README updated** if implementation status changes
  - Document: [README.md](../README.md)

- [ ] **`domain-readiness-index.md` SPC section updated** with current verified status
  - Document: [domain-readiness-index.md](../../../docs/readiness/domain-readiness-index.md)

- [ ] **No UI changes show SPC data as production-ready** until the above are all complete

---

## 13. Tests Planned

- [ ] **Mock adapter tests remain green** — no existing mock adapter tests broken by verification
  findings

- [ ] **New contract tests designed** for legacy-api adapter (once proxy routes are implemented)

- [ ] **New column verification tests designed** for Databricks adapter (once native routes exist)

---

## 14. UAT Evidence Template Prepared

- [ ] **`spc-uat-acceptance-script.md` updated** to include:
  - A live-mode test case (requires golden candidate)
  - Source badge verification (amber for legacy-api, green for databricks-api)
  - Column-level evidence capture

---

## Go / No-Go Criteria

### Proceed with V2 SPC live implementation (Option 1: V1 Proxy) if:

- Items 1, 2, 3 (object/column verification) are complete
- Item 5 (navigation model) is confirmed material-first
- Item 6 (locked limits) has at least one row
- Item 10 (golden candidate) has at least one verified candidate
- V1 SPC app is confirmed reachable from V2 Databricks Apps environment

### Proceed with V2 SPC native Databricks implementation (Option 2) — **minimum chart-data route** — if:

The minimum native chart-data route (`POST /api/spc/chart-data` per
[`spc-native-route-prerequisite-plan.md`](./spc-native-route-prerequisite-plan.md))
deliberately does NOT depend on the two NOT FOUND MVs. It can proceed when:

- Items 1, 3, 4 (object inventory, columns, grain) are complete (3 and 4 are done for
  the subgroup MV and locked-limits per PR #65; subgroup grain confirmed as
  measurement-level)
- Item 5 (navigation model) is confirmed material-first
- Item 6 (locked limits) is understood — the single UAT row is documented as
  `uat-fixture-only` and the route's provenance ceiling is `pending-validation`
- Item 10 (golden candidate) — PR #65 identified three partially-verified candidates
- §11 contract mapping is rewritten against the verified schema (done 2026-05-21)
- Signals: the route ships `signals_source` (calculated-frontend / calculated-backend /
  not-yet-evaluated / unavailable) without storing signals; rule detection runs
  separately (today: frontend `calculations.runtime.ts`)
- Capability: the route ships `capability_source` (unavailable / backend-calculation-required
  / legacy-bridge / present-from-mv) without returning Cp/Cpk fields; the existing legacy
  `/api/spc/capability` proxy continues to serve capability until governance authorises
  a backend calculation
- All "must NOT be relaxed" items in
  [`spc-native-route-prerequisite-plan.md`](./spc-native-route-prerequisite-plan.md) §14.3
  hold

### Proceed with V2 SPC native Databricks implementation (Option 2) — **full** — if:

- All items in this checklist are complete
- V2 contract mapping is fully resolved (no "pending" or "unknown" confidence values)
- Signal computation approach is decided and documented in an ADR
- Capability MV is deployed in UAT OR a backend capability algorithm is authorised by
  Kerry QM process owner
- At least one golden candidate has been end-to-end tested

### Do NOT proceed if any of the following are true:

- `spc_quality_metric_subgroup_v` does not exist or has zero rows
- `material_id` is absent from `spc_locked_limits`
- No golden candidate can be identified
- Unity Catalog / OAuth access is blocked in the V2 deployment environment
- Column names differ materially from V1 source documentation and the discrepancies
  are not documented and resolved
- Any SPC chart panel shows "In control" or "No signals" in a way that implies
  a verified process state — UI truthfulness must be confirmed first
