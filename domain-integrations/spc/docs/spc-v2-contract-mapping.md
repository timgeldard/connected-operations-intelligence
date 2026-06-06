# SPC V2 Contract Mapping — Verified Databricks Alignment

**Date:** 2026-05-21 (rewritten against PR #65 verified schema)
**Predecessor:** Original template (2026-05-21 first draft) — replaced in this file
**Verified evidence:** [`spc-databricks-verification-results-summary.md`](./spc-databricks-verification-results-summary.md), `spc-databricks-source-verification.md`, `spc-control-limit-provenance-verification.md`, `spc-rule-signal-source-verification.md`, `spc-capability-verification.md`, `spc-data-model-grain-assessment.md`, `spc-navigation-model-verification.md` (all merged via PR #65)
**Audit:** [`spc-native-contract-alignment-audit.md`](./spc-native-contract-alignment-audit.md)
**Status:** Field-by-field mapping against verified Databricks schema. **No live wiring; no native route exists in V2 today.**
**Source of truth for V2 contracts:** `packages/data-contracts/src/schemas/spc-monitoring.ts`
**Source of truth for legacy bridge:** `domain-integrations/spc/src/adapters/spc-monitoring-legacy-api-adapter.ts` + V1 SPC FastAPI backend (`apps/spc/` in ConnectIO-RAD V1)

---

## 0. How to read this document

Every V2 field is classified against **one or more** of:

| Classification | Meaning |
|---|---|
| `directly-sourced` | A single verified Databricks column populates the V2 field with no transformation other than rename/case. |
| `derived` | The V2 field is computed from one or more verified Databricks columns (e.g. `sum_value / batch_n`, grouping rows). |
| `source-unavailable` | The expected Databricks source does **not** exist in `connected_plant_uat.gold` today. The native route cannot populate this field without (a) MV redeployment, (b) backend calculation, or (c) a different source. |
| `blocked` | The V2 field carries decision-authority semantics that this phase does not own (release authority, governed approval). Out of scope for native route. |
| `legacy-bridge-only` | The field is populated by the V1 FastAPI legacy bridge from V1's own response format. The V1 wire shape does not match the verified Databricks columns. Acceptable while the legacy bridge is the active path; **must not** be carried into the native route under the V1 names. |
| `unknown` | A semantic question that requires Kerry governance (e.g. P/C plant namespace) before the field can be populated truthfully. |
| `requires-contract-change` | The current Zod contract cannot represent the verified source honestly (forces invented values, hardcoded defaults, or false claims). Listed for Slice 6 (optional). |
| `requires-future-native-mapper` | The field will be populated by the future pure mapper helper (Slice 4) — not by any code that exists today. |

A field can carry multiple classifications. Each row also lists:

- **Verified source** — the column/object that has been confirmed by live `DESCRIBE TABLE` evidence in PR #65, or the explicit `NOT FOUND` finding.
- **Transform / derivation** — how the column reaches the V2 field.
- **Legacy bridge behaviour** — what the V1 FastAPI surface returns for this field today (if anything).
- **Native gap or note** — what is missing, ambiguous, or must be governed before a native route can populate the field.

Throughout, **"native route"** refers to a future V2 FastAPI route that reads `spc_quality_metric_subgroup_mv` and `spc_locked_limits` directly with the authenticated end-user's Databricks OAuth identity. **No such route exists in V2 today.** This document describes what that route *would* do; it does not authorise wiring it.

> **Legacy bridge boundary.** V1 SPC's FastAPI backend transforms verified
> Databricks columns into V1 response field names (`result_value`,
> `sample_id`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`,
> `subgroup_sd`, `unit_of_measure`, `process_mean`, `process_std_dev`,
> capability indices). The V2 legacy bridge consumes those V1 names and
> maps them into V2 contracts. The verified Databricks columns shown below
> are what the **native** route would read — they are NOT the names V2 reads
> from V1 today. Both surfaces must coexist until the native route is
> approved and wired.

---

## 1. Verified Databricks sources (used throughout)

| Object | Type | Used for |
|---|---|---|
| `connected_plant_uat.gold.spc_quality_metric_subgroup_mv` | Managed Delta (~73M rows, measurement-level) | Chart points, spec limits, normality, accept/reject flags |
| `connected_plant_uat.gold.spc_quality_metric_subgroup_v` | View | Underlying SQL of the MV — **prefer MV for performance** |
| `connected_plant_uat.gold.spc_locked_limits` | Managed Delta (1 UAT row only) | Control limits, lock provenance |
| `connected_plant_uat.gold.spc_material_dim_mv` | Materialised view | Material dimension (material_id, material name) |
| `connected_plant_uat.gold.spc_plant_material_dim_mv` | Managed Delta | Plant-per-material navigation |
| `connected_plant_uat.gold.spc_characteristic_dim_mv` | Managed Delta | Characteristic dimension (mic_id, mic name, batch counts) |
| `connected_plant_uat.gold.spc_batch_dim_mv` | Managed Delta | Batch dimension (cross-domain join candidate; not yet wired) |
| `connected_plant_uat.gold.spc_mic_chart_config` | Managed Delta (0 rows) | Chart-type override (currently empty) |
| `connected_plant_uat.gold.spc_capability_detail_mv` | **NOT FOUND** | Capability — would have provided Cp/Cpk/Pp/Ppk |
| `connected_plant_uat.gold.spc_nelson_rule_flags_mv` | **NOT FOUND** | Signal flags — would have stored Nelson rule flags |
| `connected_plant_uat.gold.spc_quality_metrics` | METRIC_VIEW | Aggregate dashboard view — not row-queryable as a table |

Exclusion rules applied wherever an `spc_quality_metric_subgroup_mv` read is needed:

- `plant_id <> 'P999'` (sentinel/aggregate plant; not real production data)
- `material_id IS NOT NULL AND TRIM(material_id) <> ''` (blank-material rows must not be surfaced)

---

## 2. ChartType enum (V1 → V2 rename)

| V2 `ChartTypeSchema` | V1 `chart_type` (wire + Databricks `spc_locked_limits.chart_type`) | Classification | Notes |
|---|---|---|---|
| `xbar-r` | `xbar_r` | directly-sourced | Underscore → hyphen rename only |
| `xbar-s` | `xbar_s` | directly-sourced | Underscore → hyphen rename only |
| `individuals` | `imr` | directly-sourced | Lexical rename `imr` → `individuals` |
| `p-chart` | `p_chart` | directly-sourced | |
| `np-chart` | `np_chart` | directly-sourced | |
| `c-chart` | `c_chart` | directly-sourced | |
| `u-chart` | `u_chart` | directly-sourced | |
| `ewma` | `ewma` | directly-sourced | Same |
| `cusum` | `cusum` | directly-sourced | Same |

The verified `spc_locked_limits.chart_type` for the single UAT row is `imr` → maps to V2 `individuals`. The chart-type override view `spc_mic_chart_config` has **0 rows**, so heuristic chart-type selection (from data shape / `batch_n`) is the operational default; the native mapper must record `chartTypeSource: 'heuristic'` unless the config view becomes populated.

---

## 3. `LimitProvenance` enum

| V2 value | When to use under native route | Classification |
|---|---|---|
| `mock-fixture` | Mock adapter only. | directly-sourced (from mock) |
| `calculated-from-sample` | Live mode without a matching `spc_locked_limits` row: UCL/LCL computed from subgroup statistics + AIAG factors (today: frontend `calculations.runtime.ts`; future: backend or remain frontend). | derived |
| `imported-from-approved-source` | **Reserve for governed-approval rows only.** Today, no source row qualifies — the single UAT row is `locked_by`-only, not governance-approved. Do not emit this value from native code in this phase. | blocked |
| `unknown` | Ambiguous / cannot determine. | unknown |

Gap surfaced by audit item 2.6: the current enum has no value for "locked row present but UAT fixture / not governed approval". Slice 4 helpers therefore return a richer internal status (`locked-limit-present`, `uat-fixture-only`, `approval-not-governed`) which the future native route may either map back to one of the existing enum values + a separate warning field, or use a Slice 6 enum extension.

---

## 4. `ApprovalState` enum

| V2 value | When to use under native route | Classification |
|---|---|---|
| `approved` | Reserved for a governed approval workflow. **Today, no source row qualifies.** `spc_locked_limits.locked_by` alone is **not** a governed approval. | blocked |
| `not-approved` | Limits are live-computed from subgroup statistics (no `spc_locked_limits` row matched the key). | derived |
| `pending-validation` | Locked-limit row present but identifier in `locked_by` is a UAT/test identity, or `baseline_from`/`baseline_to` are empty. Today, this matches the single UAT row. | derived |
| `unavailable` | Cannot evaluate (e.g. table absent, OAuth blocked). | source-unavailable |

Gap: the enum does not distinguish "locked-by-real-user-no-governance-workflow" from "pending-validation". Documented for Slice 6 as a candidate extension.

---

## 5. `SPCMonitoringContext` (entry-point shape)

| V2 field | Verified source | Transform / derivation | Legacy bridge behaviour | Classification |
|---|---|---|---|---|
| `materialId` | `spc_material_dim_mv.material_id`, also present in `spc_quality_metric_subgroup_mv.material_id` | Direct. Required entry-point parameter for the native route. | Forwarded as-is to V1 (`material_id`) | directly-sourced |
| `materialName` | `spc_material_dim_mv.material_name`, also `spc_quality_metric_subgroup_mv.material_name` | Direct (renamed). The Zod field is `materialDescription` — currently required. | V1 returns under varying names; legacy adapter passes through. | directly-sourced, requires-contract-change (rename `materialDescription` → `materialName` is a candidate for Slice 6 to match Databricks; otherwise the mapper transforms in place) |
| `plantId` | `spc_quality_metric_subgroup_mv.plant_id`, `spc_plant_material_dim_mv.plant_id`, `spc_locked_limits.plant_id` | Direct. **Preserve namespace verbatim** (`P`-prefix or `C`-prefix). Exclude `P999`. | Forwarded as-is. | directly-sourced + unknown (namespace mapping) |
| `plantName` | `spc_quality_metric_subgroup_mv.plant_name` | Direct. | Forwarded as-is. | directly-sourced |
| `characteristicId` / `micId` | `spc_characteristic_dim_mv.mic_id`, `spc_quality_metric_subgroup_mv.mic_id` | Direct. The two V2 fields are aliases. | Forwarded as-is. | directly-sourced |
| (mic name) | `spc_characteristic_dim_mv.mic_name`, `spc_quality_metric_subgroup_mv.mic_name` | Direct. No dedicated field on `SPCMonitoringContext` today; surfaces via `MonitoredSPCCharacteristic.characteristicName`. | Passed via V1 `mic_name`. | directly-sourced |
| `operationId` | `spc_quality_metric_subgroup_mv.operation_id`, `spc_locked_limits.operation_id` | Direct. Sequential inspection-operation identifier (`00000001`, `00000003`, …). **Optional native parameter.** | Forwarded as-is. | directly-sourced + requires-contract-change (no `operationId` field exists on `SPCMonitoringContextSchema` today; Slice 6 candidate) |
| `workCentreId` | **NOT in any verified SPC source.** | n/a — must not alias to `operation_id`. | V1 backend does not return work-centre. Legacy adapter sets `body.operation_id = request.workCentreId` for compatibility; this is **legacy-bridge-only** behaviour and must not be carried into native code. | source-unavailable + legacy-bridge-only + unknown (governance) |
| `chartType` | `spc_locked_limits.chart_type` if a lock row matches; else `spc_mic_chart_config.chart_type` (empty today); else heuristic. | Rename V1 → V2 per §2. | V1 returns `chart_type`. | directly-sourced + derived |
| `batchId` | `spc_quality_metric_subgroup_mv.batch_id` (when scoped by batch). | Direct. Optional. | Optional in V1 too. | directly-sourced |
| `activeSignals` | **NOT stored.** Calculated by `calculations.runtime.ts` from currently-loaded chart data. | Derived from rule-detection output. | V1 backend does not compute on the wire; frontend calculation is the de-facto source. | source-unavailable (no stored count) + derived |
| `highestSeverity` | **NOT stored.** | Derived from rule-detection output severity ordering (`critical > high > medium > low`). | As above. | derived |
| `lastUpdatedAt` | `MAX(batch_date)` (or `MAX(last_posting_date)`) over the filtered row set. | Aggregation; ISO datetime string. | V1 returns its own freshness marker. | derived |
| `dateFrom` / `dateTo` (optional native request params) | `spc_quality_metric_subgroup_mv.batch_date` | Filter expressions on the native query. | V1 accepts equivalent query params. | directly-sourced (as filter inputs) |
| `activeScope` / `activeView` | Generated client-side (UI scope state). | n/a | n/a | derived |

**Plant namespace status.** A native mapper must preserve `plant_id` verbatim and attach a non-blocking warning when emitting rows whose namespace differs from the user's selected plant filter (e.g. selected `C037` but rows from `P523` exist for the same physical site). Until Kerry governance confirms a mapping, the field is `unknown` for cross-plant joins.

---

## 6. `MonitoredSPCCharacteristic`

| V2 field | Verified source | Transform / derivation | Legacy bridge behaviour | Classification |
|---|---|---|---|---|
| `characteristicId` | `spc_characteristic_dim_mv.mic_id` | Direct. | V1 `mic_id`. | directly-sourced |
| `characteristicName` | `spc_characteristic_dim_mv.mic_name` | Direct. | V1 `mic_name`. | directly-sourced |
| `micId` | `spc_characteristic_dim_mv.mic_id` (alias) | Direct. | Same as above. | directly-sourced |
| `chartType` | `spc_mic_chart_config.chart_type` (empty today) → heuristic fallback. | Rename per §2. | V1 returns `chart_type`. | derived (heuristic until config populated) |
| `chartTypeSource` | n/a | `'override'` if `spc_mic_chart_config` row exists; `'heuristic'` otherwise. | V1 has no equivalent; legacy adapter hard-codes `'heuristic'`. | derived |
| `batchCount` | `spc_characteristic_dim_mv` — column not verified by DESCRIBE in PR #65 (suspected `batch_count`); alternative: aggregate from `spc_quality_metric_subgroup_mv` (`COUNT(DISTINCT batch_id)`). | Direct **if** the column exists; otherwise derived. | V1 returns `batch_count` already. | directly-sourced (preferred, pending one DESCRIBE call) **or** derived |
| `avgSamplesPerBatch` | `spc_quality_metric_subgroup_mv` — derive `SUM(batch_n) / COUNT(DISTINCT batch_id)`. | Derived. | V1 returns `sample_count / batch_count`. | derived |
| `hasActiveSignal` | **NOT stored** (no `spc_nelson_rule_flags_mv`). | Derived from rule-detection output if a chart has been loaded; otherwise should be reported as `unavailable` rather than `false`. | V1 returns `has_active_signal` (computed by V1 backend); legacy bridge passes it through. | source-unavailable + derived + legacy-bridge-only + requires-contract-change (today `hasActiveSignal: z.boolean()` is required; making it optional or introducing `signalSourceStatus` is a Slice 6 candidate) |
| `highestSignalSeverity` | n/a | Derived from rule-detection. | V1 has no direct equivalent. | derived |
| `operationId` | `spc_quality_metric_subgroup_mv.operation_id` | Direct. | V1 `operation_id`. | directly-sourced |

---

## 7. Chart-point derivation grain — the core mapping decision

The verified subgroup MV/view is **measurement-level**. Each row represents one quality measurement within a batch; `batch_n` is the sample count *per batch* but no clean per-measurement primary key exists.

The V2 control-chart UI plots **one point per batch (subgroup)**, not one point per measurement. The native query must therefore aggregate.

### 7.1 Native grouping key

```
(material_id, plant_id, mic_id, operation_id, batch_id)
```

These columns are present and required by the route. Exclusions apply (`P999`, blank material) before grouping.

### 7.2 Derivations from grouped rows

| V2 field | Derivation | Verified columns used | Classification |
|---|---|---|---|
| `subgroupMean` | `MAX(sum_value) / MAX(batch_n)` (constants within the batch) — equivalently `sum_value / batch_n` from any row of the batch. | `sum_value`, `batch_n` | derived |
| `subgroupRange` | `MAX(batch_range)` (constant within the batch). | `batch_range` | directly-sourced |
| `subgroupStdDev` (within-batch σ̂) | Derived from `sum_squares`, `sum_value`, `batch_n` using the standard sample-variance formula. Native helper should expose only when `batch_n >= 2`. | `sum_squares`, `sum_value`, `batch_n` | derived |
| `sampleCount` | `batch_n` (constant within the batch). | `batch_n` | directly-sourced |
| `minValue` | `MIN(value)` over the batch (`min_value` is also present per row). | `value`, `min_value` | directly-sourced |
| `maxValue` | `MAX(value)` over the batch (`max_value` is also present per row). | `value`, `max_value` | directly-sourced |
| `individualValues` (optional) | `ARRAY_AGG(value)` over the batch, ordered by source row identity. | `value` | derived |
| `sourceRowCount` | `COUNT(*)` over the batch (should equal `batch_n` when no duplicates). | n/a | derived |
| `batchDate` (chart time axis) | `MAX(batch_date)` (constant per batch). Preferred over `first_posting_date`/`last_posting_date` unless verified evidence later contradicts. | `batch_date` | directly-sourced |
| `firstPostingDate` / `lastPostingDate` | `MAX(first_posting_date)` / `MAX(last_posting_date)`. Available for diagnostic surfaces; not the primary axis. | `first_posting_date`, `last_posting_date` | directly-sourced |
| `anyRejection` | `MAX(any_rejection)` (per-batch boolean). | `any_rejection` | directly-sourced |
| `anyAcceptance` | `MAX(any_acceptance)` (per-batch boolean). | `any_acceptance` | directly-sourced |
| `normalityType` / `normalityMethod` / `normalitySignature` | `MAX(normality_*)` (governance metadata; constant per material/MIC). | `normality_type`, `normality_method`, `normality_signature` | directly-sourced |
| `unifiedMicKey` | `MAX(unified_mic_key)` (cross-MIC reconciliation key; constant per `(material_id, mic_id)`). | `unified_mic_key` | directly-sourced |
| `warnings[]` | Derived: `batch_n < 2` → "subgroup stddev unavailable"; `sourceRowCount != batch_n` → "duplicate measurement rows in source"; namespace mismatch warnings. | n/a | derived |

Slice 4 helper `deriveSubgroupPoint(rowsForBatch)` performs the row-level reduction; the future native SQL performs the same reduction in-warehouse for performance.

### 7.3 `ControlChartPoint` Zod fit

| V2 field on `ControlChartPointSchema` | Maps to | Classification |
|---|---|---|
| `pointId` | Synthesised: `${material_id}-${mic_id}-${operation_id}-${batch_id}` | derived |
| `timestamp` | ISO from `batch_date` (date semantics, not strict datetime — see audit 2.8) | derived + requires-contract-change (relax `z.string().datetime()` to `z.string()` OR introduce `batchDate` field — Slice 6) |
| `value` | For `individuals`: `value` per measurement row, or `subgroupMean` if reduced. For `xbar-*`: `subgroupMean`. For range/std plots: `subgroupRange` / `subgroupStdDev`. | derived |
| `batchId` | `batch_id` | directly-sourced |
| `sampleId` | **NOT present in source** — leave undefined. Do not synthesise unless explicitly required by a downstream consumer (and document the synthesis). | source-unavailable |
| `signalIds` | From rule detection output (post-derivation). | derived |
| `status` | **From rule detection only.** Never default to `'in-control'`. If rule detection has not run, the helper does not set `status` (or sets it to a not-yet-evaluated sentinel — Slice 6 enum extension candidate). | derived + requires-contract-change (Slice 6 candidate: add `'not-yet-evaluated'` or make `status` optional) |

### 7.4 Point ordering

Chart-point ordering must be **stable**. The native query orders by `batch_date ASC, batch_id ASC`. Within a batch, individual `value` rows are ordered by `(first_posting_date ASC, last_posting_date ASC, value ASC)` — none of these are guaranteed unique, so `value ASC` is a tie-breaker, not an identity.

---

## 8. `ControlChartSeries` — limits & metadata

| V2 field | Verified source | Transform / derivation | Legacy bridge behaviour | Classification |
|---|---|---|---|---|
| `chartId` | n/a | Synthesised: `${materialId}-${characteristicId}-${chartType}` | Same. | derived |
| `chartType` | See §2. | Rename. | V1 `chart_type`. | directly-sourced |
| `characteristicId` / `characteristicName` | `mic_id` / `mic_name` from `spc_quality_metric_subgroup_mv` or `spc_characteristic_dim_mv` | Direct. | V1 `mic_id` / `mic_name`. | directly-sourced |
| `points` | See §7. | Per-batch derivation. | V1 returns subgroup-shaped points already aggregated. | derived |
| `centerLine` (`cl`) | `spc_locked_limits.cl` for the matching `(material_id, mic_id, plant_id, operation_id, chart_type)` row; else live-computed from subgroup statistics. | Direct or derived. | V1 returns subgroup data only; V2 frontend computes today via `calculations.runtime.ts`. | directly-sourced **or** derived |
| `upperControlLimit` (`ucl`) | `spc_locked_limits.ucl` or live-computed (`CL + A2·R̄` etc.). | Direct or derived. | As above. | directly-sourced **or** derived |
| `lowerControlLimit` (`lcl`) | `spc_locked_limits.lcl` or live-computed. | Direct or derived. | As above. | directly-sourced **or** derived |
| (range-chart UCL) `uclR` | `spc_locked_limits.ucl_r` | Direct. | V1 returns separately; legacy adapter does not currently expose. | directly-sourced + requires-contract-change (no `uclR` field on `ControlChartSeriesSchema`; Slice 6 candidate) |
| (range-chart LCL) `lclR` | `spc_locked_limits.lcl_r` | Direct. | As above. | directly-sourced + requires-contract-change (Slice 6 candidate) |
| (within-batch σ̂) `sigmaWithin` | `spc_locked_limits.sigma_within` | Direct. | V1 returns `process_std_dev`. | directly-sourced + requires-contract-change (Slice 6 candidate to surface verbatim; alternatively, keep on `CharacteristicCapability.standardDeviation`) |
| `upperSpecLimit` | `spc_quality_metric_subgroup_mv.usl_spec` (per-row; constant per `(material_id, mic_id, plant_id, operation_id)`). | Direct. **Zero/zero (both `lsl_spec = 0` and `usl_spec = 0`) must be treated as "not populated", not as `[0,0]`.** | V1 returns spec limits on each chart data row. | directly-sourced (with zero-zero exclusion warning) |
| `lowerSpecLimit` | `spc_quality_metric_subgroup_mv.lsl_spec` | As above. | As above. | directly-sourced |
| `unitOfMeasure` | **NOT present** in `spc_quality_metric_subgroup_mv`. `normality_type` is statistical metadata, not UOM. | n/a | V1 returns `unit_of_measure` (computed elsewhere in V1, possibly from SAP QM); legacy bridge passes it through. | source-unavailable (native) + legacy-bridge-only + requires-contract-change (today the Zod field is required; making it optional and/or adding `unitOfMeasureSource` is a Slice 6 candidate) |
| `confidence` | n/a | Derived from data completeness and freshness (e.g. row count vs expected, age of latest `batch_date`). | V1 has no equivalent; legacy adapter sets `1.0`. | derived |
| `limitProvenance` | Computed: see §3. | `'calculated-from-sample'` (no lock row matched), `'mock-fixture'` (mock), `'unknown'` (cannot resolve). `'imported-from-approved-source'` is **blocked** under this phase — no source row qualifies as governed approval. | Legacy adapter today emits `'calculated-from-sample'`. | derived + blocked (governed value) |
| `approvalState` | Computed: see §4. | `'pending-validation'` when a `locked_by`-identified lock row exists; `'not-approved'` for live-computed; `'unavailable'` if cannot evaluate. | Legacy adapter today emits `'not-approved'`. | derived + blocked (governed `'approved'`) |
| `lockedLimits` | Boolean derived from whether an `spc_locked_limits` row matched. | Derived. | n/a | derived |
| `lockedFrom` | `spc_locked_limits.baseline_from` | Direct (rename). **Semantic:** "baseline window start", not "effective-from". | n/a | directly-sourced (with semantic caveat) |
| `lockedTo` | `spc_locked_limits.baseline_to` | Direct (rename). Same caveat. | n/a | directly-sourced (with semantic caveat) |
| (lock identity) | `spc_locked_limits.locked_by`, `spc_locked_limits.locked_at` | Direct. Not surfaced as a dedicated V2 field today; carried as a warning/badge. | n/a | directly-sourced + requires-contract-change (Slice 6 candidate: add `lockedBy`, `lockedAt` on `ControlChartSeriesSchema` or a sibling object) |
| (lock note) | `spc_locked_limits.locking_note` | Direct. Empty for the UAT row. | n/a | directly-sourced |
| (mic origin / spec signature) | `spc_locked_limits.mic_origin`, `spc_locked_limits.spec_signature`, `spc_locked_limits.unified_mic_key` | Direct. Informational; useful for cross-MIC reconciliation. | n/a | directly-sourced |

### 8.1 Resolving the `spc_locked_limits` 1-row UAT fixture

For the matching key, exactly one row exists in UAT: `material_id=20047111, mic_id=0060, plant_id=C037, operation_id=00000001, chart_type=imr`. The native helper `mapLockedLimitRow` (Slice 4) must:

1. Emit `lockedLimits: true` only when a row was found.
2. Emit `limitProvenance: 'calculated-from-sample'` AND `approvalState: 'pending-validation'` plus an explicit warning that the row is a UAT fixture — until a governed approval workflow exists.
3. Surface `lockedBy` / `lockedAt` / `bookingNote` for audit, but never imply governed approval.

The single-row coverage is documented as a known limitation (see [`spc-known-limitations.md`](./spc-known-limitations.md)).

---

## 9. Specification limits — separated from control limits

Specification limits (`usl_spec`, `lsl_spec`) come **exclusively** from `spc_quality_metric_subgroup_mv`. They are NOT on `spc_locked_limits`. The native helper `deriveSpecificationLimits(row)` reads:

| V2 field | Verified source | Notes | Classification |
|---|---|---|---|
| `upperSpecLimit` / `lowerSpecLimit` | `usl_spec` / `lsl_spec` | Constant per `(material_id, mic_id, plant_id, operation_id)`. Zero/zero ⇒ not populated. | directly-sourced |
| `nominalTarget` | `nominal_target` | Direct. | directly-sourced |
| `toleranceHalfWidth` | `tolerance_half_width` | Direct. | directly-sourced |
| `rawTolerance` | `raw_tolerance` | Direct. | directly-sourced |
| `specSignature` | `spec_signature` | Direct. Stable string per spec definition; useful for change detection. | directly-sourced |
| `specType` | `spec_type` | Direct. Values not enumerated in PR #65 evidence — preserve verbatim. | directly-sourced |

Slice 6 (optional) may add a `specLimitSource` field (`'subgroup-view' | 'unavailable'`) so the chart can label the spec-limit band's origin. Today, the V2 `ControlChartSeriesSchema` exposes only the numeric limits — extra spec metadata (`nominalTarget`, `tolerance*`, `specSignature`, `specType`) has no contract slot and would require Slice 6 to surface.

---

## 10. Signals (WECO / Nelson)

### 10.1 Source classification

| Aspect | Verified status | Classification |
|---|---|---|
| Stored signal table in Databricks | **NOT FOUND** (`spc_nelson_rule_flags_mv` absent) | source-unavailable |
| Stored alarm/violation table | NOT FOUND | source-unavailable |
| V1 storage | None — V1 computes signals client-side in the V1 SPC frontend | source-unavailable |
| V2 calculation today | Frontend `domain-integrations/spc/src/utils/calculations.runtime.ts` ports the V1 algorithm | derived |
| V2 calculation future option | Lift `calculations.runtime.ts` to the V2 backend so the native route can return signals already attached to points | derived |

The helper `classifySignalSource(state)` (Slice 4) returns one of:

- `calculated-frontend` — current path; V2 frontend computes from chart points + limits.
- `calculated-backend` — future path; V2 backend computes during the native query.
- `unavailable` — no chart data loaded; cannot evaluate.
- `not-yet-evaluated` — chart data present but rule detection has not run for this render cycle.

It **never** returns `in-control` from absence; "no signals" is **not** a process-control claim. See [`docs/readiness/ux-truthfulness-checklist.md`](../../../docs/readiness/ux-truthfulness-checklist.md) §2.

### 10.2 `SPCSignal` field mapping (when signals are calculated)

| V2 field | Source / derivation | Classification |
|---|---|---|
| `signalId` | Synthesised: `${ruleCode}-${batchId}-${pointIndex}`. | derived (synthesised) |
| `characteristicId` / `characteristicName` | Chart context. | derived |
| `materialId` / `plantId` | Chart context. | derived |
| `batchId` | `batch_id` of the offending point. | directly-sourced |
| `chartType` | Chart context. | derived |
| `rule` / `ruleCode` | From rule-detection output (`WE1`–`WE4`, `N1`–`N8`). | derived |
| `severity` | Mapping table (`N1`/`WE1` → `critical`, etc.) — implemented today in `calculations.runtime.ts`. | derived |
| `detectedAt` | `batch_date` of the offending point (ISO date; not a strict datetime — same caveat as §7.3). | derived |
| `samplePointId` | Synthesised: `${batchId}-${pointIndex}`. **No verified `sample_id` exists.** | derived (synthesised) |
| `resultValue` | For `individuals`: `value`. For other chart types: `subgroupMean`. | derived |
| `recommendedAction` | **Not stored.** Static SOP text per rule (today: defaults wired in `calculations.runtime.ts`/panels). | derived (static) |
| `status` | Always `'active'` for current chart data. **No alarm lifecycle exists** in any source. | derived (constant) + blocked (no governed lifecycle) |

A future contract refinement (Slice 6 candidate) may add a `signalIdSource: 'synthesised'` field so consumers know the IDs are not source-backed.

---

## 11. Capability (Cp / Cpk / Pp / Ppk)

### 11.1 Source classification

| Aspect | Verified status | Classification |
|---|---|---|
| `spc_capability_detail_mv` | **NOT FOUND** in UAT — migration 013 not applied | source-unavailable |
| `spc_quality_metrics` | METRIC_VIEW; returns aggregate measures (`sigma_within`, `ooc_rate`, `mean_value`, `stddev_overall`) but **not** Cp/Cpk/Pp/Ppk; not row-queryable as a table | source-unavailable for Cp/Cpk |
| V1 derivation | V1 backend computes from subgroup statistics and serves via `/api/spc/capability` | legacy-bridge-only |
| V2 backend derivation | Possible — subgroup data (`sum_value`, `sum_squares`, `batch_n`) plus `nominal_target` / `usl_spec` / `lsl_spec` from the subgroup view, plus `sigma_within` from `spc_locked_limits` when present, would support the calculation | derived (future) |

The helper `classifyCapabilitySource(input)` (Slice 4) returns one of:

- `unavailable` — `spc_capability_detail_mv` is NOT FOUND and no backend calculation has been authorised.
- `backend-calculation-required` — calculation is feasible from verified columns but the algorithm has not been governed.
- `legacy-bridge` — value comes via V1 (current state for `legacy-api` mode).

It **never** invents Cp/Cpk values. If the helper is asked for capability and only verified Databricks data is available, it returns `unavailable` plus a reason.

### 11.2 `CharacteristicCapability` field mapping

| V2 field | Source / derivation | Classification |
|---|---|---|
| `characteristicId` / `characteristicName` | Chart context. | derived |
| `cp` / `cpk` / `pp` / `ppk` | **Source unavailable** under native. Backend calculation possible from `usl_spec`, `lsl_spec`, `nominal_target`, `sum_value`, `sum_squares`, `batch_n`, `sigma_within` once governed. | source-unavailable + derived (future) |
| `sampleCount` | `SUM(batch_n)` over the calculation window. | derived |
| `mean` | `SUM(sum_value) / SUM(batch_n)`. | derived |
| `standardDeviation` | `spc_locked_limits.sigma_within` when available; else compute from `sum_squares` / `sum_value` / `batch_n` (pooled within-batch σ̂). | directly-sourced **or** derived |
| (calculation window) | Native query date range (`dateFrom`, `dateTo`, default rolling). | derived + requires-contract-change (no `calculationWindow` field on `CharacteristicCapabilitySchema`; Slice 6 candidate) |
| `confidence` | Derived from sample count + freshness. | derived |
| `interpretation` | Threshold logic on `cpk` (V1 uses 4 buckets; V2 uses 3 + `insufficient-data`). | derived |
| `limitProvenance` / `approvalState` | Per §§3–4. | derived + blocked |

Slice 6 (recommended) reshapes `CharacteristicCapabilitySchema` so the four indices + `mean` + `standardDeviation` + `interpretation` can be optional, and adds `capabilitySourceStatus: 'unavailable' | 'backend-calculation-required' | 'present' | 'legacy-bridge'` and a `capabilityUnavailableReason: string` field. This is the only contract change in this tranche that is recommended rather than optional — without it, the native route is forced to invent zero values, which violates UX truthfulness.

---

## 12. Alarm history

| Aspect | Verified status | Classification |
|---|---|---|
| Source table | None in V1 or in `connected_plant_uat.gold` | source-unavailable |
| Approximation from `spc_nelson_rule_flags_mv` | Not possible — MV NOT FOUND | source-unavailable |
| Native route | Out of scope for this tranche | n/a |

All `SPCAlarmHistoryItem` fields are classified `source-unavailable` for native. Mock-only today. The panel `spc-alarm-history-panel.tsx` should remain mock-only or be deferred when the native route is wired (this is recorded in Slice 8 readiness sync).

No contract change for `SPCAlarmHistoryItemSchema` is required in this tranche; the panel itself decides whether to render mock data with a "demo only" badge or unmount in native mode.

---

## 13. Related batches

| V2 field | Verified source | Transform / derivation | Classification |
|---|---|---|---|
| `batchId` / `materialId` / `plantId` | `spc_quality_metric_subgroup_mv` (or `spc_batch_dim_mv`) — derived from a "batches with signals or with notable values" query. | Direct (after rule-detection). | derived |
| `status` | **No SPC source.** Would require cross-domain join to `gold_inspection_usage_decision` or `gold_batch_quality_result_v` — both governed elsewhere (see QM UD work). | n/a | source-unavailable (SPC) + blocked (release vocabulary) + unknown (governance) |
| `relatedSignalCount` | Derived from rule-detection per batch. | Derived. | derived |
| `releaseImpact` | **Not stored, not governed.** Classification rule (`blocking` / `risk` / `none`) is undefined in current evidence. | n/a | blocked (governance) |
| `drillThroughTarget` | Static. | Static. | derived |

Native route does not populate `status` or `releaseImpact` in this phase. Mock-only behaviour preserved.

---

## 14. Native route inputs (parameter contract)

The future native route will accept the following inputs. **No request-side Zod schema exists in V2 today** — the TypeScript interface `SPCMonitoringAdapterRequest` is the closest thing.

| Native parameter | Verified column | Required? | Notes | Classification |
|---|---|---|---|---|
| `materialId` | `material_id` | Required | Primary key for navigation; reject blank. | directly-sourced |
| `plantId` | `plant_id` | Required | Preserve namespace; exclude `P999`. | directly-sourced + unknown (namespace mapping) |
| `micId` (a.k.a. `characteristicId`) | `mic_id` | Required | | directly-sourced |
| `operationId` | `operation_id` | Optional | Sequential identifier; **not** SAP work centre. | directly-sourced + requires-contract-change (add to request schema) |
| `chartType` | n/a | Optional | If absent, the native route reads `spc_locked_limits.chart_type` (if matched) or applies heuristic. | derived |
| `dateFrom` / `dateTo` | filter on `batch_date` | Optional | | derived |
| `maxRows` | n/a | Optional | Server-side cap to protect MV scans. | derived |

Open question: whether the request should carry an explicit `chartType` override. The native query can choose to compute both `subgroupMean` and `value` and let the chart decide; that decision is documented further in Slice 7.

---

## 15. Field-by-field index

For readers searching for a specific V2 field, here is the consolidated index.

| V2 field | Section | Primary classification |
|---|---|---|
| `SPCMonitoringContext.materialId` | §5 | directly-sourced |
| `SPCMonitoringContext.materialDescription` | §5 | directly-sourced (rename) |
| `SPCMonitoringContext.plantId` | §5 | directly-sourced + unknown |
| `SPCMonitoringContext.plantName` | §5 | directly-sourced |
| `SPCMonitoringContext.batchId` | §5 | directly-sourced |
| `SPCMonitoringContext.workCentreId` | §5 | source-unavailable + legacy-bridge-only + unknown |
| `SPCMonitoringContext.characteristicId` | §5 | directly-sourced |
| `SPCMonitoringContext.chartType` | §5 | directly-sourced |
| `SPCMonitoringContext.activeSignals` | §5 / §10 | derived (no stored count) |
| `SPCMonitoringContext.highestSeverity` | §5 / §10 | derived |
| `SPCMonitoringContext.lastUpdatedAt` | §5 | derived |
| `MonitoredSPCCharacteristic.characteristicId` | §6 | directly-sourced |
| `MonitoredSPCCharacteristic.characteristicName` | §6 | directly-sourced |
| `MonitoredSPCCharacteristic.chartType` | §6 | derived |
| `MonitoredSPCCharacteristic.batchCount` | §6 | directly-sourced or derived |
| `MonitoredSPCCharacteristic.avgSamplesPerBatch` | §6 | derived |
| `MonitoredSPCCharacteristic.hasActiveSignal` | §6 / §10 | source-unavailable + derived + legacy-bridge-only |
| `MonitoredSPCCharacteristic.highestSignalSeverity` | §6 / §10 | derived |
| `MonitoredSPCCharacteristic.operationId` | §6 | directly-sourced |
| `MonitoredSPCCharacteristic.chartTypeSource` | §6 | derived |
| `ControlChartPoint.pointId` | §7 | derived (synthesised) |
| `ControlChartPoint.timestamp` | §7 | derived |
| `ControlChartPoint.value` | §7 | derived (depends on chart type) |
| `ControlChartPoint.batchId` | §7 | directly-sourced |
| `ControlChartPoint.sampleId` | §7 | source-unavailable |
| `ControlChartPoint.signalIds` | §7 / §10 | derived |
| `ControlChartPoint.status` | §7 / §10 | derived (never default to in-control) |
| `ControlChartSeries.chartId` | §8 | derived (synthesised) |
| `ControlChartSeries.chartType` | §8 | directly-sourced |
| `ControlChartSeries.characteristicId` / `characteristicName` | §8 | directly-sourced |
| `ControlChartSeries.points` | §7 / §8 | derived |
| `ControlChartSeries.centerLine` | §8 | directly-sourced or derived |
| `ControlChartSeries.upperControlLimit` | §8 | directly-sourced or derived |
| `ControlChartSeries.lowerControlLimit` | §8 | directly-sourced or derived |
| `ControlChartSeries.upperSpecLimit` / `lowerSpecLimit` | §9 | directly-sourced |
| `ControlChartSeries.unitOfMeasure` | §8 | source-unavailable + legacy-bridge-only |
| `ControlChartSeries.confidence` | §8 | derived |
| `ControlChartSeries.limitProvenance` | §3 / §8 | derived + blocked (governed values) |
| `ControlChartSeries.approvalState` | §4 / §8 | derived + blocked |
| `ControlChartSeries.lockedLimits` | §8 | derived |
| `ControlChartSeries.lockedFrom` / `lockedTo` | §8 | directly-sourced (`baseline_*`) |
| `CharacteristicCapability.cp/cpk/pp/ppk` | §11 | source-unavailable + derived (future) |
| `CharacteristicCapability.mean` | §11 | derived |
| `CharacteristicCapability.standardDeviation` | §11 | directly-sourced or derived |
| `CharacteristicCapability.sampleCount` | §11 | derived |
| `CharacteristicCapability.confidence` | §11 | derived |
| `CharacteristicCapability.interpretation` | §11 | derived |
| `SPCSignal.*` | §10 | derived (computed) |
| `SPCAlarmHistoryItem.*` | §12 | source-unavailable |
| `SPCRelatedBatch.status` / `releaseImpact` | §13 | blocked / unknown |
| `SPCRelatedBatch.relatedSignalCount` | §13 | derived |

---

## 16. Contract-change candidates (consolidated for Slice 6)

The following potential Zod changes are surfaced by this mapping. Slice 6 is **optional** and will only proceed if the helpers (Slice 4) cannot represent the verified source honestly without one of these changes.

| Candidate | Rationale | Recommended in Slice 6? |
|---|---|---|
| `SPCMonitoringContextSchema.operationId: z.string().optional()` | Verified `operation_id` has no field today. | Recommended |
| `SPCMonitoringContextSchema.workCentreMappingStatus: z.enum([...]).optional()` | Capture that `workCentreId` is unavailable. | Optional |
| `SPCMonitoringContextSchema.plantIdNamespace: z.enum(['P-prefix','C-prefix','unknown']).optional()` | Surface namespace warning. | Optional |
| `ControlChartSeriesSchema.unitOfMeasure` → optional (`z.string().optional()`) | Verified source has no UOM. | Recommended |
| `ControlChartSeriesSchema.unitOfMeasureSource: z.enum(['legacy-bridge','unavailable']).optional()` | Label UOM origin. | Optional |
| `ControlChartSeriesSchema.uclR`, `lclR`, `sigmaWithin` | Surface verified `ucl_r`, `lcl_r`, `sigma_within` from `spc_locked_limits`. | Optional |
| `ControlChartSeriesSchema.lockedBy`, `lockedAt`, `lockingNote` | Surface lock identity / timestamp / note. | Optional |
| `ControlChartPointSchema.timestamp` → relax to `z.string()` OR add `batchDate: z.string()` | `batch_date` is a date, not a datetime. | Recommended |
| `ControlChartPointSchema.subgroupMean`, `subgroupRange`, `sampleCount`, `minValue`, `maxValue`, `anyRejection`, `anyAcceptance` | Surface verified per-batch derivations. | Optional |
| `ControlChartPointSchema.status` → optional **or** add `'not-yet-evaluated'` | Avoid defaulting to `'in-control'`. | Recommended |
| `LimitProvenanceSchema` add `'uat-fixture-only'` | UAT-only locked row. | Optional |
| `ApprovalStateSchema` add `'lock-present-not-governed'` | UAT-only lock identity. | Optional |
| `CharacteristicCapabilitySchema.cp/cpk/pp/ppk/mean/standardDeviation/interpretation` → optional | Source unavailable. | **Strongly recommended** |
| `CharacteristicCapabilitySchema.capabilitySourceStatus`, `capabilityUnavailableReason` | Status fields. | **Strongly recommended** |
| `CharacteristicCapabilitySchema.calculationWindow` | Sample window metadata. | Optional |
| `SPCSignalSchema.signalIdSource: 'synthesised'` | IDs are not source-backed. | Optional |

No contract change is proposed for `SPCAlarmHistoryItemSchema` or `SPCRelatedBatchSchema` in this tranche — both are documented as mock-only or deferred for native route.

---

## 17. Confirmations

- No native SPC Databricks route was added in this slice.
- No live Databricks runtime wiring was added.
- No Databricks columns were invented — every column reference is from the PR #65 verified evidence.
- The legacy bridge boundary is preserved: V1 wire field names (`result_value`, `sample_id`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`, `subgroup_sd`, `unit_of_measure`, `process_mean`, `process_std_dev`) are documented as `legacy-bridge-only` and are **not** carried into the native source-of-truth column list.
- `locked_by` is not treated as full governed approval.
- `spc_capability_detail_mv` and `spc_nelson_rule_flags_mv` remain NOT FOUND; capability and stored-signal fields are documented as `source-unavailable`.
- "No signals returned" is never to be treated as "in control" by any future native mapper.
- `operation_id` is not aliased to `workCentreId`.
- `P999` and blank-material rows are excluded by the native query as documented.
- Specification limits (`usl_spec`, `lsl_spec`) come only from the subgroup view; they are not in `spc_locked_limits`.
- `baseline_from` / `baseline_to` replace `effective_from` / `effective_to`.
- No SPC decision authority, SAP QM write-back, e-signature, or GxP workflow was introduced.
- No service-principal fallback was added.
- No app-side plant authorization was added.
- No production SPC readiness was claimed; SPC remains documented as `verification-pack-ready` with contract alignment in progress.
