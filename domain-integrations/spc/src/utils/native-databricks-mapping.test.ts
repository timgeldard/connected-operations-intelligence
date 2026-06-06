/**
 * Tests for the pure native SPC Databricks mapping helpers.
 *
 * These tests lock the verified-schema mapping behaviour from PR #65 and the
 * boundaries documented in
 * domain-integrations/spc/docs/spc-native-contract-alignment-audit.md.
 *
 * Important things these tests guard against:
 *  - reintroducing old V1 wire field names (`result_value`, `sample_id`,
 *    `sample_timestamp`, `subgroup_mean`, `subgroup_range`, `subgroup_sd`,
 *    `unit_of_measure`) as required fields on either the verified row
 *    interfaces or the mapper output;
 *  - confusing specification limits with control limits;
 *  - overclaiming approval, signal-in-control state, or capability values.
 */

import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  isEligibleSpcProductionRow,
  filterEligibleSpcProductionRows,
  classifyPlantNamespace,
  deriveSubgroupPoint,
  deriveSubgroupPoints,
  mapLockedLimitRow,
  deriveSpecificationLimits,
  classifySignalSource,
  classifyCapabilitySource,
  type DerivedSubgroupPoint,
  type MappedLockedLimitRow,
} from './native-databricks-mapping.js'
import {
  subgroupRows_Salt_C037,
  subgroupRows_Ph_P523,
  subgroupRows_MultiMic_P775,
  lockedLimitRow_Salt_C037,
  sentinelRow_P999,
  blankMaterialRow,
  ineligibleProductionRows,
  allVerifiedSubgroupRows,
  type VerifiedSubgroupMvRow,
  type VerifiedLockedLimitsRow,
} from '../fixtures/verified-databricks-spc.js'

// ---------------------------------------------------------------------------
// Field-name guard: VerifiedSubgroupMvRow must NOT carry old V1 wire names
// ---------------------------------------------------------------------------

describe('verified-schema field-name guards', () => {
  it('VerifiedSubgroupMvRow does not include result_value / sample_id / sample_timestamp / subgroup_mean / subgroup_range / subgroup_sd / unit_of_measure', () => {
    // The keys() helper is exercised at runtime, but the real guard is the
    // type-level check below — these names must NOT be assignable to
    // keyof VerifiedSubgroupMvRow.
    type ForbiddenV1Key =
      | 'result_value'
      | 'sample_id'
      | 'sample_timestamp'
      | 'subgroup_mean'
      | 'subgroup_range'
      | 'subgroup_sd'
      | 'unit_of_measure'

    type Intersect = Extract<keyof VerifiedSubgroupMvRow, ForbiddenV1Key>
    expectTypeOf<Intersect>().toEqualTypeOf<never>()

    const sample = subgroupRows_Salt_C037[0]!
    const keys = Object.keys(sample)
    for (const forbidden of [
      'result_value',
      'sample_id',
      'sample_timestamp',
      'subgroup_mean',
      'subgroup_range',
      'subgroup_sd',
      'unit_of_measure',
    ]) {
      expect(keys).not.toContain(forbidden)
    }
  })

  it('VerifiedSubgroupMvRow exposes the verified native column names', () => {
    type Required =
      | 'material_id'
      | 'plant_id'
      | 'mic_id'
      | 'operation_id'
      | 'batch_id'
      | 'batch_date'
      | 'value'
      | 'batch_n'
      | 'sum_value'
      | 'sum_squares'
      | 'batch_range'
      | 'min_value'
      | 'max_value'
      | 'any_rejection'
      | 'any_acceptance'
      | 'lsl_spec'
      | 'usl_spec'

    type Missing = Exclude<Required, keyof VerifiedSubgroupMvRow>
    expectTypeOf<Missing>().toEqualTypeOf<never>()
  })

  it('VerifiedLockedLimitsRow uses baseline_from/baseline_to (NOT effective_from/effective_to)', () => {
    type ForbiddenKey =
      | 'effective_from'
      | 'effective_to'
      | 'provenance'
      | 'usl'
      | 'lsl'

    type Intersect = Extract<keyof VerifiedLockedLimitsRow, ForbiddenKey>
    expectTypeOf<Intersect>().toEqualTypeOf<never>()

    type Required =
      | 'baseline_from'
      | 'baseline_to'
      | 'locking_note'
      | 'cl'
      | 'ucl'
      | 'lcl'
      | 'ucl_r'
      | 'lcl_r'
      | 'sigma_within'

    type Missing = Exclude<Required, keyof VerifiedLockedLimitsRow>
    expectTypeOf<Missing>().toEqualTypeOf<never>()
  })

  it('mapper output does not expose subgroupMean as a V1-wire-name alias', () => {
    const point = deriveSubgroupPoint([subgroupRows_Salt_C037[0]!])
    const keys = Object.keys(point)
    expect(keys).toContain('subgroupMean')
    // No legacy snake_case spilled through:
    expect(keys).not.toContain('subgroup_mean')
    expect(keys).not.toContain('subgroup_range')
    expect(keys).not.toContain('result_value')
  })
})

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

describe('isEligibleSpcProductionRow / filterEligibleSpcProductionRows', () => {
  it('excludes P999 sentinel plant rows', () => {
    expect(isEligibleSpcProductionRow(sentinelRow_P999)).toBe(false)
  })

  it('excludes blank material_id rows', () => {
    expect(isEligibleSpcProductionRow(blankMaterialRow)).toBe(false)
  })

  it('preserves valid C-prefix plant rows', () => {
    for (const row of subgroupRows_Salt_C037) {
      expect(row.plant_id).toBe('C037')
      expect(isEligibleSpcProductionRow(row)).toBe(true)
    }
  })

  it('preserves valid P-prefix plant rows (other than P999)', () => {
    for (const row of subgroupRows_Ph_P523) {
      expect(row.plant_id).toBe('P523')
      expect(isEligibleSpcProductionRow(row)).toBe(true)
    }
  })

  it('partitions a mixed set into eligible + reasoned exclusions', () => {
    const result = filterEligibleSpcProductionRows(allVerifiedSubgroupRows)
    expect(result.excluded).toHaveLength(ineligibleProductionRows.length)
    const reasons = result.excluded.map(e => e.reason).sort()
    expect(reasons).toEqual(['blank-material-id', 'sentinel-plant-p999'])
    expect(result.eligible.every(r => r.plant_id !== 'P999')).toBe(true)
    expect(result.eligible.every(r => r.material_id.trim() !== '')).toBe(true)
  })

  it('treats whitespace-only material_id as blank', () => {
    const whitespaceRow: VerifiedSubgroupMvRow = { ...blankMaterialRow, material_id: '   ' }
    expect(isEligibleSpcProductionRow(whitespaceRow)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Plant namespace
// ---------------------------------------------------------------------------

describe('classifyPlantNamespace', () => {
  it('classifies P-prefix and C-prefix', () => {
    expect(classifyPlantNamespace('P523')).toBe('P-prefix')
    expect(classifyPlantNamespace('C037')).toBe('C-prefix')
  })

  it('classifies unknown and empty inputs', () => {
    expect(classifyPlantNamespace('XYZ')).toBe('unknown')
    expect(classifyPlantNamespace('')).toBe('unknown')
    expect(classifyPlantNamespace(null)).toBe('unknown')
    expect(classifyPlantNamespace(undefined)).toBe('unknown')
  })

  it('does NOT alias P999 to a valid namespace by special-casing', () => {
    // P999 is still P-prefix lexically — eligibility filtering is the
    // separate exclusion mechanism. Tests that combine both helpers should
    // confirm that classification + eligibility together yield "P-prefix
    // sentinel excluded".
    expect(classifyPlantNamespace('P999')).toBe('P-prefix')
    expect(isEligibleSpcProductionRow(sentinelRow_P999)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Subgroup-point derivation
// ---------------------------------------------------------------------------

describe('deriveSubgroupPoint', () => {
  it('derives subgroupMean = sum_value / batch_n for the pH 5-sample batch', () => {
    const batch2001 = subgroupRows_Ph_P523.filter(r => r.batch_id === 'B-PH-2001')
    expect(batch2001).toHaveLength(5)
    const point = deriveSubgroupPoint(batch2001)
    expect(point.sampleCount).toBe(5)
    expect(point.subgroupMean).not.toBeNull()
    expect(point.subgroupMean!).toBeCloseTo(7.486, 3)
    // batch_range is the verified column, not derived from min/max here:
    expect(point.subgroupRange).toBe(batch2001[0]!.batch_range)
  })

  it('returns subgroupStdDev derived from sum_squares for batch_n >= 2', () => {
    const batch2001 = subgroupRows_Ph_P523.filter(r => r.batch_id === 'B-PH-2001')
    const point = deriveSubgroupPoint(batch2001)
    expect(point.subgroupStdDev).not.toBeNull()
    // Sample stddev of [7.45, 7.51, 7.48, 7.47, 7.52] is small but > 0:
    expect(point.subgroupStdDev!).toBeGreaterThan(0)
    expect(point.subgroupStdDev!).toBeLessThan(0.1)
  })

  it('treats batch_n = 1 as "stddev unavailable" without throwing', () => {
    const point = deriveSubgroupPoint([subgroupRows_Salt_C037[0]!])
    expect(point.sampleCount).toBe(1)
    expect(point.subgroupStdDev).toBeNull()
    const codes = point.warnings.map(w => w.code)
    expect(codes).toContain('sample-count-below-two-stddev-unavailable')
  })

  it('returns subgroupMean=null and a warning when batch_n is zero', () => {
    const head = subgroupRows_Salt_C037[0]!
    const zeroNRow: VerifiedSubgroupMvRow = {
      ...head,
      batch_n: 0,
      sum_value: 0,
      sum_squares: 0,
    }
    const point = deriveSubgroupPoint([zeroNRow])
    expect(point.subgroupMean).toBeNull()
    expect(point.warnings.map(w => w.code)).toContain('batch-n-zero')
  })

  it('treats `value` as the individual measurement (NOT the subgroup mean)', () => {
    // Build a batch where individual values differ from sum_value/batch_n so
    // the test fails if someone accidentally maps `value` to subgroupMean.
    const head = subgroupRows_Salt_C037[0]!
    const rows: VerifiedSubgroupMvRow[] = [
      { ...head, batch_id: 'B-V-1', batch_n: 3, sum_value: 9, sum_squares: 29, value: 2 },
      { ...head, batch_id: 'B-V-1', batch_n: 3, sum_value: 9, sum_squares: 29, value: 3 },
      { ...head, batch_id: 'B-V-1', batch_n: 3, sum_value: 9, sum_squares: 29, value: 4 },
    ]
    const point = deriveSubgroupPoint(rows)
    expect(point.subgroupMean).toBe(3) // 9 / 3
    expect(point.individualValues).toEqual([2, 3, 4])
    // If someone wrongly mapped `value` to subgroupMean, the first row would
    // have produced 2 — this assertion catches that regression.
    expect(point.subgroupMean).not.toBe(rows[0]!.value)
  })

  it('uses batch_range as the verified subgroupRange (not max - min)', () => {
    // Construct a batch where batch_range deliberately differs from
    // max(value) - min(value) so a regression that recomputes from values is
    // detected.
    const head = subgroupRows_Salt_C037[0]!
    const rows: VerifiedSubgroupMvRow[] = [
      { ...head, batch_id: 'B-R-1', batch_n: 3, sum_value: 9, sum_squares: 29, value: 2, min_value: 2, max_value: 4, batch_range: 9.99 },
      { ...head, batch_id: 'B-R-1', batch_n: 3, sum_value: 9, sum_squares: 29, value: 3, min_value: 2, max_value: 4, batch_range: 9.99 },
      { ...head, batch_id: 'B-R-1', batch_n: 3, sum_value: 9, sum_squares: 29, value: 4, min_value: 2, max_value: 4, batch_range: 9.99 },
    ]
    const point = deriveSubgroupPoint(rows)
    expect(point.subgroupRange).toBe(9.99)
    expect(point.subgroupRange).not.toBe(point.maxValue - point.minValue)
  })

  it('uses batch_date as the chart time axis (not first/last posting date)', () => {
    const head = subgroupRows_Salt_C037[0]!
    expect(head.batch_date).not.toBeNull()
    const point = deriveSubgroupPoint([head])
    expect(point.batchDate).toBe(head.batch_date)
  })

  it('throws RangeError on an empty input array (programmer error)', () => {
    expect(() => deriveSubgroupPoint([])).toThrow(RangeError)
  })

  it('warns when sourceRowCount differs from batch_n (deduplication needed)', () => {
    const head = subgroupRows_Ph_P523[0]!
    const rows = [head, head, head] // batch_n is 5; 3 rows; mismatch
    const point = deriveSubgroupPoint(rows)
    expect(point.sourceRowCount).toBe(3)
    expect(point.sampleCount).toBe(5)
    expect(point.warnings.map(w => w.code)).toContain('source-row-count-mismatch')
  })

  it('warns when grouped rows do not share the same composite key', () => {
    const mixed = [subgroupRows_Ph_P523[0]!, subgroupRows_Salt_C037[0]!]
    const point = deriveSubgroupPoint(mixed)
    expect(point.warnings.map(w => w.code)).toContain('mixed-batch-grouping')
  })
})

describe('deriveSubgroupPoints', () => {
  it('groups by (material_id, plant_id, mic_id, operation_id, batch_id) and produces one point per batch', () => {
    const points = deriveSubgroupPoints(subgroupRows_Ph_P523)
    expect(points).toHaveLength(4) // 4 distinct batches in the fixture
    const ids = points.map(p => p.batchId)
    expect(new Set(ids).size).toBe(4)
  })

  it('orders output by batchDate then batchId', () => {
    const points = deriveSubgroupPoints(subgroupRows_Ph_P523)
    for (let i = 1; i < points.length; i++) {
      expect(points[i]!.batchDate >= points[i - 1]!.batchDate).toBe(true)
    }
  })

  it('keeps multi-MIC rows scoped per MIC (one point per MIC + batch)', () => {
    const points = deriveSubgroupPoints(subgroupRows_MultiMic_P775)
    expect(points).toHaveLength(5)
    expect(new Set(points.map(p => p.micId))).toEqual(new Set(['0030', '0040', '0050', '0060', '0070']))
  })

  it('does NOT pre-filter sentinels (caller responsibility)', () => {
    // deriveSubgroupPoints accepts the mix; eligibility filtering is a
    // separate step. This is the contract the future native route depends on.
    const points = deriveSubgroupPoints([sentinelRow_P999])
    expect(points).toHaveLength(1)
    expect(points[0]!.plantId).toBe('P999')
  })
})

// ---------------------------------------------------------------------------
// Locked-limit mapping
// ---------------------------------------------------------------------------

describe('mapLockedLimitRow', () => {
  it('reads baseline_from/baseline_to (NOT effective_from/effective_to)', () => {
    const mapped = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    expect(mapped.baselineFrom).toBe(lockedLimitRow_Salt_C037.baseline_from)
    expect(mapped.baselineTo).toBe(lockedLimitRow_Salt_C037.baseline_to)
    // The mapped object must not carry effective_* keys at all:
    expect(Object.keys(mapped)).not.toContain('effectiveFrom')
    expect(Object.keys(mapped)).not.toContain('effectiveTo')
  })

  it('maps cl/ucl/lcl/ucl_r/lcl_r/sigma_within verbatim', () => {
    const mapped = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    expect(mapped.cl).toBe(3.243357541899438)
    expect(mapped.ucl).toBe(5.54117633384574)
    expect(mapped.lcl).toBe(0.945538749953136)
    expect(mapped.uclR).toBe(2.822622221476501)
    expect(mapped.lclR).toBe(0.0)
    expect(mapped.sigmaWithin).toBe(0.7659395973154339)
  })

  it('maps locked_by + locked_at as lock provenance, NOT governed approval', () => {
    const mapped = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    expect(mapped.lockedBy).toBe('domhnall.odonovan@kerry.ie')
    expect(mapped.lockedAt).toBe('2026-04-06T19:06:02.716Z')
    expect(mapped.provenanceStatus).toBe('uat-fixture-only')
    expect(mapped.provenanceStatus).not.toBe('locked-limit-present')
  })

  it('emits "uat-fixture-only" when baseline window and note are all empty', () => {
    const mapped = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    expect(mapped.provenanceStatus).toBe('uat-fixture-only')
    expect(mapped.warnings.some(w => /UAT fixture/i.test(w))).toBe(true)
  })

  it('emits "approval-not-governed" when locked_by is set with a baseline window but no governance evidence', () => {
    const withBaseline: VerifiedLockedLimitsRow = {
      ...lockedLimitRow_Salt_C037,
      baseline_from: '2026-01-01',
      baseline_to: '2026-12-31',
    }
    const mapped = mapLockedLimitRow(withBaseline)
    expect(mapped.provenanceStatus).toBe('approval-not-governed')
    expect(mapped.warnings.some(w => /no governed approval/i.test(w))).toBe(true)
  })

  it('never emits "locked-limit-present" from a locked_by-only signal', () => {
    // Iterate over a few configurations to confirm the "governed approval"
    // status is reserved and not produced by any current code path.
    const configs: readonly Partial<VerifiedLockedLimitsRow>[] = [
      {}, // verbatim
      { baseline_from: '2026-01-01' },
      { baseline_to: '2026-12-31' },
      { locking_note: 'some note' },
      { baseline_from: '2026-01-01', baseline_to: '2026-12-31', locking_note: 'governed' },
    ]
    for (const cfg of configs) {
      const row: VerifiedLockedLimitsRow = { ...lockedLimitRow_Salt_C037, ...cfg }
      const mapped = mapLockedLimitRow(row)
      expect(mapped.provenanceStatus).not.toBe('locked-limit-present')
    }
  })

  it('preserves the chart_type column value verbatim (not yet renamed to V2 enum)', () => {
    const mapped = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    expect(mapped.chartType).toBe('imr') // V2 enum rename to 'individuals' happens elsewhere
  })

  it('does NOT expose usl/lsl columns on locked-limit mapping (spec limits live elsewhere)', () => {
    const keys = Object.keys(mapLockedLimitRow(lockedLimitRow_Salt_C037))
    expect(keys).not.toContain('usl')
    expect(keys).not.toContain('lsl')
    expect(keys).not.toContain('upperSpecLimit')
    expect(keys).not.toContain('lowerSpecLimit')
  })
})

// ---------------------------------------------------------------------------
// Specification limits
// ---------------------------------------------------------------------------

describe('deriveSpecificationLimits', () => {
  it('treats (0, 0) as not-populated, NOT as a literal [0,0] band', () => {
    const result = deriveSpecificationLimits(subgroupRows_Salt_C037[0]!)
    expect(result.sourceStatus).toBe('not-populated-zero-zero')
    expect(result.lowerSpecLimit).toBeNull()
    expect(result.upperSpecLimit).toBeNull()
    expect(result.warnings.some(w => /not populated/i.test(w))).toBe(true)
  })

  it('surfaces populated spec limits (7.2 / 7.8 for pH candidate)', () => {
    const result = deriveSpecificationLimits(subgroupRows_Ph_P523[0]!)
    expect(result.sourceStatus).toBe('present')
    expect(result.lowerSpecLimit).toBe(7.2)
    expect(result.upperSpecLimit).toBe(7.8)
    expect(result.nominalTarget).toBe(7.5)
    expect(result.toleranceHalfWidth).toBe(0.3)
    expect(result.rawTolerance).toBe(0.6)
    expect(result.specSignature).toBe('ph-72-78')
    expect(result.specType).toBe('two-sided')
  })

  it('handles one-sided specs (upper-only)', () => {
    const head = subgroupRows_Salt_C037[0]!
    const row: VerifiedSubgroupMvRow = { ...head, lsl_spec: 0, usl_spec: 100 }
    const result = deriveSpecificationLimits(row)
    expect(result.sourceStatus).toBe('upper-only')
    expect(result.lowerSpecLimit).toBeNull()
    expect(result.upperSpecLimit).toBe(100)
  })

  it('handles one-sided specs (lower-only)', () => {
    const head = subgroupRows_Salt_C037[0]!
    const row: VerifiedSubgroupMvRow = { ...head, lsl_spec: 5, usl_spec: 0 }
    const result = deriveSpecificationLimits(row)
    expect(result.sourceStatus).toBe('lower-only')
    expect(result.lowerSpecLimit).toBe(5)
    expect(result.upperSpecLimit).toBeNull()
  })

  it('is structurally distinct from locked-limit mapping (no overlap of cl/ucl/lcl)', () => {
    // Spec limits and control limits must never bleed into each other. The
    // mapped spec result must not expose centerLine/ucl/lcl-like keys.
    const result = deriveSpecificationLimits(subgroupRows_Ph_P523[0]!)
    const keys = Object.keys(result)
    expect(keys).not.toContain('cl')
    expect(keys).not.toContain('centerLine')
    expect(keys).not.toContain('ucl')
    expect(keys).not.toContain('lcl')
    expect(keys).not.toContain('upperControlLimit')
    expect(keys).not.toContain('lowerControlLimit')
  })
})

// ---------------------------------------------------------------------------
// Signal-source classification
// ---------------------------------------------------------------------------

describe('classifySignalSource', () => {
  it('storedSourceAvailable is always false (no spc_nelson_rule_flags_mv)', () => {
    const cases = [
      classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: true }),
      classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: false }),
      classifySignalSource({ chartDataLoaded: false, ruleDetectionRan: false }),
      classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: true, calculationLocation: 'backend' }),
    ]
    for (const c of cases) {
      expect(c.storedSourceAvailable).toBe(false)
    }
  })

  it('returns unavailable when chart data is not loaded', () => {
    const c = classifySignalSource({ chartDataLoaded: false, ruleDetectionRan: false })
    expect(c.status).toBe('unavailable')
  })

  it('returns not-yet-evaluated when chart data is loaded but rule detection has not run', () => {
    const c = classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: false })
    expect(c.status).toBe('not-yet-evaluated')
  })

  it('returns calculated-frontend by default', () => {
    const c = classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: true })
    expect(c.status).toBe('calculated-frontend')
  })

  it('returns calculated-backend when calculationLocation === "backend"', () => {
    const c = classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: true, calculationLocation: 'backend' })
    expect(c.status).toBe('calculated-backend')
  })

  it('NEVER returns an "in-control" or "all clear" status', () => {
    const cases = [
      classifySignalSource({ chartDataLoaded: false, ruleDetectionRan: false }),
      classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: false }),
      classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: true }),
      classifySignalSource({ chartDataLoaded: true, ruleDetectionRan: true, calculationLocation: 'backend' }),
    ]
    for (const c of cases) {
      expect(c.status).not.toBe('in-control')
      expect(c.status).not.toBe('all-clear')
      expect(c.status).not.toBe('green')
    }
  })
})

// ---------------------------------------------------------------------------
// Capability-source classification
// ---------------------------------------------------------------------------

describe('classifyCapabilitySource', () => {
  it('returns unavailable when MV is missing, no backend calc authorised, no legacy bridge', () => {
    const c = classifyCapabilitySource({
      capabilityMvFound: false,
      subgroupDataAvailable: true,
      backendCalculationAuthorised: false,
      legacyBridgeAvailable: false,
    })
    expect(c.status).toBe('unavailable')
    expect(c.invents).toBe(false)
  })

  it('returns backend-calculation-required when subgroup data is available and backend is authorised', () => {
    const c = classifyCapabilitySource({
      capabilityMvFound: false,
      subgroupDataAvailable: true,
      backendCalculationAuthorised: true,
    })
    expect(c.status).toBe('backend-calculation-required')
    expect(c.availableInputs).toContain('spc_quality_metric_subgroup_mv.usl_spec')
    expect(c.availableInputs).toContain('spc_quality_metric_subgroup_mv.lsl_spec')
    expect(c.availableInputs).toContain('spc_quality_metric_subgroup_mv.sum_value')
    expect(c.availableInputs).toContain('spc_quality_metric_subgroup_mv.sum_squares')
    expect(c.availableInputs).toContain('spc_quality_metric_subgroup_mv.batch_n')
    expect(c.invents).toBe(false)
  })

  it('returns legacy-bridge when MV is missing but the V1 bridge is available', () => {
    const c = classifyCapabilitySource({
      capabilityMvFound: false,
      subgroupDataAvailable: false,
      legacyBridgeAvailable: true,
    })
    expect(c.status).toBe('legacy-bridge')
    expect(c.availableInputs).toContain('V1 /api/spc/capability')
  })

  it('returns present-from-mv when the MV is found', () => {
    const c = classifyCapabilitySource({ capabilityMvFound: true, subgroupDataAvailable: false })
    expect(c.status).toBe('present-from-mv')
  })

  it('invents: false is statically present in every branch', () => {
    const cases = [
      classifyCapabilitySource({ capabilityMvFound: true, subgroupDataAvailable: false }),
      classifyCapabilitySource({ capabilityMvFound: false, subgroupDataAvailable: true, backendCalculationAuthorised: true }),
      classifyCapabilitySource({ capabilityMvFound: false, subgroupDataAvailable: false, legacyBridgeAvailable: true }),
      classifyCapabilitySource({ capabilityMvFound: false, subgroupDataAvailable: false }),
    ]
    for (const c of cases) {
      expect(c.invents).toBe(false)
    }
  })

  it('does NOT contain any Cp/Cpk/Pp/Ppk numeric fields on the classification result', () => {
    const c = classifyCapabilitySource({ capabilityMvFound: true, subgroupDataAvailable: false })
    const keys = Object.keys(c)
    expect(keys).not.toContain('cp')
    expect(keys).not.toContain('cpk')
    expect(keys).not.toContain('pp')
    expect(keys).not.toContain('ppk')
    expect(keys).not.toContain('mean')
    expect(keys).not.toContain('standardDeviation')
  })
})

// ---------------------------------------------------------------------------
// operationId vs workCentreId
// ---------------------------------------------------------------------------

describe('operationId vs workCentreId boundary', () => {
  it('DerivedSubgroupPoint carries operationId (NOT workCentreId)', () => {
    const point: DerivedSubgroupPoint = deriveSubgroupPoint([subgroupRows_Salt_C037[0]!])
    expect(point.operationId).toBe('00000001')
    expect(Object.keys(point)).not.toContain('workCentreId')
    // Type-level guard:
    expectTypeOf<keyof DerivedSubgroupPoint>().not.toMatchTypeOf<'workCentreId'>()
  })

  it('MappedLockedLimitRow carries operationId (NOT workCentreId)', () => {
    const mapped: MappedLockedLimitRow = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    expect(mapped.operationId).toBe('00000001')
    expect(Object.keys(mapped)).not.toContain('workCentreId')
    expectTypeOf<keyof MappedLockedLimitRow>().not.toMatchTypeOf<'workCentreId'>()
  })

  it('does not auto-promote operation_id into a SAP work-centre slot under any code path', () => {
    // This is a structural assertion — there is no helper in this module that
    // emits workCentreId, so a search across the module's exports should find
    // no such name. We assert that by checking the helper outputs above.
    const point = deriveSubgroupPoint([subgroupRows_Salt_C037[0]!])
    const limits = mapLockedLimitRow(lockedLimitRow_Salt_C037)
    const allKeys = [...Object.keys(point), ...Object.keys(limits)]
    expect(allKeys).not.toContain('workCentreId')
    expect(allKeys).not.toContain('workCentre')
    expect(allKeys).not.toContain('work_centre_id')
  })
})
