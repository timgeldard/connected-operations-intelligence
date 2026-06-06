import { describe, it, expect } from 'vitest'
import {
  detectRules,
  detectWECORules,
  detectNelsonRules,
  computeIndividualsLimits,
  computeXbarRLimits,
  type Limits,
} from './calculations.runtime.js'

// Limits fixture: cl=10, ucl=13, lcl=7 → sigma=1
const LIMITS: Limits = { cl: 10, ucl: 13, lcl: 7 }

describe('calculations.runtime', () => {
  // ---------------------------------------------------------------------------
  // Control limit computation
  // ---------------------------------------------------------------------------

  describe('computeIndividualsLimits', () => {
    it('returns zero limits for empty input', () => {
      const r = computeIndividualsLimits([])
      expect(r.cl).toBe(0)
      expect(r.ucl).toBe(0)
      expect(r.lcl).toBe(0)
    })

    it('computes limits from individual values', () => {
      // Values near 10 with small variation
      const values = [9.8, 10.2, 10.0, 9.9, 10.1, 10.0, 9.8, 10.2, 10.1, 9.9]
      const limits = computeIndividualsLimits(values)
      expect(limits.cl).toBeCloseTo(10.0, 1)
      expect(limits.ucl).toBeGreaterThan(limits.cl)
      expect(limits.lcl).toBeLessThan(limits.cl)
    })
  })

  describe('computeXbarRLimits', () => {
    it('returns zero limits for empty input', () => {
      const r = computeXbarRLimits([], [], 5)
      expect(r.cl).toBe(0)
    })

    it('computes limits from means and ranges', () => {
      const means = [10, 10, 10, 10, 10]
      const ranges = [2, 2, 2, 2, 2]
      const limits = computeXbarRLimits(means, ranges, 5)
      expect(limits.cl).toBeCloseTo(10, 5)
      // A2 for n=5 is 0.577; UCL = 10 + 0.577*2 = 11.154
      expect(limits.ucl).toBeCloseTo(11.154, 2)
      expect(limits.lcl).toBeCloseTo(8.846, 2)
    })
  })

  // ---------------------------------------------------------------------------
  // WECO Rules
  // ---------------------------------------------------------------------------

  describe('detectWECORules', () => {
    it('returns no violations for in-control data', () => {
      // All values between lcl and ucl, no patterns
      const values = [10, 10.1, 9.9, 10.2, 9.8, 10, 10.1, 9.9, 10, 10.2]
      expect(detectWECORules(values, LIMITS)).toHaveLength(0)
    })

    it('WE1: detects 1 point beyond 3σ (above UCL)', () => {
      const values = [10, 10, 10, 13.5, 10] // 13.5 > UCL=13
      const violations = detectWECORules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE1' && v.pointIndex === 3)).toBe(true)
    })

    it('WE1: detects 1 point beyond 3σ (below LCL)', () => {
      const values = [10, 6.5, 10, 10, 10] // 6.5 < LCL=7
      const violations = detectWECORules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE1' && v.pointIndex === 1)).toBe(true)
    })

    it('WE1: severity is critical', () => {
      const values = [10, 14, 10]
      const violations = detectWECORules(values, LIMITS)
      expect(violations.find(v => v.ruleCode === 'WE1')?.severity).toBe('critical')
    })

    it('WE2: detects 2 of 3 points beyond 2σ above', () => {
      // sigma=1, so 2σ above = 12; put two points at 12.5
      const values = [10, 12.5, 12.5, 10, 10]
      const violations = detectWECORules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE2')).toBe(true)
    })

    it('WE3: detects 4 of 5 points beyond 1σ above', () => {
      // sigma=1, 1σ above = 11
      const values = [10, 11.5, 11.5, 11.5, 11.5, 10]
      const violations = detectWECORules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE3')).toBe(true)
    })

    it('WE4: detects 8 consecutive points on same side', () => {
      // All 8 points above cl=10
      const values = [10.1, 10.2, 10.3, 10.1, 10.2, 10.1, 10.3, 10.2]
      const violations = detectWECORules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE4')).toBe(true)
    })

    it('WE4: does not trigger with 7 points on same side', () => {
      const values = [10.1, 10.2, 10.3, 10.1, 10.2, 10.1, 10.3]
      const violations = detectWECORules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE4')).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Nelson Rules
  // ---------------------------------------------------------------------------

  describe('detectNelsonRules', () => {
    it('returns no violations for in-control data', () => {
      // Must include points outside 1σ (i.e. > 11 or < 9) so N7 doesn't fire
      const values = [10, 11.5, 9.9, 10.2, 8.5, 10, 10.1, 9.9, 10, 11.2, 10.1, 8.9, 10, 10.2, 10.1, 9.9]
      expect(detectNelsonRules(values, LIMITS)).toHaveLength(0)
    })

    it('N1: detects beyond 3σ (same as WE1)', () => {
      const values = [10, 14, 10]
      expect(detectNelsonRules(values, LIMITS).some(v => v.ruleCode === 'N1')).toBe(true)
    })

    it('N2: detects 9 consecutive points on same side', () => {
      const values = [10.1, 10.2, 10.1, 10.3, 10.2, 10.1, 10.2, 10.3, 10.1]
      expect(detectNelsonRules(values, LIMITS).some(v => v.ruleCode === 'N2')).toBe(true)
    })

    it('N3: detects 6 consecutive points trending upward', () => {
      const values = [10, 10.1, 10.2, 10.3, 10.4, 10.5]
      expect(detectNelsonRules(values, LIMITS).some(v => v.ruleCode === 'N3')).toBe(true)
    })

    it('N3: detects 6 consecutive points trending downward', () => {
      const values = [10.5, 10.4, 10.3, 10.2, 10.1, 10.0]
      expect(detectNelsonRules(values, LIMITS).some(v => v.ruleCode === 'N3')).toBe(true)
    })

    it('N7: detects 15 points within 1σ of centre (stratification)', () => {
      // sigma=1, all within 1σ of cl=10 means values between 9 and 11
      const values = Array(15).fill(0).map((_, i) => 10 + (i % 2 === 0 ? 0.4 : -0.4))
      expect(detectNelsonRules(values, LIMITS).some(v => v.ruleCode === 'N7')).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // detectRules (public API)
  // ---------------------------------------------------------------------------

  describe('detectRules', () => {
    it('defaults to WECO rules', () => {
      const values = [10, 14, 10] // triggers WE1
      const violations = detectRules(values, LIMITS)
      expect(violations.some(v => v.ruleCode === 'WE1')).toBe(true)
    })

    it('uses Nelson rules when specified', () => {
      const values = [10, 14, 10] // triggers N1
      const violations = detectRules(values, LIMITS, 'nelson')
      expect(violations.some(v => v.ruleCode === 'N1')).toBe(true)
    })

    it('returns empty array for in-control data (WECO)', () => {
      const values = [10, 10.1, 9.9, 10, 10.2, 9.8, 10.1, 9.9, 10, 10.1]
      expect(detectRules(values, LIMITS, 'weco')).toHaveLength(0)
    })

    it('returns empty array for in-control data (Nelson)', () => {
      const values = [10, 11.5, 9.9, 10.2, 8.5, 10, 10.1, 9.9, 10, 11.2, 10.1, 8.9, 10, 10.2, 10.1, 9.9]
      expect(detectRules(values, LIMITS, 'nelson')).toHaveLength(0)
    })

    it('returns RuleViolation with required fields', () => {
      const values = [10, 14, 10]
      const violations = detectRules(values, LIMITS)
      const v = violations[0]
      expect(v).toHaveProperty('pointIndex')
      expect(v).toHaveProperty('ruleCode')
      expect(v).toHaveProperty('rule')
      expect(v).toHaveProperty('severity')
    })
  })
})
