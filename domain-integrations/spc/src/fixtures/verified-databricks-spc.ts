/**
 * Verified Databricks SPC fixtures (PR #65-derived).
 *
 * These fixtures represent the **verified** row shapes of
 * `connected_plant_uat.gold.spc_quality_metric_subgroup_mv` and
 * `connected_plant_uat.gold.spc_locked_limits` as confirmed by the
 * Databricks CLI verification session captured in PR #65
 * (see ../../docs/spc-databricks-verification-results-summary.md).
 *
 * **Scope.**
 * - These are **static fixtures** for use by Slice 4 mapping helpers and
 *   Slice 5 mapper tests. They are not live Databricks data, are not loaded
 *   by any runtime adapter, and are not exported from `src/index.ts`.
 * - The row sets are **reduced subsets** of the full UAT data; they are not
 *   production representative. Where PR #65 found a candidate with ~271 or
 *   ~60,673 batch points, only a handful of points are reproduced here so
 *   tests stay fast and so the fixture remains reviewable.
 * - Values quoted directly from PR #65 evidence are reproduced verbatim
 *   (e.g. the single UAT locked-limit row for material 20047111 / C037).
 *   Values that are **representative but synthesised** (e.g. additional batch
 *   rows for the pH candidate beyond the few sampled in PR #65) are clearly
 *   marked in the row comments.
 *
 * **Field naming.**
 * - The row interfaces use the verified Databricks column names exactly
 *   (`value`, `batch_n`, `batch_range`, `sum_value`, `sum_squares`,
 *   `batch_date`, `baseline_from`, `baseline_to`, `locking_note`, etc.).
 * - Old V1 wire-format names (`result_value`, `sample_id`, `sample_timestamp`,
 *   `subgroup_mean`, `subgroup_range`, `subgroup_sd`, `unit_of_measure`) are
 *   deliberately NOT used here — they belong to the legacy bridge surface, not
 *   to the native source-of-truth (see
 *   ../../docs/spc-native-contract-alignment-audit.md item 2.21).
 *
 * **Hard rules these fixtures encode.**
 * - `value` is the individual measurement, NOT the subgroup mean.
 * - `subgroupMean` must be derived as `sum_value / batch_n`.
 * - `subgroupRange` is the `batch_range` column (not derived).
 * - `batch_date` is the preferred chart time axis.
 * - `operation_id` is a sequential inspection-operation identifier (`00000001`,
 *   `00000004`, ...), NOT a SAP work centre.
 * - `plant_id = 'P999'` is the sentinel/aggregate plant and must be excluded
 *   from production candidate mapping.
 * - Blank `material_id` rows must be excluded.
 * - `usl_spec = 0` AND `lsl_spec = 0` together mean "not populated", NOT
 *   literal `[0, 0]` specification bands.
 * - `locked_by` proves a lock identity exists; it does NOT prove a governed
 *   approval workflow. The single UAT row reproduced here is a fixture, not
 *   a production-representative approved limit.
 *
 * @see ../../docs/spc-databricks-verification-results-summary.md
 * @see ../../docs/spc-v2-contract-mapping.md
 * @see ../../docs/spc-native-contract-alignment-audit.md
 */

// ---------------------------------------------------------------------------
// Row interfaces — verified Databricks column names only
// ---------------------------------------------------------------------------

/**
 * Verified row shape of `connected_plant_uat.gold.spc_quality_metric_subgroup_mv`.
 *
 * Measurement-level grain: one row per quality measurement within a batch.
 * `batch_n` is the sample count for the batch (constant across rows of the
 * same batch). To derive a subgroup chart point, group rows by
 * `(material_id, plant_id, mic_id, operation_id, batch_id)`.
 */
export interface VerifiedSubgroupMvRow {
  readonly material_id: string
  readonly material_name: string
  readonly plant_id: string
  readonly plant_name: string
  readonly mic_id: string
  readonly mic_name: string
  readonly operation_id: string
  readonly batch_id: string
  readonly batch_date: string
  readonly first_posting_date: string | null
  readonly last_posting_date: string | null
  readonly value: number
  readonly batch_n: number
  readonly sum_value: number
  readonly sum_squares: number
  readonly min_value: number
  readonly max_value: number
  readonly batch_range: number
  readonly any_rejection: boolean
  readonly any_acceptance: boolean
  readonly lsl_spec: number
  readonly usl_spec: number
  readonly spec_type: string
  readonly nominal_target: number | null
  readonly tolerance_half_width: number | null
  readonly raw_tolerance: number | null
  readonly spec_signature: string
  readonly normality_type: string | null
  readonly normality_method: string | null
  readonly normality_signature: string | null
  readonly unified_mic_key: string
  readonly subgroup_rep: number | null
}

/**
 * Verified row shape of `connected_plant_uat.gold.spc_locked_limits`.
 *
 * Primary key: `(material_id, mic_id, plant_id, operation_id, chart_type)`.
 * Spec limits (`usl`/`lsl`) are NOT present here — they live on the subgroup
 * view (`usl_spec` / `lsl_spec`). Date columns are `baseline_from` /
 * `baseline_to` (NOT `effective_from` / `effective_to`).
 * `locking_note` replaces an older `provenance` name expected by V2.
 */
export interface VerifiedLockedLimitsRow {
  readonly material_id: string
  readonly plant_id: string
  readonly mic_id: string
  readonly operation_id: string
  readonly chart_type: string
  readonly cl: number | null
  readonly ucl: number | null
  readonly lcl: number | null
  readonly ucl_r: number | null
  readonly lcl_r: number | null
  readonly sigma_within: number | null
  readonly locked_by: string | null
  readonly locked_at: string | null
  readonly baseline_from: string | null
  readonly baseline_to: string | null
  readonly unified_mic_key: string | null
  readonly mic_origin: string | null
  readonly spec_signature: string | null
  readonly locking_note: string | null
}

// ---------------------------------------------------------------------------
// Candidate 1 — Primary locked-limit candidate (Salt @ C037, material 20047111)
//
// PR #65 evidence: 271 batch points in UAT; single locked-limit row.
// This fixture reproduces the verbatim locked-limit row plus 6 representative
// subgroup measurement rows (NOT the full 271 — see top-of-file scope note).
// ---------------------------------------------------------------------------

export const SALT_C037_KEYS = {
  material_id: '20047111',
  material_name: 'SALT (RAPID ANALYSER) — UAT CANDIDATE',
  plant_id: 'C037',
  plant_name: 'Kerry UAT Plant C037',
  mic_id: '0060',
  mic_name: 'Salt (Rapid Analyser)',
  operation_id: '00000001',
  unified_mic_key: 'umk-salt-c037-0060',
  spec_signature: 'salt-spec-default',
} as const

/**
 * Verbatim from PR #65 — the single locked-limit row in UAT.
 *
 * locked_by, locked_at, cl, ucl, lcl, ucl_r, lcl_r, sigma_within reproduced
 * exactly; baseline_from / baseline_to / locking_note are empty in UAT and
 * are reproduced as `null` here.
 *
 * **Important:** This is a UAT fixture row, NOT a governed approval. Tests
 * should assert that `mapLockedLimitRow` returns a status like
 * `uat-fixture-only` or `approval-not-governed`, never `approved`.
 */
export const lockedLimitRow_Salt_C037: VerifiedLockedLimitsRow = {
  ...SALT_C037_KEYS,
  chart_type: 'imr',
  cl: 3.243357541899438,
  ucl: 5.54117633384574,
  lcl: 0.945538749953136,
  ucl_r: 2.822622221476501,
  lcl_r: 0.0,
  sigma_within: 0.7659395973154339,
  locked_by: 'domhnall.odonovan@kerry.ie',
  locked_at: '2026-04-06T19:06:02.716Z',
  baseline_from: null,
  baseline_to: null,
  mic_origin: null,
  locking_note: null,
}

/**
 * Six representative subgroup rows for the Salt candidate.
 *
 * - Six different batches, all with `batch_n = 1` (individuals chart) — matches
 *   the locked-limit row's `chart_type = 'imr'`.
 * - Spec limits are 0/0 on this material (per PR #65 — spec not populated).
 *   Tests must assert that the mapper does NOT surface a [0, 0] spec band.
 * - Salt percentages clustered around `cl = 3.24` to look realistic and to
 *   give rule-detection tests a viable mean.
 */
export const subgroupRows_Salt_C037: readonly VerifiedSubgroupMvRow[] = [
  buildSaltRow('B-SALT-1001', '2026-04-01', 3.10),
  buildSaltRow('B-SALT-1002', '2026-04-02', 3.42),
  buildSaltRow('B-SALT-1003', '2026-04-03', 3.18),
  buildSaltRow('B-SALT-1004', '2026-04-04', 3.66),
  buildSaltRow('B-SALT-1005', '2026-04-05', 2.95),
  buildSaltRow('B-SALT-1006', '2026-04-06', 3.51),
]

function buildSaltRow(batchId: string, batchDate: string, value: number): VerifiedSubgroupMvRow {
  return {
    ...SALT_C037_KEYS,
    batch_id: batchId,
    batch_date: batchDate,
    first_posting_date: batchDate,
    last_posting_date: batchDate,
    value,
    batch_n: 1,
    sum_value: value,
    sum_squares: value * value,
    min_value: value,
    max_value: value,
    batch_range: 0,
    any_rejection: false,
    any_acceptance: true,
    lsl_spec: 0,
    usl_spec: 0,
    spec_type: 'two-sided',
    nominal_target: null,
    tolerance_half_width: null,
    raw_tolerance: null,
    normality_type: 'normal',
    normality_method: 'shapiro',
    normality_signature: 'sig-salt-default',
    subgroup_rep: null,
  }
}

// ---------------------------------------------------------------------------
// Candidate 2 — Data-rich pH candidate (P523, material 20642328)
//
// PR #65 evidence: ~60,673 batch points, NO locked limits, spec limits
// usl_spec = 7.8 / lsl_spec = 7.2 (populated). Reproduced here as 4 batches
// with batch_n = 5 (X-bar/R chart shape) so subgroup derivation tests have
// non-trivial batches to aggregate.
// ---------------------------------------------------------------------------

export const PH_P523_KEYS = {
  material_id: '20642328',
  material_name: 'OATLY-SBUX BARISTA 12X946ML',
  plant_id: 'P523',
  plant_name: 'Ste. Claire [MFG]',
  mic_id: '0010',
  mic_name: 'pH',
  operation_id: '00000004',
  unified_mic_key: 'umk-ph-p523-0010',
  spec_signature: 'ph-72-78',
} as const

interface PhBatchSeed {
  readonly batch_id: string
  readonly batch_date: string
  readonly values: readonly [number, number, number, number, number]
}

const phBatchSeeds: readonly PhBatchSeed[] = [
  { batch_id: 'B-PH-2001', batch_date: '2026-05-10', values: [7.45, 7.51, 7.48, 7.47, 7.52] },
  { batch_id: 'B-PH-2002', batch_date: '2026-05-11', values: [7.55, 7.60, 7.58, 7.61, 7.57] },
  { batch_id: 'B-PH-2003', batch_date: '2026-05-12', values: [7.30, 7.32, 7.28, 7.31, 7.29] },
  { batch_id: 'B-PH-2004', batch_date: '2026-05-13', values: [7.40, 7.42, 7.41, 7.43, 7.39] },
]

/**
 * 20 representative rows for the pH candidate (4 batches × 5 measurements).
 *
 * Spec limits are populated (7.2 / 7.8) so tests can assert that
 * `deriveSpecificationLimits` correctly surfaces the band, distinct from
 * absent control limits.
 *
 * The full UAT data set has ~60,673 batch points; this fixture is a tiny,
 * representative sample. Synthesised values cluster within spec for the
 * positive path; tests that want out-of-spec or rule-violation cases should
 * synthesise their own additional rows from this seed pattern.
 */
export const subgroupRows_Ph_P523: readonly VerifiedSubgroupMvRow[] = phBatchSeeds.flatMap(seed =>
  seed.values.map((value): VerifiedSubgroupMvRow => buildPhRow(seed, value, seed.values)),
)

function buildPhRow(
  seed: PhBatchSeed,
  value: number,
  allValues: readonly number[],
): VerifiedSubgroupMvRow {
  const sumValue = allValues.reduce((acc, v) => acc + v, 0)
  const sumSquares = allValues.reduce((acc, v) => acc + v * v, 0)
  const minValue = Math.min(...allValues)
  const maxValue = Math.max(...allValues)
  return {
    ...PH_P523_KEYS,
    batch_id: seed.batch_id,
    batch_date: seed.batch_date,
    first_posting_date: seed.batch_date,
    last_posting_date: seed.batch_date,
    value,
    batch_n: allValues.length,
    sum_value: sumValue,
    sum_squares: sumSquares,
    min_value: minValue,
    max_value: maxValue,
    batch_range: maxValue - minValue,
    any_rejection: false,
    any_acceptance: true,
    lsl_spec: 7.2,
    usl_spec: 7.8,
    spec_type: 'two-sided',
    nominal_target: 7.5,
    tolerance_half_width: 0.3,
    raw_tolerance: 0.6,
    normality_type: 'normal',
    normality_method: 'shapiro',
    normality_signature: 'sig-ph-default',
    subgroup_rep: null,
  }
}

/**
 * **No locked-limit row** exists for the pH candidate in UAT.
 *
 * This export documents the absence explicitly so mapper tests can assert
 * the "no lock row → control limits unavailable / calculated-from-sample"
 * branch deterministically. Importing code MUST treat it as an empty array,
 * NOT as a synthesised `null` row.
 */
export const lockedLimitRows_Ph_P523: readonly VerifiedLockedLimitsRow[] = []

// ---------------------------------------------------------------------------
// Candidate 3 — Multi-MIC candidate (P775, material 20372893)
//
// PR #65 evidence: MICs 0030, 0040, 0050, 0060, 0070, each with ~42,094 batch
// points and no locked limits. Reproduced here as one batch per MIC so mapper
// tests can verify per-MIC scoping without ambiguity.
// ---------------------------------------------------------------------------

export const MULTI_MIC_P775_KEYS = {
  material_id: '20372893',
  material_name: 'UAT MULTI-MIC CANDIDATE',
  plant_id: 'P775',
  plant_name: 'Kerry UAT Plant P775',
  operation_id: '00000001',
} as const

interface MultiMicSeed {
  readonly mic_id: string
  readonly mic_name: string
  readonly batch_id: string
  readonly batch_date: string
  readonly value: number
}

const multiMicSeeds: readonly MultiMicSeed[] = [
  { mic_id: '0030', mic_name: 'MIC 0030', batch_id: 'B-MM-30-3001', batch_date: '2026-04-10', value: 10.1 },
  { mic_id: '0040', mic_name: 'MIC 0040', batch_id: 'B-MM-40-3002', batch_date: '2026-04-10', value: 20.2 },
  { mic_id: '0050', mic_name: 'MIC 0050', batch_id: 'B-MM-50-3003', batch_date: '2026-04-10', value: 30.3 },
  { mic_id: '0060', mic_name: 'MIC 0060', batch_id: 'B-MM-60-3004', batch_date: '2026-04-10', value: 40.4 },
  { mic_id: '0070', mic_name: 'MIC 0070', batch_id: 'B-MM-70-3005', batch_date: '2026-04-10', value: 50.5 },
]

export const subgroupRows_MultiMic_P775: readonly VerifiedSubgroupMvRow[] = multiMicSeeds.map(
  (seed): VerifiedSubgroupMvRow => ({
    ...MULTI_MIC_P775_KEYS,
    mic_id: seed.mic_id,
    mic_name: seed.mic_name,
    batch_id: seed.batch_id,
    batch_date: seed.batch_date,
    first_posting_date: seed.batch_date,
    last_posting_date: seed.batch_date,
    value: seed.value,
    batch_n: 1,
    sum_value: seed.value,
    sum_squares: seed.value * seed.value,
    min_value: seed.value,
    max_value: seed.value,
    batch_range: 0,
    any_rejection: false,
    any_acceptance: true,
    lsl_spec: 0,
    usl_spec: 0,
    spec_type: 'two-sided',
    nominal_target: null,
    tolerance_half_width: null,
    raw_tolerance: null,
    spec_signature: `mm-spec-${seed.mic_id}`,
    normality_type: 'normal',
    normality_method: 'shapiro',
    normality_signature: `sig-mm-${seed.mic_id}`,
    unified_mic_key: `umk-mm-p775-${seed.mic_id}`,
    subgroup_rep: null,
  }),
)

export const lockedLimitRows_MultiMic_P775: readonly VerifiedLockedLimitsRow[] = []

// ---------------------------------------------------------------------------
// Candidate 4 — Sentinel-plant / blank-material exclusion cases
//
// `P999` is the verified sentinel/aggregate plant and rows with blank or null
// `material_id` exist in the source. Mapper helpers MUST exclude both
// patterns; tests use these fixtures to lock that behaviour.
// ---------------------------------------------------------------------------

/**
 * A `P999` sentinel row. Must be excluded by `isEligibleSpcProductionRow`.
 */
export const sentinelRow_P999: VerifiedSubgroupMvRow = {
  material_id: '90099999',
  material_name: 'P999 SENTINEL — AGGREGATE',
  plant_id: 'P999',
  plant_name: 'Aggregate sentinel',
  mic_id: '0010',
  mic_name: 'Aggregate metric',
  operation_id: '00000001',
  batch_id: 'B-AGG-1',
  batch_date: '2026-04-01',
  first_posting_date: '2026-04-01',
  last_posting_date: '2026-04-01',
  value: 0,
  batch_n: 1,
  sum_value: 0,
  sum_squares: 0,
  min_value: 0,
  max_value: 0,
  batch_range: 0,
  any_rejection: false,
  any_acceptance: false,
  lsl_spec: 0,
  usl_spec: 0,
  spec_type: 'none',
  nominal_target: null,
  tolerance_half_width: null,
  raw_tolerance: null,
  spec_signature: '',
  normality_type: null,
  normality_method: null,
  normality_signature: null,
  unified_mic_key: 'umk-p999',
  subgroup_rep: null,
}

/**
 * A row with blank `material_id`. Must be excluded by
 * `isEligibleSpcProductionRow`.
 */
export const blankMaterialRow: VerifiedSubgroupMvRow = {
  material_id: '',
  material_name: 'BLANK MATERIAL ROW',
  plant_id: 'P523',
  plant_name: 'Ste. Claire [MFG]',
  mic_id: '0010',
  mic_name: 'pH',
  operation_id: '00000004',
  batch_id: 'B-BLANK-1',
  batch_date: '2026-04-01',
  first_posting_date: '2026-04-01',
  last_posting_date: '2026-04-01',
  value: 7.4,
  batch_n: 1,
  sum_value: 7.4,
  sum_squares: 54.76,
  min_value: 7.4,
  max_value: 7.4,
  batch_range: 0,
  any_rejection: false,
  any_acceptance: true,
  lsl_spec: 7.2,
  usl_spec: 7.8,
  spec_type: 'two-sided',
  nominal_target: 7.5,
  tolerance_half_width: 0.3,
  raw_tolerance: 0.6,
  spec_signature: 'ph-72-78',
  normality_type: 'normal',
  normality_method: 'shapiro',
  normality_signature: 'sig-blank',
  unified_mic_key: 'umk-blank',
  subgroup_rep: null,
}

/**
 * Two ineligible rows packaged together for table-driven exclusion tests.
 */
export const ineligibleProductionRows: readonly VerifiedSubgroupMvRow[] = [
  sentinelRow_P999,
  blankMaterialRow,
]

// ---------------------------------------------------------------------------
// Convenience bundles for tests
// ---------------------------------------------------------------------------

/**
 * All verified subgroup rows in one array — useful for tests that exercise
 * eligibility filtering end-to-end (mix of eligible and ineligible rows).
 */
export const allVerifiedSubgroupRows: readonly VerifiedSubgroupMvRow[] = [
  ...subgroupRows_Salt_C037,
  ...subgroupRows_Ph_P523,
  ...subgroupRows_MultiMic_P775,
  ...ineligibleProductionRows,
]

/**
 * All verified locked-limit rows in one array. Only the Salt candidate has
 * a row in UAT; the others are documented absences (empty arrays).
 */
export const allVerifiedLockedLimitRows: readonly VerifiedLockedLimitsRow[] = [
  lockedLimitRow_Salt_C037,
]
