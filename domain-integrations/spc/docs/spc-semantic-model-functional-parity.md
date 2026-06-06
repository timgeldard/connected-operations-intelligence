# SPC Semantic-Model Functional Parity Audit

**Date:** 2026-05-22
**Author:** tim.geldard@kerry.com
**Branch:** `feature/spc-native-contract-alignment`
**Status:** Documentation only — no runtime code changes in this document.

**References:**
- Standalone SPC app: `github.com/timgeldard/spc`
- ConnectIO-RAD: `github.com/timgeldard/connectio-rad-v2`
- Databricks UAT: `connected_plant_uat.gold.*` (verified 2026-05-21)

---

## 1. Executive Summary

The standalone `timgeldard/spc` app appears functionally richer at the UI/API level. However,
a significant portion of that apparent gap is not a true missing-feature gap — it is an
**exposure gap**: Databricks `spc_*` semantic objects already contain the data and pre-computed
aggregates that back most standalone SPC features, but ConnectIO-RAD has not yet surfaced them
through native routes, contracts, or frontend adapters.

### Current state

| Dimension | Standalone `spc` | ConnectIO-RAD |
|---|---|---|
| End-user functionality | Richer — charts, scorecard, process flow, correlation, MSA, Genie, export | Narrower — subgroup slice only (slice 1), rest via legacy-api proxy |
| Contract / source governance | Implicit — types inferred from usage | Explicit — Zod schemas, source-truthfulness, literal-locked unavailable fields |
| Databricks semantic model usage | Direct — reads `spc_*` objects natively | Partial — slice 1 route reads `spc_quality_metric_subgroup_mv`; navigation dim MVs unwired |
| Mock fallback | None — direct Databricks only | Present (`mock` adapter mode) — correctness risk if mock drifts |
| Rate limiting | SlowAPI per-user token-hash rate limiting | None on SPC adapter calls |
| Pagination | Cursor-based (5-component composite cursor) | None — single page only |
| Locked limits write | Supported (POST + DELETE) | Not implemented — read-only stance |

### Key finding

The standalone app uses `spc_process_flow_source_mv`, `spc_lineage_graph_mv`,
`spc_correlation_source_mv`, and `spc_attribute_subgroup_mv` — all **verified present** in UAT but
**completely unwired** in ConnectIO-RAD. These are not missing source objects; they are surfacing
gaps. The two genuinely missing sources are `spc_capability_detail_mv` and
`spc_nelson_rule_flags_mv`, both confirmed absent in UAT.

---

## 2. Parity Assessment Model

Each feature is assessed across five layers:

```
Standalone SPC feature
  → Databricks spc_* semantic object / column / metric
  → Source verification status (connected_plant_uat, 2026-05-21)
  → ConnectIO-RAD contract status (Zod schema in spc-monitoring.ts)
  → ConnectIO-RAD route status (apps/api/routes/spc.py)
  → ConnectIO-RAD frontend/UI status (domain-integrations/spc/src)
  → Readiness classification
```

### Classification key

| Code | Meaning |
|---|---|
| `already-in-semantic-model` | Source object verified in Databricks; data is available |
| `exposed-in-route` | ConnectIO-RAD native route implemented and queryable |
| `exposed-in-ui` | Frontend adapter wired; panel renders data |
| `legacy-bridge-only` | Available via V1 proxy; not yet native |
| `needs-contract-change` | Zod schema must be updated before wiring |
| `needs-native-route` | Source verified; route not yet implemented |
| `needs-frontend-wiring` | Route implemented; frontend adapter not wired |
| `needs-browser-UAT` | Route implemented; no end-to-end browser test run |
| `needs-Databricks-verification` | Source not yet confirmed in UAT |
| `needs-governance` | Business/approval rules not defined |
| `source-unavailable` | Source object confirmed absent in UAT |
| `blocked` | Multiple unresolved dependencies |

---

## 3. Standalone SPC Capability Inventory

### 3.1 Navigation and data retrieval

| Capability | Computation location | Backend source |
|---|---|---|
| Material list | SQL | `spc_material_dim_mv` |
| Plant list per material | SQL | `spc_plant_material_dim_mv` |
| MIC/characteristic list per material+plant | SQL | `spc_characteristic_dim_mv` + `spc_quality_metric_subgroup_v` + `spc_attribute_quality_metrics` |
| Attribute characteristic list | SQL | `spc_attribute_quality_metrics` |
| Material validation | SQL | `spc_material_dim_mv` |
| Subgroup chart data (quantitative) | SQL + cursor pagination | `gold_batch_quality_result_v`, `spc_batch_dim_mv` |
| Attribute chart data (P, NP, C, U) | SQL | `spc_attribute_subgroup_mv` |
| Pre-computed control limits | SQL | `spc_quality_metrics` (METRIC_VIEW) |
| Locked limits read | SQL | `spc_locked_limits` |
| Locked limits write / delete | SQL DML | `spc_locked_limits` |
| Data quality summary | SQL | source unconfirmed |
| Exclusions | SQL + persisted state | `spc_exclusions` |
| Scorecard | SQL | `spc_quality_metrics` (METRIC_VIEW) |
| Process flow lineage | SQL | `spc_lineage_graph_mv`, `spc_process_flow_source_mv` |
| Correlation | SQL | `spc_correlation_source_mv` |
| Multivariate (Hotelling T²) | SQL + Python | `spc_correlation_source_mv` |
| MSA / Gauge R&R | SQL + Python (`utils/msa.py`) | operator/part measurement data |
| Export (Excel/CSV) | Python streaming | chart data endpoint results |
| Genie AI/BI | Databricks Genie API | scoped to material/plant/MIC context |
| Trace / traceability | SQL | separate router |

### 3.2 Control chart types

| Chart type | V1/standalone enum | V2 enum | Computation |
|---|---|---|---|
| Individuals & Moving Range | `imr` | `individuals` | Client-side (MR₂, 3σ) |
| X̄-R | `xbar_r` | `xbar-r` | Client-side (AIAG d₂, A₂, D₃, D₄) |
| X̄-S | `xbar_s` | `xbar-s` | Client-side (AIAG c₄, A₃) |
| EWMA | `ewma` | `ewma` | Client-side (λ-weighted) |
| CUSUM | `cusum` | `cusum` | Client-side (k, h thresholds) |
| P chart | `p_chart` | `p-chart` | Client-side + SQL (`spc_attribute_subgroup_mv`) |
| NP chart | `np_chart` | `np-chart` | Client-side + SQL (`spc_attribute_subgroup_mv`) |
| C chart | `c_chart` | `c-chart` | Client-side + SQL (`spc_attribute_subgroup_mv`) |
| U chart | `u_chart` | `u-chart` | Client-side + SQL (`spc_attribute_subgroup_mv`) |

**Chart type heuristic:** `spc_mic_chart_config` (0 rows in UAT) is the intended config table.
Because it is empty, chart type is selected by heuristic (subgroup size n=1 → imr; n>1 → xbar_r
as default). V2 must apply the same heuristic until `spc_mic_chart_config` is populated.

### 3.3 Statistical calculations (client-side TypeScript)

| Calculation | Standalone status | Notes |
|---|---|---|
| Subgroup mean (X̄), range (R), std dev (S) | Client-side | AIAG ASTM E2281 |
| Moving range (MR₂) | Client-side | |
| AIAG constants (d₂, d₃, c₄, A₂, A₃, D₃, D₄) | Client-side table | Constants only valid for subgroup sizes 2–25 |
| Control limits UCL/LCL/CL (all chart types) | Client-side | Includes pre-computed from `spc_quality_metrics` as optional override |
| Cp | Client-side | `(USL-LSL) / (6 * σ_within)` |
| Cpk | Client-side | `min((USL-X̄)/3σ, (X̄-LSL)/3σ)` |
| Pp | Client-side | `(USL-LSL) / (6 * σ_overall)` |
| Ppk | Client-side | `min((USL-X̄)/3σ_overall, (X̄-LSL)/3σ_overall)` |
| Non-parametric capability (P0.135/P99.865 empirical) | Client-side | Fallback when normality fails |
| 95% CI for Cp, Cpk, Pp, Ppk | Client-side | Chi-squared / t-distribution |
| DPMO + Z-score | Client-side | |
| Autocorrelation detection | Client-side | |
| Normality test (method + p-value) | Client-side | |
| WECO rules (WE1–WE4) | Client-side pure function | No stored flags |
| Nelson rules (N1–N8) | Client-side pure function | No stored flags |
| Spec drift detection (SpecDriftWarning) | Backend (within /chart-data response) | Detects `distinct_signatures > 1` |
| MSA Average & Range | Client-side + `/api/spc/msa/calculate` backend | Python `utils/msa.py` |
| MSA ANOVA | Client-side + `/api/spc/msa/calculate` backend | Python `utils/msa.py` |
| Pearson correlation | Backend SQL + Python | `spc_correlation_source_mv` |
| Hotelling T² | Backend SQL + Python | `spc_correlation_source_mv` |

### 3.4 Governance and workflow features

| Feature | Standalone status |
|---|---|
| Locked limits write (POST to `spc_locked_limits`) | Implemented; requires OAuth identity |
| Locked limits delete | Implemented |
| Locked limits staleness detection (`stale_spec`) | Live: compares `spec_signature` at lock-time vs. current |
| Locked limits approval state | NOT modelled — `locked_by` is an email, not an approval workflow; no approval/rejection state |
| Exclusion audit trail (before/after limits JSON) | Persisted in `spc_exclusions` |
| Exclusion management UI | Implemented |

---

## 4. Databricks `spc_*` Semantic Model Inventory

All verification dates: 2026-05-21, `connected_plant_uat.gold`, by tim.geldard@kerry.com.

| Databricks object | Verified? | Type | Rows | Purpose | Replaces / supports standalone feature | ConnectIO-RAD status | Notes |
|---|---|---|---|---|---|---|---|
| `spc_quality_metric_subgroup_mv` | Yes | MANAGED Delta | 73,452,925 | Measurement-level subgroup data | Chart data, spec limits, normality metadata, accept/reject flags | Slice 1 route wired (`GET /spc/subgroups`) | 73M rows; GROUP BY `(batch_id, batch_date)` required for one-row-per-subgroup. `sum_value/batch_n` → mean; `batch_range` → range. `lsl_spec/usl_spec` present; `0.0/0.0` is "not populated" sentinel |
| `spc_quality_metric_subgroup_v` | Yes | VIEW | large | Same schema as MV | Same as MV | Unwired — use MV for performance | MV preferred; this view exists for compatibility |
| `spc_quality_metrics` | Yes | METRIC_VIEW | n/a | Pre-computed `sigma_within`, `ooc_rate`, `mean_value`, `x_bar_ucl/lcl`, `stddev_overall` per MIC | Control limits (live), scorecard, ooc_rate | Unwired | Not row-queryable as a regular table; Genie / AI/BI access path. Does NOT contain Cp/Cpk/Pp/Ppk measures |
| `spc_locked_limits` | Yes | MANAGED Delta | 1 | Control limit locking with provenance | Locked limits read/write | Unwired (deferred slice 2) | 1 UAT fixture row; `baseline_from/to` empty in UAT; `locked_by` = email, not approval state; no `usl/lsl` columns |
| `spc_material_dim_mv` | Yes | MATERIALIZED_VIEW | 138,051 | Material dimension | Material navigation | Unwired — needs native route | Wired in standalone `GET /api/spc/materials` |
| `spc_plant_material_dim_mv` | Yes | MANAGED Delta | 87,336 | Plant dimension scoped to material | Plant navigation | Unwired — needs native route | Wired in standalone `GET /api/spc/plants` |
| `spc_characteristic_dim_mv` | Yes | MANAGED Delta | 3,017,410 | MIC dimension | MIC navigation | Unwired — needs native route | Wired in standalone `POST /api/spc/characteristics` |
| `spc_batch_dim_mv` | Yes | MANAGED Delta | 2,164,058 | Batch dimension | Batch navigation, pagination cursor support | Unwired | Standalone app uses this for cursor pagination |
| `spc_exclusions` | Yes | MANAGED Delta | 6 | Persisted exclusion audit trail | Exclusion workflow | Unwired | 20 columns; `excluded_points_json`, `before_limits_json`, `after_limits_json` |
| `spc_mic_chart_config` | Yes | MANAGED Delta | 0 | Chart type override per MIC | Chart type heuristic override | Unwired (empty; no effect) | Empty — heuristic must be used (n=1 → imr, n>1 → xbar_r) |
| `spc_attribute_subgroup_mv` | Yes (unexpected) | MANAGED Delta | uncounted | Attribute subgroup data (P/NP/C/U) | Attribute chart data | Unwired | Not in original V1 analysis; present in UAT |
| `spc_correlation_source_mv` | Yes (unexpected) | MANAGED Delta | uncounted | Pairwise correlation source | Correlation, multivariate | Unwired | Present and verified; standalone app uses it |
| `spc_lineage_graph_mv` | Yes (unexpected) | MANAGED Delta | uncounted | Process lineage graph | Process flow | Unwired | Present and verified; standalone app uses it |
| `spc_process_flow_source_mv` | Yes (unexpected) | MANAGED Delta | uncounted | Process flow node data | Process flow | Unwired | Present and verified; standalone app uses it |
| `spc_unified_mic_key_v` | Yes (unexpected) | VIEW | uncounted | Unified MIC key resolution | MIC routing | Unwired | |
| `spc_mic_routing_v` | Yes (unexpected) | VIEW | uncounted | MIC routing resolution | MIC routing | Unwired | |
| `spc_capability_detail_mv` | **NOT FOUND** | — | — | Cp/Cpk/Pp/Ppk per MIC | Capability indices | Not wired; source absent | Migration 013 not applied in UAT |
| `spc_nelson_rule_flags_mv` | **NOT FOUND** | — | — | Stored per-batch Nelson rule flags | Stored signal flags | Not wired; source absent | Migration 012 not applied in UAT |
| Any signal/alarm/violation table | **NOT FOUND** | — | — | Stored rule violations | Alarm history | Not wired; source absent | 0 matches across all patterns |

---

## 5. Feature-by-Feature Parity Matrix

| Feature | Standalone `spc` | Databricks semantic support | ConnectIO-RAD route | ConnectIO-RAD contract | ConnectIO-RAD UI | Classification | Recommended action |
|---|---|---|---|---|---|---|---|
| **Navigation** | | | | | | | |
| Material list | `GET /api/spc/materials` | `spc_material_dim_mv` verified | Legacy-api proxy only | None (uses raw list) | Mock + legacy-api | `needs-native-route` | Add `GET /spc/materials` native route (slice 2) |
| Plant list per material | `GET /api/spc/plants` | `spc_plant_material_dim_mv` verified | Legacy-api proxy only | None | Mock + legacy-api | `needs-native-route` | Add `GET /spc/plants` native route (slice 2) |
| MIC list per material+plant | `POST /api/spc/characteristics` | `spc_characteristic_dim_mv` verified | Legacy-api proxy only | `MonitoredSPCCharacteristicSchema` | Mock + legacy-api | `needs-native-route` | Add `GET /spc/characteristics` native route (slice 2) |
| Attribute MIC list | `POST /api/spc/attribute-characteristics` | `spc_attribute_subgroup_mv` present | Not wired | None | Not wired | `needs-Databricks-verification` | Verify attribute MV columns before wiring |
| **Chart data** | | | | | | | |
| Subgroup chart points | `POST /api/spc/chart-data` | `spc_quality_metric_subgroup_mv` verified | `GET /spc/subgroups` (slice 1) | `SPCSubgroupResponseSchema` | Not yet wired to frontend | `needs-frontend-wiring`, `needs-browser-UAT` | Wire `SPCMonitoringDatabricksApiAdapter` (slice 3) |
| Chart point aggregation (mean/range/sd) | Client-side (AIAG constants) | `sum_value/batch_n/batch_range/sum_squares` in MV | Aggregated in slice 1 SQL | `subgroupMean`, `subgroupRange` | Not wired | `needs-frontend-wiring` | Aggregate in SQL (done); client computes limits |
| Spec limits (USL/LSL) | From subgroup view | `lsl_spec/usl_spec` in `spc_quality_metric_subgroup_mv` | Returned by slice 1 | `lslSpec/uslSpec` nullable | Not wired | `needs-frontend-wiring` | Sentinel 0.0/0.0 → null already handled |
| Normality metadata | `normality` in chart-data response | `normality_type` column in MV (unconfirmed column mapping) | Not returned | Not in contract | Not wired | `needs-contract-change` | Add optional `normalityType` to `SPCSubgroupPoint` |
| Accept/reject flags | Implicit in data quality | `any_rejection/any_acceptance` in MV | Not returned | Not in contract | Not wired | `needs-contract-change` | Add optional `anyRejection/anyAcceptance` to point |
| Cursor pagination | Composite 5-part cursor | `spc_batch_dim_mv` supports ordering | Not implemented | No pagination contract | Not wired | `needs-contract-change` | Design pagination for slice 2+ |
| Stratification | `stratify_by` param | All three columns present in MV | Not implemented | Not in contract | Not wired | `needs-native-route` | Add `stratify_by` parameter in future slice |
| Spec drift detection | `SpecDriftWarning` in response | `spec_signature` in `spc_locked_limits` | Not implemented | Not in contract | Not wired | `needs-contract-change` | Deferred; depends on verified spec-signature semantics |
| **Control limits** | | | | | | | |
| Live control limits | Client-side computation | `spc_quality_metrics` METRIC_VIEW (`sigma_within`, `x_bar_ucl/lcl`) | Not exposed | `ControlChartSeries.upperControlLimit` | Not wired | `needs-native-route` | Evaluate: compute client-side vs. surface from METRIC_VIEW |
| Locked limits (read) | `GET /api/spc/locked-limits` | `spc_locked_limits` verified | Deferred slice 2 | `lockedLimits: z.null()` in slice 1 | Not wired | `needs-native-route` | Slice 2: add locked limits join to subgroups query |
| Locked limits (write/delete) | `POST/DELETE /api/spc/locked-limits` | `spc_locked_limits` writable | Not implemented | Not in contract | Not wired | `needs-governance` | Requires governance decision on approval semantics |
| Locked-by approval state | Not modelled | `locked_by` (email field only) | Not applicable | `ApprovalStateSchema` defined | Not wired | `needs-governance` | `locked_by` ≠ approved; approval workflow undefined |
| **Chart types** | | | | | | | |
| I-MR | Client-side | `batch_n=1` rows in MV | Client-side after slice 1 | `individuals` enum | Not wired | `needs-frontend-wiring` | Port `calculations.runtime.ts` I-MR logic |
| X̄-R | Client-side | `batch_n>1` rows in MV | Client-side after slice 1 | `xbar-r` enum | Not wired | `needs-frontend-wiring` | Port `calculations.runtime.ts` X̄-R logic |
| X̄-S | Client-side | `batch_n>1` rows in MV | Client-side after slice 1 | `xbar-s` enum | Not wired | `needs-frontend-wiring` | Port `calculations.runtime.ts` X̄-S logic |
| EWMA | Client-side | Not in MV | Client-side after slice 1 | `ewma` enum | Not wired | `needs-frontend-wiring` | Port EWMA from standalone app |
| CUSUM | Client-side | Not in MV | Client-side after slice 1 | `cusum` enum | Not wired | `needs-frontend-wiring` | Port CUSUM from standalone app |
| P chart | Client-side + SQL | `spc_attribute_subgroup_mv` present | Not wired | `p-chart` enum | Not wired | `needs-native-route` | Verify attribute MV; separate route from quantitative |
| NP chart | Client-side + SQL | `spc_attribute_subgroup_mv` present | Not wired | `np-chart` enum | Not wired | `needs-native-route` | Same as P chart |
| C chart | Client-side + SQL | `spc_attribute_subgroup_mv` present | Not wired | `c-chart` enum | Not wired | `needs-native-route` | Same as P chart |
| U chart | Client-side + SQL | `spc_attribute_subgroup_mv` present | Not wired | `u-chart` enum | Not wired | `needs-native-route` | Same as P chart |
| **Capability** | | | | | | | |
| Cp | Client-side | `spc_capability_detail_mv` NOT FOUND | Not wired | Required `z.number()` — truthfulness risk | Not wired | `source-unavailable` | Relax to `z.number().optional()` in contract; compute client-side only when USL/LSL present |
| Cpk | Client-side | `spc_capability_detail_mv` NOT FOUND | Not wired | Required `z.number()` — truthfulness risk | Not wired | `source-unavailable` | Same as Cp |
| Pp | Client-side | `spc_capability_detail_mv` NOT FOUND | Not wired | Required `z.number()` — truthfulness risk | Not wired | `source-unavailable` | Same as Cp |
| Ppk | Client-side | `spc_capability_detail_mv` NOT FOUND | Not wired | Required `z.number()` — truthfulness risk | Not wired | `source-unavailable` | Same as Cp |
| `ooc_rate` | From `spc_quality_metrics` METRIC_VIEW | Verified present in MV | Not wired | Not in contract | Not wired | `needs-native-route` | Add `oocRate` to scorecard contract; surface from METRIC_VIEW |
| **Signals / rules** | | | | | | | |
| WECO rules (WE1–WE4) | Client-side pure function | No stored flags in UAT | Client-side only | `SPCSignalSchema` (mock-only) | Mock only | `already-in-semantic-model` (none) | Port `detectWECORules` from standalone app; label as client-calculated |
| Nelson rules (N1–N8) | Client-side pure function | `spc_nelson_rule_flags_mv` NOT FOUND | Client-side only | `SPCSignalSchema` (mock-only) | Mock only | `source-unavailable` | Port `detectNelsonRules`; label as client-calculated; never claim "in control" |
| Stored signal flags | None in standalone app | `spc_nelson_rule_flags_mv` NOT FOUND | Not applicable | `nelsonStoredFlagsAvailable: false` (Literal) | Locked | `source-unavailable` | Deferred; requires migration 012 deployment in UAT |
| Scorecard (`ooc_rate`, Cpk/Ppk summary) | `POST /api/spc/scorecard` via `spc_quality_metrics` | `ooc_rate`, `sigma_within` in METRIC_VIEW; Cp/Cpk absent | Not wired | Not in contract | Not wired | `needs-native-route` | Scorecard route needs METRIC_VIEW access; Cp/Cpk must come from client-side calculation |
| Alarm history | None in standalone app | No alarm table in UAT | Not applicable | `SPCAlarmHistoryItemSchema` (mock only) | Mock only | `source-unavailable` | Acknowledge as permanently mock-only until source is built |
| **Advanced analytics** | | | | | | | |
| Histogram | Client-side rendering | `spc_quality_metric_subgroup_mv` provides data | No dedicated route | Not in contract | Not wired | `needs-frontend-wiring` | Histogram computed client-side from subgroup data |
| Process flow | `POST /api/spc/process-flow` | `spc_lineage_graph_mv`, `spc_process_flow_source_mv` present | Not wired | Not in contract | Not wired | `needs-native-route` | Source verified; both MVs present. Needs route + contract + UI |
| Correlation | `POST /api/spc/correlation` | `spc_correlation_source_mv` present | Not wired | Not in contract | Not wired | `needs-native-route` | Source verified; present. Needs route + contract + UI |
| Multivariate (Hotelling T²) | `POST /api/spc/multivariate` | `spc_correlation_source_mv` present | Not wired | Not in contract | Not wired | `needs-native-route` | Same source as correlation |
| MSA / Gauge R&R | `POST /api/spc/msa/calculate` | No dedicated MSA object in `spc_*` | Not wired | Not in contract | Not wired | `needs-Databricks-verification` | Standalone app computes from raw measurement data; source needs verification |
| **Workflow and data management** | | | | | | | |
| Exclusions | `POST /api/spc/exclusions` | `spc_exclusions` verified (6 rows) | Not wired | Not in contract | Not wired | `needs-governance` | Write-back requires governance; read-only display may be safe |
| Export (Excel/CSV) | Dedicated export router | N/A — reads from chart endpoint | Not wired | Not in contract | Not wired | `needs-native-route` | Depends on chart data route being stable |
| Genie AI/BI | Databricks Genie API router | `spc_quality_metrics` METRIC_VIEW | Not wired | Not in contract | Not wired | `needs-governance` | Genie scoping + data residency review required |
| Related batches | Not in standalone app | No source object | Not applicable | `SPCRelatedBatchSchema` (mock only) | Mock only | `blocked` | Contract exists; no source. Blocked pending trace domain integration |

---

## 6. Reclassify Apparent Gaps

### A. Apparent gaps that are already captured in Databricks

These features appear missing from ConnectIO-RAD but the **source data exists in verified
Databricks objects**. The gap is surfacing, not source.

1. **Material/plant/MIC navigation** — `spc_material_dim_mv`, `spc_plant_material_dim_mv`,
   `spc_characteristic_dim_mv` are all verified. ConnectIO-RAD has legacy-api proxy routes but no
   native routes. The standalone app queries these directly.

2. **Normality metadata** — `normality_type` is a column in `spc_quality_metric_subgroup_mv`.
   Not returned by slice 1 or any contract field. The standalone app surfaces this in
   `normality.is_normal` within the chart-data response.

3. **Accept/reject batch flags** — `any_rejection` and `any_acceptance` are present columns in
   `spc_quality_metric_subgroup_mv`. Not surfaced in any V2 contract.

4. **Process flow** — `spc_lineage_graph_mv` and `spc_process_flow_source_mv` are confirmed
   present in UAT. ConnectIO-RAD has no process flow route, contract, or UI. The source exists.

5. **Correlation and multivariate** — `spc_correlation_source_mv` is confirmed present. The
   standalone app's correlation and Hotelling T² features depend on it. ConnectIO-RAD has no
   route or contract for either.

6. **Pre-computed control limits** — `spc_quality_metrics` METRIC_VIEW has `sigma_within`,
   `x_bar_ucl`, `x_bar_lcl`, `ooc_rate`, `mean_value`. These are not row-queryable as a table but
   are accessible via the Genie/AI/BI surface or as an aggregate endpoint. ConnectIO-RAD does not
   surface any of these.

7. **Attribute chart data** — `spc_attribute_subgroup_mv` is confirmed present and the standalone
   app uses it for P, NP, C, U charts. V2 has enum values for these chart types but no adapter
   wired to the source.

8. **Exclusions (read)** — `spc_exclusions` has 6 rows. ConnectIO-RAD has no route or contract
   for reading exclusions. Read-only display requires only a SELECT grant.

### B. Gaps caused by ConnectIO-RAD not yet surfacing the semantic model

These are **route, adapter, or contract gaps** — the data is available but not exposed.

1. **Native navigation routes** — No `GET /spc/materials`, `GET /spc/plants`,
   `GET /spc/characteristics` in databricks-api mode. The V1 proxy routes exist in legacy-api
   mode but are unverified against live V1 UAT.

2. **`SPCSubgroupResponse` not wired to frontend** — Slice 1 returns data but
   `SPCMonitoringDatabricksApiAdapter.getControlChartSeries` is not implemented. The adapter
   returns `not-implemented`. `unitOfMeasure` (required `z.string()`) and
   `ControlChartPoint.status` are blockers for wiring to the existing `ControlChartSeries`
   contract.

3. **Chart calculations not ported** — I-MR, X̄-R, X̄-S, EWMA, CUSUM calculation logic from
   `calculations.runtime.ts` in the standalone app is not present in V2. Once the subgroup data
   route is wired, all seven chart types can be computed client-side without any new Databricks
   object.

4. **WECO/Nelson rule detection not ported** — `detectWECORules` and `detectNelsonRules` are
   pure functions in the standalone app. They can be ported directly to V2 without any new
   source. The V2 contract field `signalsClientSideOnly: true` (literal) anticipates this path.

5. **`spc_quality_metrics` METRIC_VIEW not surfaced** — `ooc_rate` and `sigma_within` are
   available but not exposed. These are needed for scorecard display and can substitute for
   capability where the Cp/Cpk MV is absent.

### C. True missing or blocked features

These require either a new Databricks source, a governance decision, or a confirmed deployment
before they can be implemented.

1. **Cp/Cpk/Pp/Ppk from Databricks** — `spc_capability_detail_mv` is confirmed absent in UAT
   (migration 013 not applied). These indices cannot be sourced from Databricks. They can be
   computed client-side from subgroup statistics (the standalone app does this) when USL/LSL are
   present, but:
   - The V2 `CharacteristicCapabilitySchema` has all four indices as required `z.number()` —
     a truthfulness violation if a native route returns nulls or omits them.
   - Contract change required: all four should be `z.number().optional()`.

2. **Stored Nelson rule flags** — `spc_nelson_rule_flags_mv` confirmed absent (migration 012 not
   applied). `nelsonStoredFlagsAvailable: false` (Literal) in the V2 contract correctly locks
   this. No action until the MV is deployed in UAT.

3. **Locked-limit governed approval** — `locked_by` in `spc_locked_limits` is an email address,
   not an approval state transition. The V2 `ApprovalStateSchema` enum (approved / not-approved /
   pending-validation / unavailable) implies a workflow that does not exist in the standalone app
   or in Databricks. Approval semantics must be defined by the governance owner before any
   approval claim can be made.

4. **Locked-limit write/mutation** — ConnectIO-RAD's identity policy permits user-OAuth reads
   but locked-limit writes require a deliberate governance decision. The standalone app supports
   POST/DELETE on `spc_locked_limits`. V2 has not implemented write-back and should not until
   governance explicitly authorises it.

5. **Alarm history** — No alarm, signal, or violation storage table exists anywhere in `spc_*`.
   `SPCAlarmHistoryItemSchema` and `SPCRelatedBatchSchema` remain permanently mock-only until a
   source is built. The standalone app also has no alarm history.

6. **MSA / Gauge R&R source verification** — The standalone app computes MSA from raw measurement
   data. The source object in `spc_*` that backs this is not confirmed in the V2 docs. Needs
   object-level verification before wiring.

---

## 7. Recommended Migration Sequence

### Phase 1 — Surface verified navigation + basic chart (slices 2–3)

**Prerequisites already met** for native subgroup data (slice 1 done).

- `GET /spc/materials` native route — sources `spc_material_dim_mv` (verified, 138k rows)
- `GET /spc/plants` native route — sources `spc_plant_material_dim_mv` (verified, 87k rows)
- `GET /spc/characteristics` native route — sources `spc_characteristic_dim_mv` (verified, 3M rows)
- Wire `SPCMonitoringDatabricksApiAdapter.getControlChartSeries` to slice 1 data
  - Resolve `unitOfMeasure` blocker: change contract field to `z.string().optional()`
  - Resolve `ControlChartPoint.status` blocker: status is client-calculated, not source-provided
- Basic I-MR and X̄-R chart panel using native subgroup data
- Show `lslSpec` / `uslSpec` spec limit lines
- Show source badge: `databricks-api` (amber until browser-UAT, green after)
- **Do not claim UAT readiness until end-to-end browser test is completed**

### Phase 2 — Port client-side calculations (no new Databricks sources needed)

All of the following require only the subgroup data already returned by slice 1:

- I-MR, X̄-R, X̄-S, EWMA, CUSUM calculations from `calculations.runtime.ts`
- WECO rules (WE1–WE4) from `detectWECORules`
- Nelson rules (N1–N8) from `detectNelsonRules`
- Label all signals as `signalsClientSideOnly: true` — never claim "in control" from signal
  absence
- Histogram rendering from subgroup point distribution
- Client-side Cp/Cpk/Pp/Ppk calculation when `lslSpec` and `uslSpec` are non-null
  - Update `CharacteristicCapabilitySchema` to `z.number().optional()` first
  - Label as `source: client-side-calculated`; do not claim Databricks-sourced
  - Non-parametric path (P0.135/P99.865 empirical) recommended for non-normal distributions
  - Capability threshold: align standalone 4-tier (excellent ≥1.67 / capable ≥1.33 / marginal /
    poor) vs. V2 3-tier; decision required

### Phase 3 — Locked limits read-only (slice 4 from prerequisite plan)

- Complete `spc_locked_limits` DESCRIBE TABLE verification (column confirmation pending)
- Add locked limits join to subgroups query or separate `GET /spc/locked-limits` route
- Display locked limits lines read-only alongside live limits
- Surface `lockedBy` (email) but NOT as an `ApprovalState` claim
- Staleness detection (`stale_spec`): compare `spec_signature` at lock-time vs. current spec
  limits from subgroup view
- **Do not mutate `spc_locked_limits`** until governance authorises write-back

### Phase 4 — Navigation and scorecard surface

- Native navigation routes for materials / plants / MICs
- Scorecard from `spc_quality_metrics` METRIC_VIEW (`ooc_rate`, `sigma_within`)
- Add `oocRate` field to `MonitoredSPCCharacteristicSchema`
- Attribute chart data from `spc_attribute_subgroup_mv` (verify columns first)

### Phase 5 — Capability (only if source or governed calculation exists)

- If `spc_capability_detail_mv` is deployed in UAT: source Cp/Cpk/Pp/Ppk from it
- If not: client-side calculation (Phase 2) is the only path
- Confirm distribution/normality handling, spec consistency, and unit consistency caveats
- Kerry QM process owner authorisation required before exposing capability as a governed metric

### Phase 6 — Advanced analytics (process flow, correlation, MSA)

- Process flow: `spc_lineage_graph_mv` + `spc_process_flow_source_mv` — sources verified
- Correlation / multivariate: `spc_correlation_source_mv` — source verified
- MSA: source verification required before wiring
- All require dedicated contracts, routes, and UI panels

### Phase 7 — Governance-gated features

- Locked limits write-back (POST/DELETE) — requires governance decision
- Alarm acknowledgement lifecycle — requires alarm source to be built
- Exclusion management — requires governance decision on audit-trail requirements
- Genie AI/BI scoped interface — requires data residency and scoping review

---

## 8. Architecture Recommendation

ConnectIO-RAD should **not** replicate the standalone SPC app. The standalone app was built as a
rapid proof of concept and its architecture reflects that (string SQL in some places, no
pagination in the outer API, no contract versioning). ConnectIO-RAD's contract-first approach is
architecturally superior.

Recommended principles:

1. **Preserve contract-first design.** Zod schemas in `@connectio/data-contracts` are the source
   of truth. No route should return fields that are not in the schema; no field should be required
   if the source is unverified.

2. **Use Databricks `spc_*` semantic objects where verified.** Do not re-implement in application
   code what Databricks already computes and stores (subgroup aggregation, locked limit storage,
   dimension tables). Port calculation logic only when it is not represented in Databricks.

3. **Keep calculations pure and tested.** Port `calculations.runtime.ts` as a pure TypeScript
   module with unit tests. Do not mix calculation logic into UI components or route handlers.

4. **Label source clearly.** Client-calculated vs. Databricks-sourced capability and signals must
   be distinguished at the contract level. `signalsClientSideOnly`, `capabilityAvailable`, and
   `limitProvenance` are the right mechanism — do not collapse them.

5. **Avoid mock fallback for user-facing data.** The `mock` adapter mode is valuable for
   development and testing; it must not be the production path. Prefer 503 over mock data.

6. **Keep source badges visible.** `legacy-api`, `databricks-api`, and `mock` modes should be
   visible in the UI developer tools and in response headers. Browser UAT evidence is a required
   gate, not an optional nice-to-have.

7. **Rate limiting.** The standalone app applies per-user SlowAPI rate limiting. The 73M-row MV
   and the broad-scan risk mean ConnectIO-RAD should apply server-side guardrails (MAX_SUBGROUPS
   clamping, 730-day date window, blank-filter rejection — already implemented in slice 1).

8. **No write-back without governance.** `spc_locked_limits` write, `spc_exclusions` write, and
   any GxP workflow require explicit governance owner authorisation. Do not implement speculatively.

---

## 9. Risks and Guardrails

| Risk | Description | Current mitigation | Required action |
|---|---|---|---|
| **73M-row MV broad scan** | Querying `spc_quality_metric_subgroup_mv` without all five required filters (material/plant/MIC/operation/date) causes a full scan | Slice 1: all filters required; blank strings → 422; 730-day window guard; MAX_SUBGROUPS clamp | Apply same guards to all future routes querying this MV |
| **Plant namespace ambiguity** | P-prefix (SPC-internal) and C-prefix (SAP) plant IDs coexist; cross-namespace mapping unconfirmed | `classifyPlantNamespace` helper; IDs passed verbatim | Do not map P-prefix ↔ C-prefix without verified mapping table |
| **`operation_id` ≠ SAP work centre** | `operation_id` is a sequential inspection-op identifier (00000001–00000009+); not an SAP work centre code | `operationId` field in contract; `workCentreId` mapping is legacy-bridge-only only | Never expose `operation_id` as `workCentreId` in a native route |
| **Spec limits ≠ control limits** | `lsl_spec/usl_spec` are specification boundaries; UCL/LCL are statistical control limits. They must not be conflated | Separate fields in `ControlChartSeries` | Ensure chart UI renders spec and control limit lines distinctly |
| **0.0/0.0 spec limit sentinel** | `lsl_spec=0.0 AND usl_spec=0.0` together means "not populated" in UAT; must not be treated as a real lower bound of zero | Slice 1 mapper: both-zero pair → null; `deriveSpecificationLimits` helper | Apply sentinel check to all future routes reading spec limits from this MV |
| **`locked_by` ≠ approved** | `locked_by` field is an email address; it does not imply a QM approval state | `mapLockedLimitRow` emits `uat-fixture-only`; never claims governed approval | Do not surface `locked_by` as `approvalState: approved` without governance |
| **No Cp/Cpk unless verified** | `spc_capability_detail_mv` absent in UAT; `CharacteristicCapabilitySchema` requires all four indices as non-optional | `capabilityAvailable: false` (Literal) in slice 1 | Change contract to optional before wiring any capability route; compute client-side when USL/LSL present |
| **No stored Nelson flags unless source exists** | `spc_nelson_rule_flags_mv` absent in UAT | `nelsonStoredFlagsAvailable: false` (Literal) in slice 1 | Do not claim stored flags until migration 012 is confirmed deployed |
| **No "in control" from signal absence** | Absence of client-calculated signals does not mean "process is in control" | `signalsClientSideOnly: true` (Literal) in slice 1; `ControlChartPoint.status` not returned by slice 1 | Chart UI must not render "in control" badge based on zero detected signals |
| **No production readiness without browser UAT** | End-to-end browser test has not been run against UAT Databricks with the V2 frontend | All docs state "browser UAT pending"; production readiness explicitly blocked | Gate production claim on UAT evidence capture in `spc-uat-acceptance-script.md` |

---

## 10. Deliverables

### This document

- `domain-integrations/spc/docs/spc-semantic-model-functional-parity.md` — this file

### Recommended follow-on updates (not in this PR)

- `domain-integrations/spc/README.md` — add link to this audit
- `domain-integrations/spc/docs/spc-native-migration-readiness-checklist.md` — add link to this
  audit; update §11 to note that `CharacteristicCapabilitySchema` fields should be relaxed to
  optional before any capability route is wired
- `packages/data-contracts/src/schemas/spc-monitoring.ts` — future PR: relax `cp/cpk/pp/ppk` to
  `z.number().optional()` in `CharacteristicCapabilitySchema`; relax `unitOfMeasure` to
  `z.string().optional()` in `ControlChartSeriesSchema`; relax `timestamp` in
  `ControlChartPointSchema` from `.datetime()` to `z.string()`

### No-change items in this PR

- No runtime code changes
- No generated contract changes
- No route changes
- No migration from mock to databricks-api for any existing panel

---

## Appendix: Top 5 Semantic-Model Surfacing Gaps

These are apparent parity gaps that are **already captured in Databricks** but not exposed
in ConnectIO-RAD:

1. **Material/plant/MIC navigation** — all three dimension MVs verified, 87k–3M rows, no native
   route wired
2. **Process flow lineage** — `spc_lineage_graph_mv` + `spc_process_flow_source_mv` both present;
   no route, contract, or UI
3. **Correlation analysis** — `spc_correlation_source_mv` present; no route, contract, or UI
4. **Normality metadata and accept/reject flags** — `normality_type`, `any_rejection`,
   `any_acceptance` are columns in the already-wired `spc_quality_metric_subgroup_mv`; not
   returned by slice 1
5. **Pre-computed `ooc_rate` / `sigma_within`** — available in `spc_quality_metrics` METRIC_VIEW;
   needed for scorecard; not surfaced in any contract

## Appendix: Top 5 True Missing or Governance-Blocked Gaps

These cannot be implemented without a new source, a deployment, or a governance decision:

1. **Cp/Cpk/Pp/Ppk from Databricks** — `spc_capability_detail_mv` absent (migration 013
   undeployed); client-side calculation is the only available path; contract must relax to
   optional
2. **Stored Nelson rule flags** — `spc_nelson_rule_flags_mv` absent (migration 012 undeployed)
3. **Locked-limit governed approval workflow** — `locked_by` is an email, not an approval state;
   approval semantics undefined; `ApprovalState` contract enum premature
4. **Locked-limit write-back** — requires governance authorisation for GxP-adjacent data
   mutation; not safe to implement speculatively
5. **Alarm history** — no alarm, signal, or violation storage table exists anywhere in `spc_*`;
   `SPCAlarmHistoryItemSchema` has no source and should be documented as deferred-until-source
