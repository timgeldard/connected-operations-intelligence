/**
 * Pure mapping helpers for the **future** native SPC Databricks route.
 *
 * @remarks
 * This module exposes pure functions that map verified Databricks row shapes
 * (see ../fixtures/verified-databricks-spc.ts) into intermediate
 * "MappedX"/"DerivedX" shapes that a future native route would emit. **It
 * does not call Databricks, it does not call FastAPI, and it is not imported
 * by any adapter.** It exists so that:
 *
 *   - the future native route can be implemented without rediscovering the
 *     mapping rules surfaced by PR #65;
 *   - Slice 5 tests can lock the mapping behaviour against verified field
 *     names so that re-introducing old V1 wire names (`result_value`,
 *     `sample_id`, `sample_timestamp`, `subgroup_mean`, `subgroup_range`,
 *     `subgroup_sd`, `unit_of_measure`) breaks the build.
 *
 * The helpers deliberately do **not** return the existing V2 Zod-validated
 * contract types. The current contracts (`ControlChartSeries`,
 * `ControlChartPoint`, `CharacteristicCapability`, …) cannot represent the
 * verified source honestly without invented values or hard-coded defaults
 * (audit items 2.3, 2.7, 2.8, 2.9, 2.11). The helper return shapes are the
 * source-truthful intermediate; mapping to (or extending) the Zod contracts
 * is the optional Slice 6.
 *
 * **Hard rules these helpers encode (from PR #65 + the audit).**
 * - `plant_id = 'P999'` is the sentinel/aggregate plant and is excluded.
 * - Blank/null `material_id` rows are excluded.
 * - `value` is the individual measurement; `subgroupMean` is `sum_value / batch_n`.
 * - `subgroupRange` is `batch_range` (NOT derived from min/max).
 * - `batch_date` is the chart time axis; `first_posting_date` /
 *   `last_posting_date` are diagnostic.
 * - `operation_id` is a sequential identifier, NOT a SAP work centre.
 * - `usl_spec = 0` AND `lsl_spec = 0` together mean "not populated".
 * - `locked_by` is lock provenance, NOT governed approval.
 * - The single UAT locked-limit row is `uat-fixture-only`, not `approved`.
 * - `spc_capability_detail_mv` is NOT FOUND, so capability is `unavailable`
 *   unless backend calculation is explicitly authorised.
 * - `spc_nelson_rule_flags_mv` is NOT FOUND, so signals are calculated, not
 *   stored. "No signals returned" is NEVER treated as "in control".
 *
 * @see ../../docs/spc-databricks-verification-results-summary.md
 * @see ../../docs/spc-v2-contract-mapping.md
 * @see ../../docs/spc-native-contract-alignment-audit.md
 */

import type {
  VerifiedSubgroupMvRow,
  VerifiedLockedLimitsRow,
} from '../fixtures/verified-databricks-spc.js'

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export type EligibilityExclusionReason =
  | 'sentinel-plant-p999'
  | 'blank-material-id'

export interface EligibilityExclusion {
  readonly row: VerifiedSubgroupMvRow
  readonly reason: EligibilityExclusionReason
  readonly message: string
}

export interface EligibilityResult {
  readonly eligible: readonly VerifiedSubgroupMvRow[]
  readonly excluded: readonly EligibilityExclusion[]
}

/**
 * Returns `true` if a verified subgroup row is eligible for the future native
 * production SPC chart. Excludes `P999` (sentinel/aggregate plant) and
 * blank/null `material_id` rows.
 */
export function isEligibleSpcProductionRow(row: VerifiedSubgroupMvRow): boolean {
  return classifyEligibility(row) === null
}

/**
 * Partitions a row set into eligible and excluded rows, with per-row reason
 * codes. Used by Slice 5 tests to assert exclusion behaviour is exhaustive.
 */
export function filterEligibleSpcProductionRows(
  rows: readonly VerifiedSubgroupMvRow[],
): EligibilityResult {
  const eligible: VerifiedSubgroupMvRow[] = []
  const excluded: EligibilityExclusion[] = []
  for (const row of rows) {
    const reason = classifyEligibility(row)
    if (reason === null) {
      eligible.push(row)
    } else {
      excluded.push({
        row,
        reason,
        message:
          reason === 'sentinel-plant-p999'
            ? 'plant_id = P999 is the sentinel/aggregate plant and is excluded from production candidates'
            : 'material_id is blank or null; row is excluded from production candidates',
      })
    }
  }
  return { eligible, excluded }
}

function classifyEligibility(row: VerifiedSubgroupMvRow): EligibilityExclusionReason | null {
  if (row.plant_id === 'P999') return 'sentinel-plant-p999'
  if (!row.material_id || row.material_id.trim() === '') return 'blank-material-id'
  return null
}

// ---------------------------------------------------------------------------
// Plant ID namespace (P-prefix vs C-prefix)
// ---------------------------------------------------------------------------

export type PlantNamespace = 'P-prefix' | 'C-prefix' | 'unknown'

/**
 * Classifies a plant ID by namespace prefix. `P`-prefix is the SPC-internal
 * namespace; `C`-prefix is the SAP plant code namespace. Their cross-mapping
 * is **not** governed by Kerry yet, so a native mapper must preserve the
 * namespace verbatim and surface a warning for cross-namespace operations.
 */
export function classifyPlantNamespace(plantId: string | null | undefined): PlantNamespace {
  if (!plantId) return 'unknown'
  if (plantId.startsWith('P')) return 'P-prefix'
  if (plantId.startsWith('C')) return 'C-prefix'
  return 'unknown'
}

// ---------------------------------------------------------------------------
// Subgroup-point derivation
// ---------------------------------------------------------------------------

export type DerivedSubgroupWarningCode =
  | 'batch-n-zero'
  | 'sample-count-below-two-stddev-unavailable'
  | 'source-row-count-mismatch'
  | 'mixed-batch-grouping'
  | 'empty-input'

export interface DerivedSubgroupWarning {
  readonly code: DerivedSubgroupWarningCode
  readonly message: string
}

export interface DerivedSubgroupPoint {
  readonly materialId: string
  readonly plantId: string
  readonly plantNamespace: PlantNamespace
  readonly micId: string
  readonly operationId: string
  readonly batchId: string
  readonly batchDate: string
  readonly firstPostingDate: string | null
  readonly lastPostingDate: string | null
  readonly subgroupMean: number | null
  readonly subgroupRange: number
  readonly subgroupStdDev: number | null
  readonly sampleCount: number
  readonly sourceRowCount: number
  readonly minValue: number
  readonly maxValue: number
  readonly sumValue: number
  readonly sumSquares: number
  readonly individualValues: readonly number[]
  readonly anyRejection: boolean
  readonly anyAcceptance: boolean
  readonly normalityType: string | null
  readonly normalityMethod: string | null
  readonly normalitySignature: string | null
  readonly unifiedMicKey: string
  readonly warnings: readonly DerivedSubgroupWarning[]
}

/**
 * Derives a single per-batch subgroup chart point from measurement-level
 * verified rows that share the same `(material_id, plant_id, mic_id,
 * operation_id, batch_id)`.
 *
 * - `subgroupMean` is `sum_value / batch_n` (derived; the column does not exist).
 * - `subgroupRange` is `batch_range` (verified column; NOT derived from min/max).
 * - `subgroupStdDev` is derived from `sum_squares`, `sum_value`, `batch_n` using
 *   the standard sample-variance formula. Returns `null` when `batch_n < 2`.
 * - `sampleCount` is `batch_n`.
 *
 * Throws `RangeError` only on an empty input array — that condition is a
 * programmer error (the caller should never group an empty batch). Other
 * pathological inputs (mixed batches in one group, `batch_n = 0`, source-row
 * count mismatch) are surfaced via `warnings` instead of throwing so the
 * native route can preserve as much evidence as possible while flagging the
 * issue to the UI.
 */
export function deriveSubgroupPoint(
  rowsForBatch: readonly VerifiedSubgroupMvRow[],
): DerivedSubgroupPoint {
  if (rowsForBatch.length === 0) {
    throw new RangeError('deriveSubgroupPoint requires at least one row')
  }

  const warnings: DerivedSubgroupWarning[] = []
  const head = rowsForBatch[0]!

  if (!rowsForBatch.every(r =>
    r.material_id === head.material_id &&
    r.plant_id === head.plant_id &&
    r.mic_id === head.mic_id &&
    r.operation_id === head.operation_id &&
    r.batch_id === head.batch_id
  )) {
    warnings.push({
      code: 'mixed-batch-grouping',
      message:
        'rowsForBatch contains rows that do not share the same (material_id, plant_id, mic_id, operation_id, batch_id) key',
    })
  }

  const batchN = head.batch_n
  const sumValue = head.sum_value
  const sumSquares = head.sum_squares
  const batchRange = head.batch_range
  const minValue = head.min_value
  const maxValue = head.max_value
  const anyRejection = rowsForBatch.some(r => r.any_rejection)
  const anyAcceptance = rowsForBatch.some(r => r.any_acceptance)
  const individualValues = rowsForBatch.map(r => r.value)

  let subgroupMean: number | null = null
  if (batchN > 0) {
    subgroupMean = sumValue / batchN
  } else {
    warnings.push({
      code: 'batch-n-zero',
      message: 'batch_n is zero — subgroupMean cannot be computed and the batch is unusable',
    })
  }

  let subgroupStdDev: number | null = null
  if (batchN >= 2) {
    // Sample-variance formula using running sums:
    //   s² = (sum_squares − sum_value² / batch_n) / (batch_n − 1)
    const variance = (sumSquares - (sumValue * sumValue) / batchN) / (batchN - 1)
    if (Number.isFinite(variance) && variance >= 0) {
      subgroupStdDev = Math.sqrt(variance)
    }
  } else if (batchN === 1) {
    warnings.push({
      code: 'sample-count-below-two-stddev-unavailable',
      message: 'batch_n is 1 — within-batch standard deviation is undefined',
    })
  }

  if (rowsForBatch.length !== batchN) {
    warnings.push({
      code: 'source-row-count-mismatch',
      message: `sourceRowCount=${rowsForBatch.length} does not equal batch_n=${batchN}; row deduplication may be required`,
    })
  }

  return {
    materialId: head.material_id,
    plantId: head.plant_id,
    plantNamespace: classifyPlantNamespace(head.plant_id),
    micId: head.mic_id,
    operationId: head.operation_id,
    batchId: head.batch_id,
    batchDate: head.batch_date,
    firstPostingDate: head.first_posting_date,
    lastPostingDate: head.last_posting_date,
    subgroupMean,
    subgroupRange: batchRange,
    subgroupStdDev,
    sampleCount: batchN,
    sourceRowCount: rowsForBatch.length,
    minValue,
    maxValue,
    sumValue,
    sumSquares,
    individualValues,
    anyRejection,
    anyAcceptance,
    normalityType: head.normality_type,
    normalityMethod: head.normality_method,
    normalitySignature: head.normality_signature,
    unifiedMicKey: head.unified_mic_key,
    warnings,
  }
}

/**
 * Groups eligible measurement rows by
 * `(material_id, plant_id, mic_id, operation_id, batch_id)` and derives one
 * chart point per group. Output ordering is `batch_date ASC, batch_id ASC` to
 * match the future native query.
 *
 * Callers should apply `filterEligibleSpcProductionRows` before calling this
 * function; this helper does **not** re-filter sentinels. The separation lets
 * callers retain the exclusion warnings.
 */
export function deriveSubgroupPoints(
  rows: readonly VerifiedSubgroupMvRow[],
): readonly DerivedSubgroupPoint[] {
  const groups = new Map<string, VerifiedSubgroupMvRow[]>()
  for (const row of rows) {
    const key = `${row.material_id}|${row.plant_id}|${row.mic_id}|${row.operation_id}|${row.batch_id}`
    const list = groups.get(key)
    if (list) {
      list.push(row)
    } else {
      groups.set(key, [row])
    }
  }
  const points = Array.from(groups.values()).map(deriveSubgroupPoint)
  return points.slice().sort((a, b) => {
    if (a.batchDate < b.batchDate) return -1
    if (a.batchDate > b.batchDate) return 1
    if (a.batchId < b.batchId) return -1
    if (a.batchId > b.batchId) return 1
    return 0
  })
}

// ---------------------------------------------------------------------------
// Locked-limit row mapping
// ---------------------------------------------------------------------------

/**
 * Provenance status returned by `mapLockedLimitRow`.
 *
 * - `no-lock-row` — placeholder for the "no matching row" case; callers will
 *   not see this status from `mapLockedLimitRow` because that helper requires
 *   a row to be passed; the value exists for cross-call comparisons.
 * - `locked-limit-present` — RESERVED for future governed-approval rows; never
 *   emitted in this phase because no source row qualifies.
 * - `uat-fixture-only` — `locked_by` is set but `baseline_from`/`baseline_to`
 *   and `locking_note` are all empty, OR the source is the single known UAT
 *   row from PR #65. Tests use this to confirm the native mapper does not
 *   overclaim approval.
 * - `approval-not-governed` — `locked_by` is set with a non-empty baseline
 *   window but no governance evidence exists yet. Still NOT a green light.
 */
export type LockedLimitProvenanceStatus =
  | 'no-lock-row'
  | 'locked-limit-present'
  | 'uat-fixture-only'
  | 'approval-not-governed'

export interface MappedLockedLimitRow {
  readonly materialId: string
  readonly plantId: string
  readonly plantNamespace: PlantNamespace
  readonly micId: string
  readonly operationId: string
  readonly chartType: string
  readonly cl: number | null
  readonly ucl: number | null
  readonly lcl: number | null
  readonly uclR: number | null
  readonly lclR: number | null
  readonly sigmaWithin: number | null
  readonly lockedBy: string | null
  readonly lockedAt: string | null
  readonly baselineFrom: string | null
  readonly baselineTo: string | null
  readonly lockingNote: string | null
  readonly micOrigin: string | null
  readonly specSignature: string | null
  readonly unifiedMicKey: string | null
  readonly provenanceStatus: LockedLimitProvenanceStatus
  readonly warnings: readonly string[]
}

/**
 * Maps a verified `spc_locked_limits` row into a source-truthful intermediate.
 * Date fields come from `baseline_from` / `baseline_to` (NOT `effective_from` /
 * `effective_to`). `locking_note` replaces the older `provenance` name. No
 * `usl` / `lsl` columns are read — spec limits live on the subgroup view.
 *
 * `provenanceStatus` is computed so the native mapper never emits
 * `'imported-from-approved-source'` or `approvalState: 'approved'` from a
 * `locked_by`-only signal.
 */
export function mapLockedLimitRow(row: VerifiedLockedLimitsRow): MappedLockedLimitRow {
  const warnings: string[] = []

  const baselineEmpty = !row.baseline_from && !row.baseline_to
  const noteEmpty = !row.locking_note

  let provenanceStatus: LockedLimitProvenanceStatus
  if (!row.locked_by) {
    provenanceStatus = 'approval-not-governed'
    warnings.push('locked_by is empty — lock provenance unclear')
  } else if (baselineEmpty && noteEmpty) {
    provenanceStatus = 'uat-fixture-only'
    warnings.push(
      'baseline_from / baseline_to / locking_note are all empty — treat as UAT fixture, not governed approval',
    )
  } else {
    provenanceStatus = 'approval-not-governed'
    warnings.push(
      'locked_by is set but no governed approval workflow is recorded — do not surface as approved',
    )
  }

  return {
    materialId: row.material_id,
    plantId: row.plant_id,
    plantNamespace: classifyPlantNamespace(row.plant_id),
    micId: row.mic_id,
    operationId: row.operation_id,
    chartType: row.chart_type,
    cl: row.cl,
    ucl: row.ucl,
    lcl: row.lcl,
    uclR: row.ucl_r,
    lclR: row.lcl_r,
    sigmaWithin: row.sigma_within,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at,
    baselineFrom: row.baseline_from,
    baselineTo: row.baseline_to,
    lockingNote: row.locking_note,
    micOrigin: row.mic_origin,
    specSignature: row.spec_signature,
    unifiedMicKey: row.unified_mic_key,
    provenanceStatus,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Specification limits
// ---------------------------------------------------------------------------

export type SpecLimitSourceStatus =
  | 'present'
  | 'not-populated-zero-zero'
  | 'lower-only'
  | 'upper-only'
  | 'unavailable'

export interface DerivedSpecificationLimits {
  readonly lowerSpecLimit: number | null
  readonly upperSpecLimit: number | null
  readonly nominalTarget: number | null
  readonly toleranceHalfWidth: number | null
  readonly rawTolerance: number | null
  readonly specSignature: string | null
  readonly specType: string | null
  readonly sourceStatus: SpecLimitSourceStatus
  readonly warnings: readonly string[]
}

/**
 * Maps spec-limit columns on a verified subgroup row.
 *
 * - `(lsl_spec, usl_spec) = (0, 0)` is treated as `not-populated-zero-zero`,
 *   NOT as a literal `[0, 0]` specification band. Both limits are reported as
 *   `null` and a warning is attached.
 * - `null` / undefined values for either limit map to `unavailable`.
 * - One-sided specs (one limit populated, the other zero/null) are reported as
 *   `lower-only` / `upper-only`.
 */
export function deriveSpecificationLimits(row: VerifiedSubgroupMvRow): DerivedSpecificationLimits {
  const lsl = row.lsl_spec
  const usl = row.usl_spec
  const warnings: string[] = []

  const lslMissing = lsl === null || lsl === undefined
  const uslMissing = usl === null || usl === undefined

  const lslZero = lsl === 0
  const uslZero = usl === 0

  let sourceStatus: SpecLimitSourceStatus
  let lowerSpecLimit: number | null = null
  let upperSpecLimit: number | null = null

  if (lslMissing && uslMissing) {
    sourceStatus = 'unavailable'
    warnings.push('lsl_spec and usl_spec are both missing on the source row')
  } else if (lslZero && uslZero) {
    sourceStatus = 'not-populated-zero-zero'
    warnings.push(
      'lsl_spec = 0 and usl_spec = 0 — specification is not populated for this material; do not render a [0, 0] band',
    )
  } else if ((lslMissing || lslZero) && !uslMissing && !uslZero) {
    sourceStatus = 'upper-only'
    upperSpecLimit = usl
    warnings.push('only upper spec limit is populated; lower spec limit is zero or missing')
  } else if (!lslMissing && !lslZero && (uslMissing || uslZero)) {
    sourceStatus = 'lower-only'
    lowerSpecLimit = lsl
    warnings.push('only lower spec limit is populated; upper spec limit is zero or missing')
  } else {
    sourceStatus = 'present'
    lowerSpecLimit = lsl
    upperSpecLimit = usl
  }

  return {
    lowerSpecLimit,
    upperSpecLimit,
    nominalTarget: row.nominal_target ?? null,
    toleranceHalfWidth: row.tolerance_half_width ?? null,
    rawTolerance: row.raw_tolerance ?? null,
    specSignature: row.spec_signature || null,
    specType: row.spec_type || null,
    sourceStatus,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Signal source classification
// ---------------------------------------------------------------------------

export type SignalSourceStatus =
  | 'calculated-frontend'
  | 'calculated-backend'
  | 'not-yet-evaluated'
  | 'unavailable'

export interface SignalSourceInput {
  readonly chartDataLoaded: boolean
  readonly ruleDetectionRan: boolean
  readonly calculationLocation?: 'frontend' | 'backend'
}

export interface SignalSourceClassification {
  readonly status: SignalSourceStatus
  readonly storedSourceAvailable: false
  readonly reason: string
}

/**
 * Classifies the signal source for the SPC chart context.
 *
 * Since neither `spc_nelson_rule_flags_mv` nor any other stored signal table
 * exists in `connected_plant_uat.gold`, `storedSourceAvailable` is always
 * `false`. The status reflects whether rule detection has produced signals
 * for the currently-loaded chart, and where the calculation runs. The helper
 * **never** returns "in control" from absence of stored signals — that
 * conclusion is not in this helper's vocabulary.
 */
export function classifySignalSource(input: SignalSourceInput): SignalSourceClassification {
  if (!input.chartDataLoaded) {
    return {
      status: 'unavailable',
      storedSourceAvailable: false,
      reason: 'chart data not loaded; signals cannot be evaluated',
    }
  }
  if (!input.ruleDetectionRan) {
    return {
      status: 'not-yet-evaluated',
      storedSourceAvailable: false,
      reason: 'chart data loaded but rule detection has not run for this render cycle',
    }
  }
  if (input.calculationLocation === 'backend') {
    return {
      status: 'calculated-backend',
      storedSourceAvailable: false,
      reason: 'rule detection ran in the V2 backend',
    }
  }
  return {
    status: 'calculated-frontend',
    storedSourceAvailable: false,
    reason: 'rule detection ran in the V2 frontend (calculations.runtime.ts)',
  }
}

// ---------------------------------------------------------------------------
// Capability source classification
// ---------------------------------------------------------------------------

export type CapabilitySourceStatus =
  | 'present-from-mv'
  | 'backend-calculation-required'
  | 'legacy-bridge'
  | 'unavailable'

export interface CapabilitySourceInput {
  readonly capabilityMvFound: boolean
  readonly subgroupDataAvailable: boolean
  readonly backendCalculationAuthorised?: boolean
  readonly legacyBridgeAvailable?: boolean
}

export interface CapabilitySourceClassification {
  readonly status: CapabilitySourceStatus
  readonly reason: string
  readonly availableInputs: readonly string[]
  readonly invents: false
}

/**
 * Classifies the capability (Cp/Cpk/Pp/Ppk) source.
 *
 * - If `spc_capability_detail_mv` is FOUND, status is `present-from-mv`.
 * - Else if subgroup data is available AND backend calculation is authorised,
 *   status is `backend-calculation-required` — the V2 backend can compute
 *   capability from `usl_spec`, `lsl_spec`, `nominal_target`, `sum_value`,
 *   `sum_squares`, `batch_n`, and `sigma_within`. **This helper does not
 *   compute the values** — it only reports that they are computable.
 * - Else if the legacy bridge is available, status is `legacy-bridge` (V1
 *   FastAPI's `/api/spc/capability` will serve the value).
 * - Otherwise, status is `unavailable`.
 *
 * In all branches, `invents: false` is part of the return shape so consumers
 * can statically assert that this helper never produces synthetic Cp/Cpk
 * values.
 */
export function classifyCapabilitySource(
  input: CapabilitySourceInput,
): CapabilitySourceClassification {
  const availableInputs = collectCapabilityInputs(input)

  if (input.capabilityMvFound) {
    return {
      status: 'present-from-mv',
      reason: 'spc_capability_detail_mv is available; Cp/Cpk/Pp/Ppk should be read from the MV',
      availableInputs,
      invents: false,
    }
  }

  if (input.subgroupDataAvailable && input.backendCalculationAuthorised) {
    return {
      status: 'backend-calculation-required',
      reason:
        'spc_capability_detail_mv is NOT FOUND; capability can be computed in the V2 backend from subgroup statistics + spec limits + sigma_within once an algorithm is governed',
      availableInputs,
      invents: false,
    }
  }

  if (input.legacyBridgeAvailable) {
    return {
      status: 'legacy-bridge',
      reason:
        'spc_capability_detail_mv is NOT FOUND; the V1 legacy bridge serves capability via /api/spc/capability',
      availableInputs,
      invents: false,
    }
  }

  return {
    status: 'unavailable',
    reason:
      'spc_capability_detail_mv is NOT FOUND, backend calculation is not authorised, and no legacy bridge is available; capability cannot be surfaced without inventing values',
    availableInputs,
    invents: false,
  }
}

function collectCapabilityInputs(input: CapabilitySourceInput): readonly string[] {
  const inputs: string[] = []
  if (input.capabilityMvFound) inputs.push('spc_capability_detail_mv')
  if (input.subgroupDataAvailable) {
    inputs.push(
      'spc_quality_metric_subgroup_mv.sum_value',
      'spc_quality_metric_subgroup_mv.sum_squares',
      'spc_quality_metric_subgroup_mv.batch_n',
      'spc_quality_metric_subgroup_mv.usl_spec',
      'spc_quality_metric_subgroup_mv.lsl_spec',
      'spc_quality_metric_subgroup_mv.nominal_target',
    )
  }
  if (input.legacyBridgeAvailable) inputs.push('V1 /api/spc/capability')
  return inputs
}
