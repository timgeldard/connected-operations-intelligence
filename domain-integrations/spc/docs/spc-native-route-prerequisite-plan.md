# SPC Native Route — Prerequisite Plan

**Date:** 2026-05-22 (updated; original plan 2026-05-21)
**Branch:** `feature/spc-native-contract-alignment`
**Predecessor evidence:** PR #65 — Databricks verification pack (commits `f641a8d`, `50c8b9a`)
**Companion docs:**
[`spc-native-contract-alignment-audit.md`](./spc-native-contract-alignment-audit.md),
[`spc-v2-contract-mapping.md`](./spc-v2-contract-mapping.md),
[`spc-databricks-verification-results-summary.md`](./spc-databricks-verification-results-summary.md),
[`spc-native-migration-readiness-checklist.md`](./spc-native-migration-readiness-checklist.md)

**Status (2026-05-22): Slice 1 native subgroup route IMPLEMENTED.**
`GET /api/spc/subgroups` is now live in `apps/api/routes/spc.py` (databricks-api mode only).
See implementation notes below.

> **Implementation notes (slice 1, 2026-05-22):**
>
> - Route: `GET /api/spc/subgroups` (not `POST /api/spc/chart-data` as originally proposed;
>   a narrow GET with all required filters is safer for the first slice)
> - Source: `spc_quality_metric_subgroup_mv` (UAT columns confirmed 2026-05-22)
> - Response model: `SPCSubgroupResponse` (new narrow Zod schema — not `ControlChartSeries`)
> - **Capability: unavailable.** `capabilityAvailable: false` (Literal[False]) — Cp/Cpk/Pp/Ppk
>   not in source MV; `spc_capability_detail_mv` absent in UAT.
> - **Nelson stored flags: unavailable.** `nelsonStoredFlagsAvailable: false` (Literal[False]) —
>   `spc_nelson_rule_flags_mv` absent in UAT.
> - **Signals: client-side only.** `signalsClientSideOnly: true` (Literal[True]) — no stored
>   signal rows; frontend must calculate Nelson rule violations.
> - **Locked limits: deferred to slice 2.** `lockedLimits: null` always — `spc_locked_limits`
>   DESCRIBE TABLE not confirmed; wiring deferred.
> - **Browser UAT: pending.** Route is live in code but no end-to-end browser test has been run
>   against UAT Databricks with the V2 frontend. Cannot claim UAT or production readiness.
> - **Production readiness: blocked.** Same gates as before apply.
> - Frontend wire-up: **not done**. `SPCMonitoringDatabricksApiAdapter.getControlChartSeries`
>   requires `unitOfMeasure` and `ControlChartPoint.status` which the new narrow schema does not
>   provide. Frontend wire-up is deferred to slice 3.
> - All 87 backend tests pass (adapter + route tests, including validation hardening from PR #75
>   review). Pre-existing architecture guardrail failure in `trace2_databricks_adapter.py` is unrelated.
> - **Verified candidate operation IDs (spc-databricks-verification-results-summary.md, 2026-05-22):**
>   pH candidate: 20642328 / P523 / mic 0010 / **operation_id 00000004** (not 00000001 as initially
>   transcribed); Salt candidate: 20047111 / C037 / mic 0060 / operation_id 00000001.
> - **Point1 artefact:** `SPCSubgroupResponse.points` uses a generated `Point1` class rather than
>   `SPCSubgroupPoint` because `export-json-schema.ts` processes schemas in isolation and emits array
>   item definitions inline rather than as `$ref`. Runtime validation is unaffected (structurally
>   identical). Fixing the cross-ref would require changing the export script and is deferred.
> - **Validation hardening (PR #75 review):** blank filter strings → 422; invalid date format → 422;
>   date_from > date_to → 422; date window > 730 days → 422 (guard against broad MV scans).
>
> This plan's proposed `POST /spc/chart-data` full response shape (§3) is deferred to a
> future slice once locked limits are confirmed and the frontend adapter can be wired.

---

## 1. Route shape — proposal

| Aspect | Proposed value |
|---|---|
| Method + path | `POST /api/spc/chart-data` |
| Backend mode | `BACKEND_ADAPTER_MODE=databricks-api` only (`legacy-api` continues to use the existing V1 proxy in `apps/api/routes/spc.py`) |
| Auth | End-user OAuth identity via `x-forwarded-access-token`; **no service-principal fallback** (per `AGENTS.md` Databricks data-access security rules) |
| Source object | `connected_plant_uat.gold.spc_quality_metric_subgroup_mv` (preferred; ~73M rows) and `connected_plant_uat.gold.spc_locked_limits` |
| Source format | Databricks SQL via the Databricks SQL Statement Execution API (warehouse `connected_plant_uat`) — same pattern used by traceability/POH native routes |
| Response media type | `application/json` |
| Source header | Response carries `X-Data-Source: databricks-api` |
| Failure semantics | 401 OAuth missing; 403 OAuth lacks Unity Catalog grant; 429 rate limit; 502 query/source error; 503 mode/config; 504 timeout — **no silent fallback to mock or legacy** |

This is the **only** route this plan introduces. Other SPC endpoints (`/api/spc/materials`, `/api/spc/plants`, `/api/spc/characteristics`, `/api/spc/capability`) remain on the existing V1 proxy.

---

## 2. Request model

A Pydantic body model on the route, mirroring `SPCMonitoringAdapterRequest`
plus optional date/limit filters. The request-side Zod schema is the
follow-up tranche's responsibility (Slice 6 introduced `operationId` on the
**response-side** `SPCMonitoringContextSchema`; the **request-side** request
schema lives in `packages/data-contracts/src/schemas/adapter-requests.ts`
today and would gain a matching addition there).

```python
class SpcChartDataRequest(BaseModel):
    material_id: str = Field(..., alias='materialId')
    plant_id: str = Field(..., alias='plantId')
    mic_id: str = Field(..., alias='micId')
    operation_id: str | None = Field(None, alias='operationId')
    chart_type: Literal[
        'xbar-r', 'xbar-s', 'individuals', 'p-chart', 'np-chart',
        'c-chart', 'u-chart', 'ewma', 'cusum',
    ] | None = Field(None, alias='chartType')
    date_from: str | None = Field(None, alias='dateFrom')
    date_to: str | None = Field(None, alias='dateTo')
    max_rows: int | None = Field(None, alias='maxRows', ge=1, le=200_000)
```

Required: `material_id`, `plant_id`, `mic_id`. Optional: `operation_id` (sequential identifier, NOT SAP work centre — preserved per the audit and §5 of the mapping doc), `chart_type`, `date_from`, `date_to`, `max_rows`.

`work_centre_id` does **not** appear on the request. The native route must never alias it to `operation_id` — that aliasing exists on the legacy bridge only and is documented as legacy-bridge-only.

---

## 3. Response model

The response carries a single `ControlChartSeries` plus a structured
`warnings` array and an explicit set of `status` enums per response area, so
the UI can distinguish "data loaded" from "calculation pending" from
"source unavailable" without inferring.

```python
class SpcChartLimitsBlock(BaseModel):
    center_line: float | None = Field(None, alias='centerLine')
    upper_control_limit: float | None = Field(None, alias='upperControlLimit')
    lower_control_limit: float | None = Field(None, alias='lowerControlLimit')
    upper_control_limit_range: float | None = Field(None, alias='uclR')
    lower_control_limit_range: float | None = Field(None, alias='lclR')
    sigma_within: float | None = Field(None, alias='sigmaWithin')
    limit_provenance: Literal[
        'mock-fixture', 'calculated-from-sample', 'unknown'
    ] = Field(..., alias='limitProvenance')
    approval_state: Literal[
        'not-approved', 'pending-validation', 'unavailable'
    ] = Field(..., alias='approvalState')
    locked_limits: bool = Field(..., alias='lockedLimits')
    locked_from: str | None = Field(None, alias='lockedFrom')
    locked_to: str | None = Field(None, alias='lockedTo')
    locked_by: str | None = Field(None, alias='lockedBy')
    locked_at: str | None = Field(None, alias='lockedAt')
    locking_note: str | None = Field(None, alias='lockingNote')

class SpcSpecLimitsBlock(BaseModel):
    upper_spec_limit: float | None = Field(None, alias='upperSpecLimit')
    lower_spec_limit: float | None = Field(None, alias='lowerSpecLimit')
    nominal_target: float | None = Field(None, alias='nominalTarget')
    tolerance_half_width: float | None = Field(None, alias='toleranceHalfWidth')
    raw_tolerance: float | None = Field(None, alias='rawTolerance')
    spec_signature: str | None = Field(None, alias='specSignature')
    spec_type: str | None = Field(None, alias='specType')
    source_status: Literal[
        'present', 'not-populated-zero-zero', 'lower-only', 'upper-only', 'unavailable'
    ] = Field(..., alias='sourceStatus')

class SpcChartPoint(BaseModel):
    point_id: str = Field(..., alias='pointId')
    batch_id: str = Field(..., alias='batchId')
    batch_date: str = Field(..., alias='batchDate')
    first_posting_date: str | None = Field(None, alias='firstPostingDate')
    last_posting_date: str | None = Field(None, alias='lastPostingDate')
    subgroup_mean: float | None = Field(None, alias='subgroupMean')
    subgroup_range: float = Field(..., alias='subgroupRange')
    subgroup_std_dev: float | None = Field(None, alias='subgroupStdDev')
    sample_count: int = Field(..., alias='sampleCount', ge=0)
    source_row_count: int = Field(..., alias='sourceRowCount', ge=0)
    min_value: float = Field(..., alias='minValue')
    max_value: float = Field(..., alias='maxValue')
    individual_values: list[float] = Field(..., alias='individualValues')
    any_rejection: bool = Field(..., alias='anyRejection')
    any_acceptance: bool = Field(..., alias='anyAcceptance')
    warnings: list[str] = Field(default_factory=list)

class SpcChartDataResponse(BaseModel):
    chart_series: SpcChartPoint = ...  # array, one point per batch
    control_limits: SpcChartLimitsBlock = Field(..., alias='controlLimits')
    spec_limits: SpcSpecLimitsBlock = Field(..., alias='specLimits')
    signals_source: Literal[
        'calculated-frontend', 'calculated-backend', 'not-yet-evaluated', 'unavailable'
    ] = Field(..., alias='signalsSource')
    capability_source: Literal[
        'present-from-mv', 'backend-calculation-required', 'legacy-bridge', 'unavailable'
    ] = Field(..., alias='capabilitySource')
    excluded_row_count: int = Field(..., alias='excludedRowCount', ge=0)
    excluded_reasons: list[
        Literal['sentinel-plant-p999', 'blank-material-id']
    ] = Field(default_factory=list, alias='excludedReasons')
    warnings: list[str] = Field(default_factory=list)
    queried_at: str = Field(..., alias='queriedAt')
    source_data_as_of: str | None = Field(None, alias='sourceDataAsOf')
```

The response shape **never** emits `limit_provenance: 'imported-from-approved-source'` and **never** emits `approval_state: 'approved'`. Those values are reserved for a future governed-approval workflow that does not exist today.

The response shape **never** emits a `'in-control'` chart-point status. Rule detection runs separately (frontend or backend); `signals_source` reflects where it would run if asked.

The response shape **never** emits Cp/Cpk/Pp/Ppk numeric values. Capability is delivered (when authorised) by `GET /api/spc/capability` — that route stays on the legacy bridge until a separate governance decision is made; this route never returns synthesised capability.

---

## 4. Required source objects (verified by PR #65)

| Object | Required? | Purpose | Verified by PR #65? |
|---|---|---|---|
| `spc_quality_metric_subgroup_mv` | required | Chart points; spec limits; normality/accept/reject metadata | yes (~73M rows) |
| `spc_locked_limits` | optional (key match) | Control limits when a lock row exists | yes (1 UAT row) |
| `spc_capability_detail_mv` | **NOT required by this route** | Capability — served by separate route | **NOT FOUND** |
| `spc_nelson_rule_flags_mv` | **NOT required by this route** | Signals are calculated; never stored | **NOT FOUND** |
| `spc_characteristic_dim_mv` | optional | MIC name lookup (also available on subgroup row) | yes (~3M rows) |
| `spc_material_dim_mv` | optional | Material name lookup | yes (~138k rows) |
| `spc_plant_material_dim_mv` | optional | Plant-per-material navigation (out of scope for this route) | yes (~87k rows) |

This route MUST NOT block on the two NOT FOUND MVs.

---

## 5. Required filters

The native query applies these filters **before** grouping:

| Filter | SQL fragment | Source |
|---|---|---|
| Material | `material_id = :material_id` | request |
| Plant | `plant_id = :plant_id` | request |
| MIC | `mic_id = :mic_id` | request |
| Operation | `operation_id = :operation_id` (if provided) | request |
| Date window from | `batch_date >= :date_from` (if provided) | request |
| Date window to | `batch_date <= :date_to` (if provided) | request |
| Row cap | `LIMIT :max_rows` (server-side default + cap) | request |

`work_centre_id` is **never** passed into the SQL.

---

## 6. Required exclusions

Applied as part of the WHERE clause, before grouping:

| Exclusion | SQL fragment |
|---|---|
| Sentinel plant | `plant_id <> 'P999'` |
| Blank material | `material_id IS NOT NULL AND TRIM(material_id) <> ''` |

Excluded rows are counted in `excluded_row_count` with reasons in
`excluded_reasons` so the UI can show "N rows hidden as sentinel" without
losing source-truthfulness.

---

## 7. Required aggregations — per-batch grouping

```sql
SELECT
  material_id,
  plant_id,
  mic_id,
  operation_id,
  batch_id,
  MAX(batch_date)             AS batch_date,
  MAX(first_posting_date)     AS first_posting_date,
  MAX(last_posting_date)      AS last_posting_date,
  MAX(batch_n)                AS batch_n,
  MAX(sum_value)              AS sum_value,
  MAX(sum_squares)            AS sum_squares,
  MIN(min_value)              AS min_value,
  MAX(max_value)              AS max_value,
  MAX(batch_range)            AS batch_range,
  MAX(any_rejection)          AS any_rejection,
  MAX(any_acceptance)         AS any_acceptance,
  MAX(usl_spec)               AS usl_spec,
  MAX(lsl_spec)               AS lsl_spec,
  MAX(nominal_target)         AS nominal_target,
  MAX(tolerance_half_width)   AS tolerance_half_width,
  MAX(raw_tolerance)          AS raw_tolerance,
  MAX(spec_signature)         AS spec_signature,
  MAX(spec_type)              AS spec_type,
  MAX(normality_type)         AS normality_type,
  MAX(normality_method)       AS normality_method,
  MAX(normality_signature)    AS normality_signature,
  MAX(unified_mic_key)        AS unified_mic_key,
  ARRAY_AGG(value)            AS individual_values,
  COUNT(*)                    AS source_row_count
FROM connected_plant_uat.gold.spc_quality_metric_subgroup_mv
WHERE
  material_id = :material_id
  AND plant_id = :plant_id
  AND mic_id   = :mic_id
  AND (:operation_id IS NULL OR operation_id = :operation_id)
  AND (:date_from   IS NULL OR batch_date   >= :date_from)
  AND (:date_to     IS NULL OR batch_date   <= :date_to)
  AND plant_id <> 'P999'
  AND material_id IS NOT NULL
  AND TRIM(material_id) <> ''
GROUP BY material_id, plant_id, mic_id, operation_id, batch_id
ORDER BY batch_date ASC, batch_id ASC
LIMIT :max_rows;
```

**Derivations applied to each grouped row** (in the backend, mirroring the Slice 4 helpers):

| V2 field | Derivation |
|---|---|
| `subgroupMean` | `sum_value / batch_n` (null when `batch_n = 0`) |
| `subgroupRange` | `batch_range` (verified column, NOT max - min) |
| `subgroupStdDev` | `sqrt((sum_squares - sum_value² / batch_n) / (batch_n - 1))` when `batch_n >= 2`; else null |
| `sampleCount` | `batch_n` |
| `sourceRowCount` | `COUNT(*)` (warn when `≠ batch_n`) |

The native SQL performs the row reduction in-warehouse; the helpers in
`utils/native-databricks-mapping.ts` are an exact mirror used for backend
unit testing and for any cases where rows arrive un-aggregated.

---

## 8. Control-limit handling

A separate query against `spc_locked_limits`:

```sql
SELECT cl, ucl, lcl, ucl_r, lcl_r, sigma_within,
       locked_by, locked_at, baseline_from, baseline_to, locking_note,
       mic_origin, unified_mic_key, spec_signature, chart_type
FROM connected_plant_uat.gold.spc_locked_limits
WHERE material_id = :material_id
  AND plant_id    = :plant_id
  AND mic_id      = :mic_id
  AND (:operation_id IS NULL OR operation_id = :operation_id)
  AND chart_type  = :resolved_chart_type
LIMIT 1;
```

**Provenance derivation** (mirrors `mapLockedLimitRow`):

| Source condition | `limit_provenance` | `approval_state` | `locked_limits` |
|---|---|---|---|
| No row matched | `calculated-from-sample` (if computed) or `unknown` | `not-approved` (computed) or `unavailable` | `false` |
| Row matched, `baseline_from/to` and `locking_note` all empty | `calculated-from-sample` + warning | `pending-validation` + warning "UAT fixture only" | `true` |
| Row matched, `baseline_from/to` set, no governed approval workflow | `calculated-from-sample` + warning | `pending-validation` + warning "approval not governed" | `true` |

`limit_provenance: 'imported-from-approved-source'` and `approval_state: 'approved'` are **never** emitted in this phase.

When no lock row matches and the route opts to compute limits from sample
statistics, the computation uses AIAG factors (D2/A2/A3) — the same algorithm
as the existing frontend `calculations.runtime.ts`. The computed values are
populated into the limits block with `limit_provenance: 'calculated-from-sample'`.

---

## 9. Spec-limit handling

Spec limits are read **from the subgroup view** (`usl_spec`, `lsl_spec`),
NOT from `spc_locked_limits`. Per `deriveSpecificationLimits`:

| Source condition | `source_status` | `upper_spec_limit` | `lower_spec_limit` |
|---|---|---|---|
| Both populated, both non-zero | `present` | populated | populated |
| Both zero | `not-populated-zero-zero` + warning | `null` | `null` |
| One side populated | `upper-only` / `lower-only` + warning | populated or null | null or populated |
| Both missing | `unavailable` + warning | `null` | `null` |

`nominal_target`, `tolerance_half_width`, `raw_tolerance`, `spec_signature`,
`spec_type` are surfaced verbatim from the grouped row.

The route MUST NOT emit a `[0, 0]` spec band as a real limit.

---

## 10. Signal calculation plan

This route does **not** compute signals. It populates `signals_source` so
the caller knows where (and whether) signals will be evaluated.

| Render-time condition | `signals_source` value |
|---|---|
| Chart data not yet loaded | `unavailable` |
| Chart data loaded but rule detection has not run | `not-yet-evaluated` |
| Rule detection runs in the V2 frontend (today's behaviour) | `calculated-frontend` |
| Rule detection lifted to the V2 backend (future option) | `calculated-backend` |

`signals_source` is computed by the backend from request/response context;
the actual rule-detection code path is **out of scope** for this route. A
future PR may add a parallel `POST /api/spc/signals` route, or fold signal
detection into this route as `calculated-backend` — both are extensions, not
prerequisites.

The route MUST NOT emit `'in-control'` or any other process-control claim as
`signals_source`.

---

## 11. Capability handling plan

This route does **not** compute or return capability indices. `capability_source`
is set per the helper:

| Condition | `capability_source` |
|---|---|
| `spc_capability_detail_mv` is FOUND | `present-from-mv` (and caller should hit the dedicated capability route) |
| MV NOT FOUND, subgroup data available, backend calc explicitly authorised | `backend-calculation-required` |
| MV NOT FOUND, V1 legacy bridge reachable | `legacy-bridge` |
| Otherwise | `unavailable` |

The route MUST NOT emit synthesised Cp/Cpk/Pp/Ppk values, and MUST NOT carry
those fields on its response shape at all.

---

## 12. Candidate test matrix

Backend tests for the future implementation should cover the following
candidates (PR #65 evidence):

| # | Candidate | Material | Plant | MIC | Operation | Notes |
|---|---|---|---|---|---|---|
| 1 | Primary locked-limit (Salt) | 20047111 | C037 | 0060 | 00000001 | 271 batches in UAT; 1 locked-limit row (`uat-fixture-only`); spec limits NOT populated (0/0). |
| 2 | Data-rich pH | 20642328 | P523 | 0010 | 00000004 | ~60,673 batches in UAT; **no** locked limits; spec limits populated (7.2/7.8). |
| 3 | Multi-MIC (P775) | 20372893 | P775 | 0030–0070 | 00000001 | ~42k batches per MIC; **no** locked limits; multi-MIC navigation. |
| 4 | Sentinel exclusion | — | P999 | — | — | Must be excluded; `excluded_reasons` carries `'sentinel-plant-p999'`. |
| 5 | Blank-material exclusion | (blank) | (any) | (any) | (any) | Must be excluded; `excluded_reasons` carries `'blank-material-id'`. |
| 6 | C-prefix vs P-prefix overlap | (TBD) | both | (any) | (any) | Cross-namespace warning if observed; both rows preserved with their plant_id verbatim. |
| 7 | OAuth missing | — | — | — | — | 401 returned; **no** mock fallback. |
| 8 | UC grant missing | — | — | — | — | 403 returned. |
| 9 | Warehouse unavailable | — | — | — | — | 502/503/504 per cause; no fallback. |

---

## 13. Required tests (backend)

Mirroring the Slice 5 mapper tests but at the route level. All tests run
against a Databricks SQL mock that returns canned subgroup + locked-limits
rows; **none** call live Databricks during CI.

| Test area | Asserts |
|---|---|
| Routing + auth | mode-gated to `databricks-api`; `X-Data-Source` header; `x-forwarded-access-token` forwarding; 401/403/429/502/503/504 codes returned without fallback |
| Query shape | filters and exclusions appear in the executed SQL (`plant_id <> 'P999'`, `TRIM(material_id) <> ''`, `:material_id`, etc.); request-side `workCentreId` is rejected at the schema layer |
| Aggregation | one response point per `(material_id, plant_id, mic_id, operation_id, batch_id)` group; ordering by `batch_date, batch_id`; `subgroupMean`/`subgroupRange`/`subgroupStdDev` derivations match helper outputs |
| Eligibility | `excluded_row_count` and `excluded_reasons` populated correctly for sentinel and blank-material rows |
| Control limits | candidate 1 emits `lockedLimits: true` + `pending-validation` + `uat-fixture-only` warning; candidate 2 emits `lockedLimits: false` and computed values |
| Spec limits | candidate 1 emits `not-populated-zero-zero`; candidate 2 emits populated 7.2/7.8 with metadata |
| Signal source | response always populates `signals_source`; never `'in-control'`; default `calculated-frontend`; `calculated-backend` if backend rule detection is wired |
| Capability source | response always populates `capability_source`; never carries Cp/Cpk fields; `unavailable` when MV missing and no backend calc authorised |
| Provenance ceiling | `limit_provenance: 'imported-from-approved-source'` and `approval_state: 'approved'` are **never** present in the response under any test |
| Field-name guard | no `result_value`, `sample_id`, `sample_timestamp`, `subgroup_mean` (snake_case), `subgroup_range` (snake_case), `subgroup_sd`, `unit_of_measure` appear anywhere in the response payload (snake-case input columns are aggregated/renamed before serialisation) |

---

## 14. Go / no-go checklist

Implementation of this route is **gated** on the following items. Each
must be evidenced; "documented" without evidence is not enough.

### 14.1 Must be true before this route is implemented

- [ ] **Native-mode FastAPI infrastructure is reusable.** Confirm by reading
      one existing native route (e.g. `apps/api/routes/trace2_native.py` or
      the POH equivalent) and confirming this route can follow the same
      pattern (QueryExecutor / mode gate / OAuth forwarding).
- [ ] **Pydantic models on `apps/api/contracts/generated.py` cover the
      response shape** OR a Pydantic-only model is added in the route file
      while the Zod schema catches up. Decision recorded before coding.
- [ ] **Mock for the Databricks SQL Statement Execution API is available**
      so backend tests can run in CI without warehouse access.
- [ ] **UAT Databricks warehouse is reachable** from the V2 Databricks Apps
      deployment with the end-user's OAuth identity.
- [ ] **A reviewer / pair has confirmed** that no other native SPC route is
      being added in parallel that would conflict.

### 14.2 Must be true before this route can be marked "browser-UAT-pending"

- [ ] All backend tests above pass.
- [ ] A frontend adapter (in `domain-integrations/spc/src/adapters/`) consumes
      the route and emits `source: 'databricks-api'` on success.
- [ ] The Control Chart panel renders `controlLimits` / `specLimits` / signals
      / capability blocks with the correct disclaimers per
      [`spc-known-limitations.md`](./spc-known-limitations.md) and the UX
      truthfulness checklist.
- [ ] A live UAT smoke test against candidate 1 (Salt, 20047111/C037/0060)
      successfully returns batches with the locked-limit warnings visible.
- [ ] A live UAT smoke test against candidate 2 (pH, 20642328/P523/0010)
      returns batches with populated spec limits and no spurious control
      limits.

### 14.3 Must NOT be relaxed under any circumstance

- [ ] Native route MUST NOT silently fall back to mock or legacy data.
- [ ] Service-principal Databricks reads MUST NOT be introduced.
- [ ] Native route MUST NOT emit `limit_provenance: 'imported-from-approved-source'`
      or `approval_state: 'approved'` in this phase.
- [ ] Native route MUST NOT emit `signals_source: 'in-control'` or any
      equivalent claim under any branch.
- [ ] Native route MUST NOT carry Cp/Cpk/Pp/Ppk fields on its response shape.
- [ ] Native route MUST NOT alias `operation_id` to `work_centre_id`.
- [ ] Native route MUST NOT surface `P999` rows or blank-material rows in
      production chart data.

---

## 15. Out of scope (deferred to other tranches / future PRs)

- **Cross-domain join to QM usage decision / batch release status** — the
  related-batches panel still maps to QM UD's lot-selection rule (TRACE-P1-012);
  separate governance.
- **SAP QM write-back / e-signature / GxP workflow** — permanent out of scope
  per `AGENTS.md`.
- **App-side plant authorization** — out of scope per the Databricks
  data-access security rules.
- **`SPCAlarmHistoryItem` native sourcing** — no source exists; mock-only or
  deferred panel decision is recorded in Slice 8 readiness sync.
- **Backend-side rule detection algorithm** — possible; not authorised here.
  The `signals_source: 'calculated-backend'` value is reserved.
- **Backend-side capability calculation algorithm** — possible; not authorised
  here. The `capability_source: 'backend-calculation-required'` value is
  reserved. Algorithm governance with Kerry QM process owner is the
  pre-condition.
- **Plant-namespace mapping (`P`/`C` prefix)** — governance with the Kerry
  data-platform team is the pre-condition. The route exposes the warning;
  it does not invent a mapping.

---

## 16. Confirmations

- This document does NOT modify any runtime code.
- It does NOT add a native FastAPI SPC route.
- It does NOT change the existing legacy proxy at `apps/api/routes/spc.py`.
- The proposed response shape NEVER emits `'in-control'`, `approved`,
  `imported-from-approved-source`, or invented Cp/Cpk values.
- `operation_id` is preserved on the request; `work_centre_id` is rejected
  at the request schema layer.
- `P999` exclusion and blank-material exclusion are enforced before grouping.
- The two NOT FOUND MVs (`spc_capability_detail_mv`, `spc_nelson_rule_flags_mv`)
  are **not** required by this route.
- No SAP QM write-back, no e-signature, no GxP workflow, no service-principal
  fallback, no app-side plant authorization is proposed.
- No production SPC readiness is claimed.
