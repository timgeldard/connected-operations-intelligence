# EnvMon Swab Results Contract Alignment Analysis

**Date:** 2026-05-22
**Branch:** `feature/envmon-swab-contract-alignment`
**Status:** **COMPLETE** — all 5 slices implemented and pushed 2026-05-22
**Relates to:** `backend-contract-enforcement-plan.md` — `/api/envmon/swab-results` skip-contract-mismatch (now resolved)

---

## Background

PR #71 (backend-contract-enforcement) added `response_model` enforcement to five safe routes.
`GET /api/envmon/swab-results` was skipped because the mapper output does not match the
generated `EnvMonSwabResult` Pydantic model. This document analyses the mismatch
and recommends a safe resolution path.

---

## What the mapper returns (`map_swab_result_rows`)

`apps/api/adapters/envmon/envmon_databricks_adapter.py` — `_map_swab_row()`

The mapper selects from three confirmed-ddl SAP QM gold views and returns one row per MIC
result per inspection point per lot. The 26 output fields are:

| Mapper field | Source column | Source view | DDL status |
|---|---|---|---|
| `inspectionLotId` | `INSPECTION_LOT_ID` | `gold_inspection_lot` | confirmed-ddl |
| `inspectionPointId` | `INSPECTION_POINT_ID` | `gold_inspection_point` | confirmed-ddl |
| `sampleId` | `SAMPLE_ID` | `gold_inspection_point` | confirmed-ddl |
| `operationId` | `OPERATION_ID` | `gold_inspection_point` | confirmed-ddl |
| `functionalLocation` | `FUNCTIONAL_LOCATION` | `gold_inspection_point` | confirmed-ddl |
| `plantId` | `PLANT_ID` | `gold_inspection_lot` | confirmed-ddl |
| `inspectionType` | `INSPECTION_TYPE` | `gold_inspection_lot` | confirmed-ddl |
| `createdDate` | `CREATED_DATE` | `gold_inspection_lot` | confirmed-ddl |
| `micName` | `MIC_NAME` | `gold_batch_quality_result_v` | confirmed-ddl |
| `quantitativeResult` | `QUANTITATIVE_RESULT` | `gold_batch_quality_result_v` | confirmed-ddl |
| `upperTolerance` | `UPPER_TOLERANCE` | `gold_batch_quality_result_v` | confirmed-ddl |
| `lowerTolerance` | `LOWER_TOLERANCE` | `gold_batch_quality_result_v` | confirmed-ddl |
| `valuation` | `INSPECTION_RESULT_VALUATION` | `gold_batch_quality_result_v` | confirmed-ddl |
| `status` | derived from `valuation` | — | derived (confirmed-v1+ddl mapping) |
| `sampleSummary` | `SAMPLE_SUMMARY` | `gold_inspection_point` | confirmed-v1 |
| `sampleHour` | `SAMPLE_HOUR` | `gold_inspection_point` | confirmed-v1 |
| `inspectionEndDate` | `INSPECTION_END_DATE` | `gold_inspection_lot` | confirmed-v1 |
| `processOrderId` | `PROCESS_ORDER_ID` | `gold_inspection_lot` | confirmed-v1 |
| `materialId` | `MATERIAL_ID` | `gold_inspection_lot` | confirmed-v1 |
| `batchId` | `BATCH_ID` | `gold_inspection_lot` | confirmed-v1 |
| `micId` | `MIC_ID` | `gold_batch_quality_result_v` | confirmed-v1 |
| `micCode` | `MIC_CODE` | `gold_batch_quality_result_v` | confirmed-v1 |
| `result` | `RESULT` | `gold_batch_quality_result_v` | confirmed-v1 |
| `qualitativeResult` | `QUALITATIVE_RESULT` | `gold_batch_quality_result_v` | confirmed-v1 |
| `targetValue` | `TARGET_VALUE` | `gold_batch_quality_result_v` | confirmed-v1 |
| `unitOfMeasure` | `UNIT_OF_MEASURE` | `gold_batch_quality_result_v` | confirmed-v1 |
| `inspector` | `INSPECTOR` | `gold_batch_quality_result_v` | confirmed-v1 |
| `inspectionMethod` | `INSPECTION_METHOD` | `gold_batch_quality_result_v` | confirmed-v1 |

---

## Existing `EnvMonSwabResultSchema` (Zod — `environmental-monitoring.ts`)

The existing schema was designed for a future idealised zone-based EnvMon model,
not SAP QM inspection lots:

```
sampleId     required string
zoneId       required string           ← NO SOURCE in SAP QM
zoneName     required string           ← NO SOURCE
plantId      required string
vectorId     optional string           ← NO SOURCE
testType     required enum(swab/air-sample/surface-contact/rinse-water/other)  ← NO SOURCE
organism     required string           ← NO SOURCE (MIC_NAME is a different concept)
result       required enum(negative/positive/borderline/pending)  ← conflicts with mapper
cfu          optional number           ← NO SOURCE (quantitativeResult is closest)
cfuLimit     optional number           ← NO SOURCE (upperTolerance is closest)
sampleDate   required date             ← closest: createdDate (confirmed-ddl)
analysedAt   optional datetime         ← NO SOURCE
analyst      optional string           ← closest: inspector (confirmed-v1)
lotId        optional string           ← closest: inspectionLotId (confirmed-ddl)
```

The generated Python `EnvMonSwabResult` model mirrors this schema. Adding
`response_model=list[EnvMonSwabResult]` to the route would immediately fail with a
`ResponseValidationError` — `extra='forbid'` rejects all 26 mapper keys, and required fields
`zoneId`, `zoneName`, `testType`, `organism` are absent from the mapper output.

---

## Field-by-field alignment table

| Field | Contract requirement | Mapper output field | Source evidence | Safe action |
|---|---|---|---|---|
| `sampleId` | required string | `sampleId` (nullable) | ip.SAMPLE_ID (confirmed-ddl) | **make-optional** — nullable in source join |
| `zoneId` | required string | — | NO SOURCE | **remove-from-contract** |
| `zoneName` | required string | — | NO SOURCE | **remove-from-contract** |
| `plantId` | required string | `plantId` (nullable) | lot.PLANT_ID (confirmed-ddl) | **map-directly** (required) |
| `vectorId` | optional string | — | NO SOURCE | **remove-from-contract** |
| `testType` | required enum | — | NO SOURCE (INSPECTION_TYPE is internal code, not a test-type enum) | **remove-from-contract** |
| `organism` | required string | — | NO SOURCE (MIC_NAME is a MIC characteristic name, not an organism) | **remove-from-contract** |
| `result` | required enum(negative/positive/borderline/pending) | `result` (raw SAP string or null) | r.RESULT (confirmed-v1) | **rename-contract** — make optional nullable string; original enum not source-truthful |
| `cfu` | optional number | — | NOT a named SAP QM column; quantitativeResult is closest | **remove-from-contract** |
| `cfuLimit` | optional number | — | NOT a named SAP QM column; upperTolerance is closest | **remove-from-contract** |
| `sampleDate` | required date | `createdDate` (string or null) | lot.CREATED_DATE (confirmed-ddl) | **rename-contract** → `createdDate` optional |
| `analysedAt` | optional datetime | — | NO SOURCE | **remove-from-contract** |
| `analyst` | optional string | `inspector` (nullable) | r.INSPECTOR (confirmed-v1) | **rename-contract** → `inspector` optional |
| `lotId` | optional string | `inspectionLotId` (nullable) | lot.INSPECTION_LOT_ID (confirmed-ddl) | **rename-contract** → `inspectionLotId` optional |
| — | absent | `inspectionPointId` | ip.INSPECTION_POINT_ID (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `operationId` | ip.OPERATION_ID (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `functionalLocation` | ip.FUNCTIONAL_LOCATION (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `inspectionType` | lot.INSPECTION_TYPE (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `inspectionEndDate` | lot.INSPECTION_END_DATE (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `processOrderId` | lot.PROCESS_ORDER_ID (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `materialId` | lot.MATERIAL_ID (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `batchId` | lot.BATCH_ID (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `micId` | r.MIC_ID (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `micName` | r.MIC_NAME (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `micCode` | r.MIC_CODE (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `quantitativeResult` | r.QUANTITATIVE_RESULT (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `qualitativeResult` | r.QUALITATIVE_RESULT (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `targetValue` | r.TARGET_VALUE (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `upperTolerance` | r.UPPER_TOLERANCE (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `lowerTolerance` | r.LOWER_TOLERANCE (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `unitOfMeasure` | r.UNIT_OF_MEASURE (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `valuation` | r.INSPECTION_RESULT_VALUATION (confirmed-ddl) | **add-source-truthful-field** (optional) |
| — | absent | `status` | derived from valuation (confirmed-v1+ddl mapping) | **add-source-truthful-field** (required enum: fail/warning/pending/pass) |
| — | absent | `sampleSummary` | ip.SAMPLE_SUMMARY (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `sampleHour` | ip.SAMPLE_HOUR (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `inspector` | r.INSPECTOR (confirmed-v1) | **add-source-truthful-field** (optional) |
| — | absent | `inspectionMethod` | r.INSPECTION_METHOD (confirmed-v1) | **add-source-truthful-field** (optional) |

---

## Pre-existing source-truthful schema in the frontend

`domain-integrations/envmon/src/adapters/envmon-adapter.ts` already defines
`EnvMonNativeSwabResultSchema` — a locally scoped Zod schema that exactly matches the mapper
output. The adapter's `getNativeSwabResults()` method uses this schema to validate the live API
response. This confirms the frontend developer already recognised the mismatch and chose to
maintain a parallel schema locally rather than change the contract package.

This local schema is the authoritative source-truthful template for the new contract.

---

## Recommended decision: Option B

The existing `EnvMonSwabResultSchema` is not source-truthful and cannot be aligned to the
mapper without inventing source data. The correct contract is `EnvMonNativeSwabResultSchema`
(already defined in the adapter). Option B implementation:

1. **Export `EnvMonNativeSwabResultSchema` from `@connectio/data-contracts`** (add to
   `environmental-monitoring.ts`). Keep the old `EnvMonSwabResultSchema` unchanged — it is
   used by mock data in `getEnvMonSwabResults()` (mock-only method) and must not be deleted.

2. **Update the adapter** to import `EnvMonNativeSwabResultSchema` from `@connectio/data-contracts`
   instead of defining it locally.

3. **Regenerate `contracts.json` and `generated.py`** to produce `EnvMonNativeSwabResult` Python
   model.

4. **Add `response_model=list[EnvMonNativeSwabResult]`** to `GET /api/envmon/swab-results`.

5. **Run tests** to verify no regressions.

### Why not Option A?
Option A would require manufacturing `zoneId`, `zoneName`, `testType`, and `organism` from SAP QM
source data. There is no confirmed source for these fields. Manufacturing them is explicitly
forbidden by the work package and CLAUDE.md.

### Why not Option C?
Option C is unnecessary — Option B is safe and does not require any mapper changes. The mapper
is already correct; only the contract needs to be updated to match it.

---

## Risk notes

- The old `EnvMonSwabResultSchema` is retained. Frontend mock data uses it. Removing it would
  break `getEnvMonSwabResults()` (mock) and any frontend panel using mock swab results.
- `EnvMonNativeSwabResultSchema` uses nullable variants (`z.string().nullable()`) for all confirmed-v1
  columns because these arrive from a LEFT JOIN and may be null if the result row is absent. The
  Pydantic model will use `str | None = None` for those fields, which is safe with `extra='forbid'`.
- `status` is a derived required field (never null) — safe to keep required in the new schema.
- No Databricks SQL is changed. No inspection type filter is changed. No new routes are added.
- Empty array response remains valid and does not imply "no contamination."

---

## Implementation result (2026-05-22)

Option B implemented across 5 slices on branch `feature/envmon-swab-contract-alignment`:

| Slice | Description | Commit | Status |
|---|---|---|---|
| 1 | Analysis document + Slice 1 commit | `0aa2f61` (prior branch) | Complete |
| 2 | Promote `EnvMonNativeSwabResultSchema` to `@connectio/data-contracts`; update adapter + frontend imports; regenerate Python model | `10023dd` | Complete |
| 3 | Add `response_model=list[EnvMonNativeSwabResult]` to `GET /api/envmon/swab-results` | `6647b75` | Complete |
| 4 | Add 3 new tests: OpenAPI schema registration, exact contract shape, no invented zone fields | `dd879ee` | Complete |
| 5 | Docs sync: update backend-contract-enforcement-plan, contract-route-coverage-matrix, data-layer-implementation-backlog, this file | — | Complete |

**42 tests pass** (39 existing + 3 new). No Databricks SQL changed. No mapper changed. No new routes added.

**Remaining prerequisite before browser UAT:** Confirm INSPECTION_TYPE filter values in live UAT data (Rank 12 in backlog).
