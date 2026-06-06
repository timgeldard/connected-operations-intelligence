# SPC Native Contract Alignment Audit

**Date:** 2026-05-21
**Branch:** `feature/spc-native-contract-alignment`
**Predecessor evidence:** PR #65 — SPC Databricks verification pack (commit `f641a8d` + `50c8b9a`)
**Status:** Docs-only audit. No runtime code changed.

> **Purpose.** Before any V2 SPC contract field, mapper helper, or future native
> route is written, this document records every place where V2 still assumes
> the *old*, *unverified* SPC field names, grain, or navigation model. Each
> outdated assumption is mapped to the verified Databricks schema from PR #65,
> the affected files are listed, the risk if unchanged is stated, and the
> recommended action is classified.
>
> **Hard scope.** This audit does NOT modify the V2 runtime, the FastAPI
> proxy, the legacy-bridge adapter, Zod contracts, or generated Pydantic
> artifacts. It identifies the targets that later slices in this tranche
> (Slice 2 mapping doc, Slice 3 fixtures, Slice 4 helpers, Slice 5 tests,
> Slice 6 optional contract refinement, Slice 7 native-route prerequisite
> plan, Slice 8 readiness sync) will address.
>
> **Boundary.** The V1 legacy-bridge adapter
> (`SPCMonitoringLegacyApiAdapter`) is allowed to keep V1 field names
> (`result_value`, `sample_id`, `sample_timestamp`, `subgroup_mean`,
> `subgroup_range`, `subgroup_sd`, `unit_of_measure`) because those names
> describe what the V1 FastAPI backend *returns* on the wire, not what
> Databricks stores. They are **legacy-bridge-only** and are not introduced
> into the future native route or its mapper. This audit explicitly preserves
> the legacy-bridge surface and flags it as such everywhere it appears.

---

## 1. Verified Databricks schema (from PR #65 — recap, no new claims)

This audit treats the following findings as the source of truth for the future
native route. None of them are re-verified here. See
[`spc-databricks-verification-results-summary.md`](./spc-databricks-verification-results-summary.md)
and the source/grain/limit verification docs for the underlying evidence.

### 1.1 `spc_quality_metric_subgroup_mv` / `_v` (preferred row source)

| V1/V2 assumed column | Actual status in Databricks | Replacement / treatment |
|----------------------|------------------------------|--------------------------|
| `result_value` | NOT PRESENT | `value` (individual measurement) |
| `sample_id` | NOT PRESENT | no per-sample row key exists |
| `sample_timestamp` | NOT PRESENT | `batch_date`, `first_posting_date`, `last_posting_date` |
| `subgroup_mean` | NOT PRESENT | derive: `sum_value / batch_n` |
| `subgroup_range` | NOT PRESENT | `batch_range` |
| `subgroup_sd` | NOT PRESENT | derive from `sum_squares`, `sum_value`, `batch_n` |
| `inspection_lot_id` | NOT PRESENT | not in this view |
| `unit_of_measure` | NOT PRESENT | no physical UOM column; `normality_*` are statistical metadata, not UOM |

Present and load-bearing for the future native route:
`material_id`, `material_name`, `plant_id`, `plant_name`, `mic_id`, `mic_name`,
`operation_id`, `batch_id`, `batch_date`, `batch_n`, `value`, `sum_value`,
`sum_squares`, `batch_range`, `min_value`, `max_value`, `any_rejection`,
`any_acceptance`, `lsl_spec`, `usl_spec`, `spec_type`, `nominal_target`,
`tolerance_half_width`, `raw_tolerance`, `spec_signature`, `unified_mic_key`,
`subgroup_rep`, `normality_type`, `normality_method`, `normality_signature`.

### 1.2 `spc_locked_limits` (control-limit source)

Present (19 columns, 1 row in UAT):
`material_id`, `plant_id`, `mic_id`, `operation_id`, `chart_type`,
`cl`, `ucl`, `lcl`, `ucl_r`, `lcl_r`, `sigma_within`,
`locked_by`, `locked_at`, `baseline_from`, `baseline_to`,
`unified_mic_key`, `mic_origin`, `spec_signature`, `locking_note`.

| V1/V2 assumed column | Actual status | Replacement |
|----------------------|---------------|-------------|
| `usl` / `lsl` | NOT PRESENT here | spec limits live in subgroup view |
| `effective_from` / `effective_to` | NOT PRESENT | `baseline_from` / `baseline_to` |
| `provenance` | NOT PRESENT | `locking_note` |
| `approved_by` / approval state | NOT PRESENT | only `locked_by` exists; lock ≠ governed approval |

### 1.3 Missing objects (vs V1 expectations)

| Object | Status | Effect on V2 contract |
|--------|--------|------------------------|
| `spc_capability_detail_mv` | NOT FOUND in UAT | Cp/Cpk/Pp/Ppk fully unavailable from Databricks |
| `spc_nelson_rule_flags_mv` | NOT FOUND in UAT | No stored signal/rule source; signals are calculated only |

### 1.4 Navigation findings

- `operation_id` is a **sequential inspection-operation identifier**, not a
  SAP work centre. Do NOT alias `workCentreId` to `operation_id`.
- Plant IDs include both `P`-prefixed (SPC internal) and `C`-prefixed (SAP)
  values; mapping between the two namespaces is **unconfirmed**.
- `P999` is a sentinel/aggregate plant. Rows with `plant_id = 'P999'` and
  blank/null `material_id` must be excluded from production-candidate
  navigation.

---

## 2. Audit table — old assumption → verified schema

Each row covers one outdated assumption found in V2. Columns:

- **Old assumption / artefact** — what V2 currently encodes.
- **Affected files** — where the assumption lives.
- **Verified schema (PR #65)** — what Databricks actually exposes.
- **Risk if left unchanged** — what breaks if a native route is built on the
  old assumption.
- **Recommended action** — what later slices will do.
- **Classification** — `docs-only` / `contract-change` / `test-fixture` /
  `future-runtime` / `legacy-bridge-only-keep`.

### 2.1 Request shape: `SPCMonitoringAdapterRequest` uses `workCentreId`

| | |
|---|---|
| **Old assumption** | Adapter request type includes `workCentreId?: string` but no `operationId`. The TS interface implies V2 SPC entry-points scope by SAP work centre. |
| **Affected files** | `domain-integrations/spc/src/adapters/spc-monitoring-adapter.ts` (`SPCMonitoringAdapterRequest` lines 27–33); `spc-monitoring-legacy-api-adapter.ts` (`request.workCentreId` → `body.operation_id` at line ~234); every panel that builds a request (`spc-process-context-panel.tsx`, `spc-monitoring-workspace.tsx`); `packages/data-contracts/src/schemas/adapter-requests.ts` (no `SPCMonitoringAdapterRequest` Zod schema exists today). |
| **Verified schema** | `operation_id` is a sequential inspection-operation identifier and is **NOT** a SAP work centre. Verified V2 entry-point parameters are `materialId` (required), `plantId` (required), `micId` (required), `operationId` (optional), `dateFrom`/`dateTo` (optional), `chartType` (optional). |
| **Risk if unchanged** | A future native route built from this request will silently swap a non-work-centre identifier into a `workCentreId` slot, locking a governance error into the live SPC chart filter and into any cross-domain consumer that reads `workCentreId`. |
| **Recommended action** | Slice 2: document that the native request must carry `operationId` distinct from `workCentreId`. Slice 4: helpers accept `operationId`. Slice 6 (optional contract refinement): introduce `operationId` on the adapter request *or* a request-side Zod schema with `workCentreMappingStatus`. Slice 5: tests assert `operationId` is not silently aliased to `workCentreId`. |
| **Classification** | docs-only (Slice 2) + future-runtime (mapper helpers Slice 4) + contract-change candidate (Slice 6 — only if helpers cannot represent it cleanly otherwise). |

### 2.2 `SPCMonitoringContext.workCentreId` (Zod contract)

| | |
|---|---|
| **Old assumption** | `SPCMonitoringContextSchema.workCentreId: z.string().optional()` and no `operationId` field. Panel template in `spc-process-context-panel.tsx` renders "Work Centre" from `ctx.workCentreId`. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (line ~60); `domain-integrations/spc/src/panels/spc-process-context-panel.tsx` (line ~54); generated artefacts (`packages/data-contracts/dist-schema/contracts.json`, `apps/api/contracts/generated.py`). |
| **Verified schema** | The native source carries `operation_id` only. There is no governed `work_centre_id` column in the verified subgroup view or locked limits. |
| **Risk if unchanged** | Native mapper either (a) leaves `workCentreId` permanently unset, hiding the verified `operation_id`, or (b) wrongly assigns `operation_id` to `workCentreId`, claiming SAP work-centre semantics that don't exist. |
| **Recommended action** | Slice 2: classify `workCentreId` as **source unavailable** and `operationId` as **directly sourced (`operation_id`)**. Slice 4: helpers expose `operationId`. Slice 6 (optional): add `operationId` to `SPCMonitoringContextSchema` alongside `workCentreId`; introduce `workCentreMappingStatus` (`unavailable` / `mapping-not-confirmed`). |
| **Classification** | docs-only (Slice 2) + contract-change candidate (Slice 6) + future-runtime (Slice 4). Do not delete `workCentreId` — it stays so the legacy bridge response shape continues to validate, but it is documented as unavailable from the native source. |

### 2.3 `ControlChartSeries.unitOfMeasure` is required

| | |
|---|---|
| **Old assumption** | `ControlChartSeriesSchema.unitOfMeasure: z.string()` (required). The legacy adapter populates it from `firstPoint?.unit_of_measure ?? ''`. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (line ~144); `domain-integrations/spc/src/adapters/spc-monitoring-legacy-api-adapter.ts` (line ~267); `spc-v2-contract-mapping.md` (Section 9 — labels as `unit_of_measure` direct, pending verification); generated artefacts. |
| **Verified schema** | The subgroup view has **no physical unit-of-measure column**. `normality_type` / `normality_method` are statistical distribution metadata, not UOM. |
| **Risk if unchanged** | A native mapper that hits the Zod required field will either invent a blank UOM ('' empty string), an "unknown" sentinel string, or repurpose a non-UOM column (e.g. `normality_type`) — all three are source-untrue and violate the UX truthfulness checklist. |
| **Recommended action** | Slice 2: classify `unitOfMeasure` as **source unavailable** for native, **legacy-bridge-only** when reading via V1 FastAPI (which may compute UOM elsewhere). Slice 4: helpers return UOM as `undefined` from native rows. Slice 6 (optional): relax `unitOfMeasure` to `z.string().optional()` *and* introduce `unitOfMeasureSource: 'legacy-bridge' | 'unavailable'` — only if the helpers cannot represent the gap honestly otherwise. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6). |

### 2.4 `ControlChartSeries.lockedFrom` / `lockedTo` as datetimes

| | |
|---|---|
| **Old assumption** | `lockedFrom: z.string().datetime().optional()` and `lockedTo: z.string().datetime().optional()`. `spc-v2-contract-mapping.md` Section 9 reads "Expected Column: `effective_from` or `baseline_from` (unconfirmed)". |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~149–150); `spc-v2-contract-mapping.md` Section 9. |
| **Verified schema** | `spc_locked_limits` has `baseline_from` / `baseline_to` (not `effective_from` / `effective_to`). Their value semantics ("baseline window") are governed lock provenance, not necessarily a strict effective-validity period. |
| **Risk if unchanged** | Mapping doc keeps `effective_from` as a possibility — a native mapper might pick the wrong column, or claim "effective" semantics that the source does not provide. UI may render a baseline window as an effectivity window. |
| **Recommended action** | Slice 2: pin `lockedFrom` ← `baseline_from` and `lockedTo` ← `baseline_to`; document semantic gap (baseline ≠ effective). Slice 4: `mapLockedLimitRow()` populates from `baseline_from` / `baseline_to`. Slice 5: test asserts mapping. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4 helper) + test-fixture (Slice 3 / Slice 5). |

### 2.5 `ControlChartSeries.upperSpecLimit` / `lowerSpecLimit` source

| | |
|---|---|
| **Old assumption** | The contract treats spec limits as optional, but `spc-v2-contract-mapping.md` Section 9 says they come from `spc_quality_metric_subgroup_v.usl_spec` / `lsl_spec`. `spc-control-limit-provenance-verification.md` and `spc-known-limitations.md` previously left this ambiguous. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~142–143); `spc-monitoring-legacy-api-adapter.ts` (line ~265 reads `firstPoint?.usl_spec`); `spc-v2-contract-mapping.md`. |
| **Verified schema** | `lsl_spec` and `usl_spec` exist on the subgroup view (per row, not per series). `spc_locked_limits` has **no** `usl`/`lsl`. Primary golden candidate (salt) has `usl_spec`/`lsl_spec = 0.0` (not populated for that material). |
| **Risk if unchanged** | (a) Native route may search for spec limits in locked limits and find none; (b) `0.0` may be treated as a real spec limit instead of "not populated". |
| **Recommended action** | Slice 2: pin spec limits to subgroup-view per-row columns; document that `0.0` for both `lsl_spec` and `usl_spec` should be treated as **not populated**, not as a literal `[0,0]` band. Slice 4: `deriveSpecificationLimits()` returns `undefined` for zero/zero rows and a warning. Slice 5: test asserts zero/zero is not surfaced. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + test-fixture (Slice 3 / Slice 5). |

### 2.6 `ControlChartSeries.limitProvenance` enum lacks UAT-fixture state

| | |
|---|---|
| **Old assumption** | `LimitProvenanceSchema = z.enum(['mock-fixture', 'calculated-from-sample', 'imported-from-approved-source', 'unknown'])`. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (line ~17); `spc-v2-contract-mapping.md` Section 3. |
| **Verified schema** | `spc_locked_limits` has **1 UAT test row**. Provenance is "locked-by-identified-user" but is **not** a governed approval, and the row is not production-representative. |
| **Risk if unchanged** | A native mapper that finds the single UAT row will tag the chart as `imported-from-approved-source` and `approvalState: 'approved'`, which overstates the governance state. |
| **Recommended action** | Slice 2: classify legacy mapping; document that native should treat the single UAT row as **uat-fixture-only**. Slice 4: `mapLockedLimitRow()` returns provenance status `locked-limit-present` / `uat-fixture-only` / `approval-not-governed`, not directly the Zod enum. Slice 6 (optional): extend `LimitProvenanceSchema` with `'uat-fixture-only'` and `ApprovalStateSchema` with `'lock-present-not-governed'`. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6). |

### 2.7 Chart-point grain: `ControlChartPoint` assumes 1 row = 1 measurement

| | |
|---|---|
| **Old assumption** | `ControlChartPointSchema` carries `pointId`, `timestamp` (ISO datetime), `value` (single number), optional `batchId`, optional `sampleId`. Mock data uses one chart point per "subgroup". Legacy adapter reads `p.sample_id`, `p.sample_timestamp`, `p.subgroup_mean ?? p.result_value`. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~117–125); `spc-monitoring-legacy-api-adapter.ts` (line ~239); `spc-monitoring-mock-data.ts`; panels under `domain-integrations/spc/src/panels/`. |
| **Verified schema** | The subgroup MV is **measurement-level** (one row per measurement); `batch_n` is sample count per batch; `subgroup_rep` is **not** a reliable unique key. There is **no `sample_id`** and **no `sample_timestamp`**. To produce one chart point per batch/subgroup, the native query must group by `(material_id, plant_id, mic_id, operation_id, batch_id)` and derive `subgroupMean = sum_value / batch_n`, `subgroupRange = batch_range`, `sampleCount = batch_n`. |
| **Risk if unchanged** | A native route that maps rows 1:1 will plot one chart point per individual measurement, not per batch/subgroup. Chart axis units are wrong; subgroup statistics are lost; the chart is no longer comparable to V1. |
| **Recommended action** | Slice 2: document chart-point grain as derived. Slice 4: `deriveSubgroupPoint()` consumes the measurement-level rows for a batch and returns `{ batchId, batchDate, subgroupMean, subgroupRange, sampleCount, minValue, maxValue, individualValues?, sourceRowCount, warnings }`. Slice 5: tests cover the derivation. Slice 6 (optional): extend `ControlChartPointSchema` with `subgroupMean`, `subgroupRange`, `sampleCount`, `minValue`, `maxValue`. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6) + test-fixture (Slice 3 / Slice 5). |

### 2.8 `ControlChartPoint.timestamp` requires ISO datetime

| | |
|---|---|
| **Old assumption** | `timestamp: z.string().datetime()` — strict ISO 8601 datetime with time component. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (line ~119). |
| **Verified schema** | `batch_date` is the preferred chart time axis. Its concrete data type was not asserted in PR #65 beyond candidate dates ("date" semantics, not necessarily a full timestamp). `first_posting_date` / `last_posting_date` also exist. |
| **Risk if unchanged** | A native mapper that passes a bare date through the Zod schema will fail validation. A mapper that synthesises a midnight ISO timestamp ("2026-05-21T00:00:00.000Z") implies a precision the source does not provide. |
| **Recommended action** | Slice 2: document `timestamp` as derived from `batch_date`; native helper returns the date in ISO form and **also** exposes the raw `batch_date` plus a `chartPointDerivation` field. Slice 4: helper documents conversion. Slice 6 (optional): relax `timestamp` to `z.string()` (any ISO-8601-shaped string, date or datetime) *or* introduce a separate `batchDate` field; do not silently fabricate a time component. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6). |

### 2.9 `ControlChartPoint.status` defaults to `'in-control'`

| | |
|---|---|
| **Old assumption** | `status: z.enum(['in-control', 'warning', 'out-of-control'])`. Legacy adapter hard-codes `status: 'in-control' as const` for every point (line ~247). |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (line ~124); `spc-monitoring-legacy-api-adapter.ts` (line ~247); `domain-integrations/spc/src/utils/calculations.runtime.ts` (computes signals client-side). |
| **Verified schema** | There is **no stored signal/rule source** in Databricks (`spc_nelson_rule_flags_mv` not found). Signals are calculated. The verified UX rule (see [`docs/readiness/ux-truthfulness-checklist.md`](../../../docs/readiness/ux-truthfulness-checklist.md) §2) is that "no signals returned" must NOT be rendered as "in control". |
| **Risk if unchanged** | A native mapper that ships every point as `'in-control'` by default presents a verified process-control claim from absence of stored signals — a UX truthfulness violation. |
| **Recommended action** | Slice 2: document `status` as **derived from rule-detection output only**; if rule detection has not run, the point status must be `unavailable`/`not-yet-evaluated`, not `'in-control'`. Slice 4: native helper does **not** populate `status` — that is left to the rule-detection layer. Slice 5: test asserts the helper does not invent `'in-control'`. Slice 6 (optional): add `'not-yet-evaluated'` to the enum, *or* make `status` optional. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6) + test-fixture (Slice 5). |

### 2.10 `SPCSignal` requires `samplePointId`, `resultValue`, `detectedAt`

| | |
|---|---|
| **Old assumption** | `SPCSignalSchema` requires `samplePointId: z.string()`, `resultValue: z.number()`, `detectedAt: z.string().datetime()`, `batchId: z.string()`, `recommendedAction: z.string()`, `status: z.enum([...]).` |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~93–109); mock signals in `spc-monitoring-mock-data.ts`; `active-spc-signals-panel.tsx`, `spc-signals-for-release-panel.tsx`. |
| **Verified schema** | No `sample_id`, no `result_value`, no `sample_timestamp` on the subgroup view. Signals are calculated, not stored, so there is no source-of-truth `recommendedAction` or `status` lifecycle either. |
| **Risk if unchanged** | A native signal mapper must invent `samplePointId` (synthesise from `batch_id + point_index`), pull `resultValue` from `value` or the derived `subgroupMean` (depending on chart type), and date it from `batch_date` (date, not datetime). It must then also invent `recommendedAction` (no V1 storage) and `status` (no alarm lifecycle). |
| **Recommended action** | Slice 2: classify each `SPCSignal` field as derived/synthesised/static; document `recommendedAction` as static-only and `status` as `'active'`-only for current-chart signals. Slice 4: helpers do not return `SPCSignal` directly — they return rule-violation rows whose mapping to the signal contract is documented as containing synthesised IDs. Slice 6 (optional): introduce `signalIdSource: 'synthesised'` to make the synthesis explicit. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6) + test-fixture (Slice 5). |

### 2.11 `CharacteristicCapability` requires Cp/Cpk/Pp/Ppk/mean/sd/interpretation

| | |
|---|---|
| **Old assumption** | `CharacteristicCapabilitySchema` requires `cp: z.number()`, `cpk: z.number()`, `pp: z.number()`, `ppk: z.number()`, `mean: z.number()`, `standardDeviation: z.number().min(0)`, `interpretation: z.enum(['capable','marginal','not-capable','insufficient-data'])`, all non-optional. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~159–173); `domain-integrations/spc/src/panels/characteristic-capability-panel.tsx`; `spc-monitoring-legacy-api-adapter.ts` (lines ~307–319 — coerce missing values to `0`); `spc-v2-contract-mapping.md` Section 10; generated artefacts. |
| **Verified schema** | `spc_capability_detail_mv` is **NOT FOUND** in UAT (`spc-capability-verification.md`). `spc_quality_metrics` is a Metric View, not row-queryable, and has aggregate measures (`sigma_within`, `ooc_rate`, `mean_value`, `stddev_overall`) but **not** Cp/Cpk/Pp/Ppk. |
| **Risk if unchanged** | A native route is forced to either (a) coerce all four indices to `0` (which the legacy adapter does today), implying "not capable" rather than "unavailable", or (b) calculate Cp/Cpk in the backend from subgroup data — which is allowed but is a deliberate calculation choice that must be governed before being shipped. |
| **Recommended action** | Slice 2: classify capability as **source unavailable** from Databricks today; classify backend-calculated capability as a deliberate future design. Slice 4: `classifyCapabilitySource()` returns `unavailable` / `backend-calculation-required`, not an invented Cp/Cpk. Slice 5: tests assert helper does not invent Cp/Cpk. Slice 6 (recommended candidate): make Cp/Cpk/Pp/Ppk/mean/sd/interpretation optional; add `capabilitySourceStatus: 'unavailable' \| 'backend-calculation-required' \| 'present'` and `capabilityUnavailableReason`. The mock fixture already populates these — making them optional does not break mock or legacy paths. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change recommended (Slice 6). |

### 2.12 `SPCAlarmHistoryItem` has no source

| | |
|---|---|
| **Old assumption** | `SPCAlarmHistoryItemSchema` requires `alarmId`, `timestamp`, `characteristicId`, `rule`, `severity`, `status`, with optional acknowledgement fields. Panel `spc-alarm-history-panel.tsx` renders this contract. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~181–192); `spc-monitoring-adapter.ts` (mock); legacy adapter falls through to mock; `spc-v2-contract-mapping.md` Section 12. |
| **Verified schema** | No stored alarm/signal/rule/violation table exists in `connected_plant_uat.gold`. V1 had no alarm history table either. |
| **Risk if unchanged** | Native mapper for alarm history would have to invent rows. Or worse, approximate from `spc_nelson_rule_flags_mv` — which itself is NOT FOUND. The panel risks shipping data that has no source. |
| **Recommended action** | Slice 2: classify alarm history as **source unavailable** — mock-only or deferred panel. Slice 4: no helper for alarm history. Slice 6 (optional): leave the schema as-is; introduce a panel-level `alarmHistorySourceStatus: 'unavailable'` if shipped in a future panel. Slice 8: readiness docs explicitly call out alarm-history as deferred/mock-only. |
| **Classification** | docs-only (Slice 2 + Slice 8). No contract change required for this tranche. |

### 2.13 `SPCRelatedBatch.status` and `releaseImpact`

| | |
|---|---|
| **Old assumption** | `SPCRelatedBatchSchema.status: z.enum(['released','on-hold','rejected','under-review','awaiting-review'])`, `releaseImpact: z.enum(['blocking','risk','none'])`. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~200–209); `spc-related-batches-panel.tsx`; `spc-v2-contract-mapping.md` Section 13. |
| **Verified schema** | No SPC-specific source provides batch release status or release-impact classification. A join to `gold_batch_quality_result_v` (or to the QM UD source) would be required, plus a governance decision for `releaseImpact`. |
| **Risk if unchanged** | A native mapper risks importing "released"/"rejected" labels into SPC without confirming the governed UD code mapping. This is the same governance pattern as QM UD — must not be claimed without source. |
| **Recommended action** | Slice 2: classify `status` as **legacy-bridge-only / cross-domain join required**, `releaseImpact` as **derived (not stored)**; defer native wiring. Slice 8: readiness docs flag related-batches panel as mock-only for native route. |
| **Classification** | docs-only (Slice 2 + Slice 8). No contract change required for this tranche. |

### 2.14 `MonitoredSPCCharacteristic.hasActiveSignal`

| | |
|---|---|
| **Old assumption** | `hasActiveSignal: z.boolean()` (required), with optional `highestSignalSeverity`. Mapping doc Section 11 says source is `spc_nelson_rule_flags_mv`. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (lines ~42–43); `spc-monitoring-legacy-api-adapter.ts` (line ~197 reads `c.has_active_signal`). |
| **Verified schema** | `spc_nelson_rule_flags_mv` is NOT FOUND. There is no stored boolean for "has active signal" at the characteristic level. |
| **Risk if unchanged** | A native mapper that defaults `hasActiveSignal: false` says "no signal" — see UX truthfulness rule (no signals ≠ in control). The legacy adapter trusts whatever the V1 backend returns; this is **legacy-bridge-only** behaviour. |
| **Recommended action** | Slice 2: classify `hasActiveSignal` as **legacy-bridge-only** (V1 backend computes); for the native route, treat as **unavailable / computed-only-when-chart-loaded**. Slice 4: helpers do not return `hasActiveSignal` at the characteristic level. Slice 6 (optional): add `signalSourceStatus` to flag the gap. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + legacy-bridge-only-keep (no contract change required). |

### 2.15 Spec-limit fields on `ControlChartSeries` vs `spc_locked_limits`

See 2.5 above. Listed separately because the mapping doc historically suggested spec limits could come from either source.

### 2.16 `P999` sentinel plant and blank `material_id`

| | |
|---|---|
| **Old assumption** | No exclusion logic anywhere in V2 (adapter, helper, panel, doc) recognises `P999` as a sentinel/aggregate plant or filters blank `material_id`. |
| **Affected files** | (none today — that's the gap). |
| **Verified schema** | `P999` is sentinel/aggregate. Blank/null `material_id` rows exist in the subgroup view and are not eligible production candidates. |
| **Risk if unchanged** | Native route returns aggregate/sentinel rows as if they were ordinary production data; navigation/material pickers expose unusable rows. |
| **Recommended action** | Slice 4: `isEligibleSpcProductionRow(row)` excludes `plant_id === 'P999'` and blank/null `material_id`. Slice 5: tests assert exclusion. Slice 7: native-route prerequisite plan documents the filter in the future SQL. |
| **Classification** | future-runtime (Slice 4) + test-fixture (Slice 3 / Slice 5) + docs-only (Slice 7). |

### 2.17 Plant ID namespace (`P`-prefix vs `C`-prefix) is unconfirmed

| | |
|---|---|
| **Old assumption** | V2 contracts treat `plantId` as a single opaque string. No `plantIdNamespace` or `plantIdMappingStatus` field exists. |
| **Affected files** | `packages/data-contracts/src/schemas/spc-monitoring.ts` (`plantId: z.string()`); `SPCMonitoringAdapterRequest`. |
| **Verified schema** | `P`-prefix (SPC internal, e.g. `P523`) and `C`-prefix (SAP plant, e.g. `C037`) coexist. The mapping between them is **unconfirmed**. |
| **Risk if unchanged** | A user filter on a `C`-prefix plant may miss `P`-prefix rows for the same physical site, and vice versa. Cross-domain joins (e.g. POH/Trace2 use `C`-prefix) misalign without a mapping. |
| **Recommended action** | Slice 2: document plant-namespace as an open mapping question; native helper must preserve the namespace verbatim, not coerce. Slice 4: helper attaches a `plantIdNamespace` warning string (`'P-prefix'` / `'C-prefix'`) to derived points. Slice 6 (optional): introduce `plantIdNamespace` field on `SPCMonitoringContextSchema`. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + contract-change candidate (Slice 6). |

### 2.18 `spc-v2-contract-mapping.md` references unverified column names

| | |
|---|---|
| **Old assumption** | The mapping doc (Section 5 onwards) refers to `result_value`, `sample_id`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`, `effective_from`, `effective_to`, `usl`/`lsl` on locked limits, `unit_of_measure`, `process_mean`, `process_std_dev`, etc. as "Expected Column" with confidence "pending Databricks verification". |
| **Affected files** | `domain-integrations/spc/docs/spc-v2-contract-mapping.md` (all sections). |
| **Verified schema** | See Section 1 above. All "Expected Column" names that disagreed with verified DDL are now superseded. The verified column names are listed in Section 1.1–1.2 of this audit. |
| **Risk if unchanged** | Anyone reading the mapping doc as the V2 implementation reference will build mappers against the wrong column names, and tests will codify the wrong expectations. |
| **Recommended action** | Slice 2: rewrite the mapping doc so every field is classified as **directly sourced** / **derived** / **source unavailable** / **blocked** / **legacy-bridge-only** / **unknown** / **requires contract change** / **requires future native mapper**, against the verified columns. |
| **Classification** | docs-only (Slice 2). |

### 2.19 Capability calculation references `spc_capability_detail_mv`

| | |
|---|---|
| **Old assumption** | `spc-v2-contract-mapping.md` Section 10 lists `spc_capability_detail_mv` as the expected source for every capability field. |
| **Affected files** | `spc-v2-contract-mapping.md` Section 10; `spc-capability-verification.md`. |
| **Verified schema** | `spc_capability_detail_mv` NOT FOUND in UAT. |
| **Risk if unchanged** | As 2.11. |
| **Recommended action** | Slice 2: classify the entire capability section as **source unavailable**. Slice 4: `classifyCapabilitySource()` returns the unavailable status. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4). |

### 2.20 Signal source references `spc_nelson_rule_flags_mv`

| | |
|---|---|
| **Old assumption** | `spc-v2-contract-mapping.md` Sections 6 (`characteristicsAtRisk`), 11 (`hasActiveSignal`), 13 (`SPCRelatedBatch`) and 12 (`linkedBatchId`) list `spc_nelson_rule_flags_mv` as the expected source. |
| **Affected files** | `spc-v2-contract-mapping.md`; `spc-rule-signal-source-verification.md`. |
| **Verified schema** | `spc_nelson_rule_flags_mv` NOT FOUND in UAT. Signals are calculated client-side (or in the future V2 backend) from subgroup data and locked/computed limits. |
| **Risk if unchanged** | As 2.9 — defaults to "no signal" or "in control"; UX truthfulness violation. |
| **Recommended action** | Slice 2: classify all references to `spc_nelson_rule_flags_mv` as **source unavailable / calculated client-side or backend-side**. Slice 4: `classifySignalSource()` returns `calculated-not-stored` / `not-yet-evaluated`, never `in-control` from absence. Slice 5: tests cover both branches. |
| **Classification** | docs-only (Slice 2) + future-runtime (Slice 4) + test-fixture (Slice 5). |

### 2.21 Legacy adapter uses V1 wire field names (intentional, but flagged)

| | |
|---|---|
| **Old assumption** | `spc-monitoring-legacy-api-adapter.ts` references `result_value`, `sample_id`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`, `subgroup_sd`, `unit_of_measure`, `process_mean`, `process_std_dev` on V1 response shapes. |
| **Affected files** | `domain-integrations/spc/src/adapters/spc-monitoring-legacy-api-adapter.ts` (lines 32–70, 240–270, 309–315). |
| **Verified schema** | These are the V1 *FastAPI response* field names, not Databricks column names. The V1 backend transforms Databricks columns into these names; V2's legacy bridge consumes V1's transformation. |
| **Risk if unchanged** | None for the legacy bridge — these names describe the wire format V1 already returns. The risk is that someone reads the legacy adapter and concludes these are the Databricks column names. |
| **Recommended action** | Slice 2: document the legacy adapter's V1 field names as **legacy-bridge-only** (not introduced into the future native route). No code change. Slice 4: native helper uses verified Databricks column names; the two surfaces remain distinct. Add a brief comment to the legacy adapter in Slice 4 (docs-only) to flag the boundary if helpful. |
| **Classification** | legacy-bridge-only-keep. No contract change. |

### 2.22 FastAPI proxy `apps/api/routes/spc.py`

| | |
|---|---|
| **Old assumption** | The proxy forwards to V1 endpoints (`/api/spc/materials`, `/plants`, `/characteristics`, `/capability`, `/chart-data`) and gates `databricks-api` mode with a 503. |
| **Affected files** | `apps/api/routes/spc.py`. |
| **Verified schema** | The proxy is a legacy bridge to V1. Native route is intentionally not implemented. |
| **Risk if unchanged** | None — this is the desired state for this tranche. The 503 gate must be preserved until the native route is approved. |
| **Recommended action** | Slice 7 (docs only): proposed future `POST /api/spc/chart-data` shape is documented in the prerequisite plan; no route is added in this tranche. Slice 1 (this audit): explicitly call out that no proxy route is modified. |
| **Classification** | future-runtime (deferred). No change in this tranche. |

### 2.23 Mock data still drives every panel

| | |
|---|---|
| **Old assumption** | `spc-monitoring-mock-data.ts` provides realistic-looking mock data for every contract field including `unit_of_measure`, `subgroup_mean`, `subgroup_range`, capability values, alarm history rows, and related-batches with release statuses. |
| **Affected files** | `domain-integrations/spc/src/adapters/spc-monitoring-mock-data.ts`; mock-adapter tests. |
| **Verified schema** | Mock is mock — it is allowed to populate any field. The risk is that mock-shaped expectations are confused with native source-of-truth. |
| **Risk if unchanged** | None to functionality. The risk is documentational: future native tests may copy mock-shaped fixtures and accidentally encode mock-only fields as verified. |
| **Recommended action** | Slice 3: add **verified-Databricks-shaped** fixtures in a separate file (`fixtures/verified-databricks-spc.ts`) labelled clearly as PR #65-derived. Do not delete or modify the mock data. Slice 5: tests for the native mapper use the verified fixtures, not the mock data. |
| **Classification** | test-fixture (Slice 3 / Slice 5). |

### 2.24 Native migration readiness checklist references missing MVs

| | |
|---|---|
| **Old assumption** | `spc-native-migration-readiness-checklist.md` sections 9 and 8 list `spc_capability_detail_mv` and `spc_nelson_rule_flags_mv` as objects that must exist before native readiness. |
| **Affected files** | `domain-integrations/spc/docs/spc-native-migration-readiness-checklist.md` (lines 43, 66, 85, 150, etc.). |
| **Verified schema** | Both MVs are NOT FOUND in UAT. The checklist already reflects this (e.g. line 66 has a `[!]` marker), but the "Go" criteria still imply these objects must exist for native readiness. |
| **Risk if unchanged** | Native route remains blocked indefinitely on objects that are not deployed in UAT, even though the verified `spc_quality_metric_subgroup_mv` is sufficient for a chart-data route (with backend-side signal calculation and capability deferred). |
| **Recommended action** | Slice 8: update the checklist so the "Go" criteria for a *minimum* native chart-data route do NOT require capability or stored signals — those are deferred items. The checklist still gates approved-limit display on additional locked-limit rows, signal calculation on a backend implementation decision, and capability on either an MV redeployment or a backend calculation. |
| **Classification** | docs-only (Slice 8). |

### 2.25 Readiness docs claim "spc_quality_metric_subgroup_v" rather than `_mv`

| | |
|---|---|
| **Old assumption** | Several docs (`spc-known-limitations.md`, `spc-native-migration-readiness-checklist.md`, `spc-v2-contract-mapping.md`) refer to `spc_quality_metric_subgroup_v` (the view) as the preferred source. |
| **Affected files** | Multiple docs (see list above). |
| **Verified schema** | The `_mv` materialised variant (`spc_quality_metric_subgroup_mv`, ~73M rows) is the preferred chart/subgroup source for performance; the `_v` view is the underlying SQL. |
| **Risk if unchanged** | A future native mapper that queries the underlying `_v` view will materialise the SQL on every chart query, hitting a much larger query cost. |
| **Recommended action** | Slice 2 and Slice 7: pin the native source to `spc_quality_metric_subgroup_mv`. Slice 8: update readiness docs to prefer `_mv`. |
| **Classification** | docs-only (Slice 2 + Slice 7 + Slice 8). |

---

## 3. Cross-cutting risks (summary)

| Risk | Where it lives today | Mitigation slice |
|------|----------------------|------------------|
| Native mapper builds on V1 wire field names | mapping doc, ad-hoc reading of legacy adapter | Slice 2 + Slice 4 |
| Chart-point grain confusion (measurement vs batch) | contract shape, mock data, mapping doc | Slice 2 + Slice 4 + Slice 5 + Slice 6 (optional) |
| `unit_of_measure` claimed but not in source | Zod contract, mapping doc | Slice 2 + Slice 4 + Slice 6 (optional) |
| `baseline_from`/`baseline_to` vs `effective_from`/`effective_to` | mapping doc, Zod field naming | Slice 2 + Slice 4 |
| `usl`/`lsl` on locked limits (false expectation) | mapping doc | Slice 2 + Slice 4 |
| `operation_id` confused with `workCentreId` | adapter request, context schema | Slice 2 + Slice 4 + Slice 6 (optional) |
| Capability source absent | contract requires Cp/Cpk/Pp/Ppk/mean/sd/interpretation | Slice 2 + Slice 4 + Slice 6 (recommended) |
| Stored signal source absent — risk of "in control" from absence | `ControlChartPoint.status` default, `hasActiveSignal` | Slice 2 + Slice 4 + Slice 5 |
| UAT-only locked-limit row treated as approved | `LimitProvenance`/`ApprovalState` enums | Slice 2 + Slice 4 + Slice 6 (optional) |
| `P999` sentinel and blank-material rows surfaced | no exclusion logic anywhere | Slice 4 + Slice 5 + Slice 7 |
| `P`/`C` plant namespace ambiguity | contracts treat plantId as opaque | Slice 2 + Slice 4 + Slice 6 (optional) |
| Alarm history has no source | full schema with required fields | Slice 2 + Slice 8 (defer panel) |
| Related-batches release status / impact | enum requires release vocabulary | Slice 2 + Slice 8 |

---

## 4. Out of scope for this tranche

These targets are deliberately **not** addressed:

- **Live runtime wiring of a native SPC Databricks route.** `apps/api/routes/spc.py`
  is not modified beyond zero changes; no new FastAPI route is added; the
  Databricks adapter remains `unavailable`.
- **SAP QM write-back, e-signature, GxP audit trail.** Permanent out of scope.
- **Service-principal Databricks reads.** Permanent out of scope per
  `AGENTS.md` / `CLAUDE.md` Databricks data-access security rules.
- **App-side plant authorization.** Out of scope.
- **Backend-side capability calculation (Cp/Cpk/Pp/Ppk).** Documented as a
  future option in Slice 7; no algorithm is implemented in this tranche.
- **Backend-side signal calculation algorithm.** The pure
  `calculations.runtime.ts` exists today on the frontend; lifting it
  server-side is documented in Slice 7 as a future option, not implemented.
- **`workCentreId` ← `operation_id` mapping.** Deliberately rejected; would
  require Kerry governance approval (operation_id is a sequential inspection
  identifier, not a SAP work centre).

---

## 5. Confirmations

- No native SPC Databricks route was added in this slice.
- No live Databricks runtime wiring was added in this slice.
- No Databricks columns were invented — all column references come from
  PR #65 verified evidence.
- No fake golden candidates were introduced.
- Old V1 field names (`result_value`, `sample_id`, `sample_timestamp`,
  `subgroup_mean`, `subgroup_range`, `subgroup_sd`, `unit_of_measure`) were
  not treated as verified Databricks schema. They are documented as V1
  wire-format names that the legacy bridge consumes from the V1 FastAPI
  backend.
- No sample IDs were invented in this slice.
- Control limits were kept separate from specification limits throughout.
- `locked_by` was not treated as full governed approval; it is documented
  as lock provenance only.
- No signal source was invented — `spc_nelson_rule_flags_mv` remains NOT
  FOUND and is documented as such.
- No capability values were invented — `spc_capability_detail_mv` remains
  NOT FOUND and is documented as such.
- "No signals returned" is explicitly NOT treated as "in control"; see 2.9.
- `operation_id` was not treated as SAP work centre; see 2.1, 2.2.
- `P999` was identified as a sentinel/aggregate plant; future exclusion is
  scheduled for Slice 4 (not implemented in this slice).
- No SPC decision authority was added.
- No SAP QM write-back was added.
- No e-signature / GxP workflow was added.
- No production SPC readiness was claimed.
- No service-principal fallback was added.
- No app-side plant authorization was added.

---

## 6. Pointers to follow-on slices

| Slice | Deliverable | Targets identified by this audit |
|-------|-------------|----------------------------------|
| 2 | Rewrite of [`spc-v2-contract-mapping.md`](./spc-v2-contract-mapping.md) | 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13, 2.14, 2.17, 2.18, 2.19, 2.20, 2.21, 2.25 |
| 3 | Verified Databricks fixtures (`fixtures/verified-databricks-spc.ts`) | 2.7, 2.16, 2.23 + golden candidates from PR #65 |
| 4 | Pure helpers (`utils/native-databricks-mapping.ts`) | 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.11, 2.14, 2.16, 2.17, 2.19, 2.20 |
| 5 | Mapper tests | 2.7, 2.8, 2.9, 2.11, 2.16, 2.17, 2.20 (and field-name reintroduction guards for 2.18, 2.21) |
| 6 | Optional contract refinement | 2.1, 2.2, 2.3, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.17 — only if Slice 4 cannot represent the source honestly otherwise |
| 7 | Native route prerequisite plan (`spc-native-route-prerequisite-plan.md`) | 2.16, 2.22, 2.25 + go/no-go criteria informed by 2.24 |
| 8 | Readiness sync | 2.12, 2.13, 2.24, 2.25 + UX truthfulness wording |
