import { describe, it, expect } from 'vitest'
import { shapiroWilk, computeCapability } from './calculations.js'
import type { SpecConfig } from './spc-types.js'

describe('Shapiro-Wilk Normality Test & Percentile Capability Fallback', () => {
  describe('shapiroWilk', () => {
    it('correctly identifies normally distributed data', () => {
      // Generated from a normal distribution
      const normalData = [
        6.55, 6.60, 6.52, 6.63, 6.57, 6.70, 6.75, 6.81, 6.92,
        6.45, 6.50, 6.48, 6.53, 6.47, 6.60, 6.65, 6.71, 6.82,
        6.58, 6.61, 6.54, 6.64, 6.59, 6.72, 6.77, 6.83, 6.94
      ]
      const result = shapiroWilk(normalData)
      expect(result.is_normal).toBe(true)
      expect(result.p_value).toBeGreaterThan(0.05)
    })

    it('identifies highly skewed/non-normal data', () => {
      // Extremely skewed, highly non-normal dataset
      const nonNormalData = [
        1.0, 1.1, 1.2, 1.1, 1.0, 1.3, 1.1, 1.2, 1.0,
        1.2, 1.1, 1.0, 1.1, 1.2, 1.0, 1.1, 1.2, 50.0,
        60.0, 70.0, 80.0, 90.0, 100.0, 150.0, 200.0, 250.0
      ]
      const result = shapiroWilk(nonNormalData)
      expect(result.is_normal).toBe(false)
      expect(result.p_value).toBeLessThan(0.05)
    })

    it('returns warning when sample count is less than 3', () => {
      const result = shapiroWilk([1, 2])
      expect(result.is_normal).toBeNull()
      expect(result.p_value).toBeNull()
      expect(result.warning).toContain('Sample size')
    })
  })

  describe('computeCapability with Normality Fallback', () => {
    const specConfig: SpecConfig = {
      spec_type: 'bilateral_symmetric',
      nominal: 6.5,
      tolerance: 0.5, // USL = 7.0, LSL = 6.0
      usl: 7.0,
      lsl: 6.0,
    }

    it('uses standard parametric capability when data is normal', () => {
      const normalData = [
        6.55, 6.60, 6.52, 6.63, 6.57, 6.70, 6.75, 6.81, 6.92,
        6.45, 6.50, 6.48, 6.53, 6.47, 6.60, 6.65, 6.71, 6.82,
        6.58, 6.61, 6.54, 6.64, 6.59, 6.72, 6.77, 6.83, 6.94
      ]
      
      const cap = computeCapability(normalData, specConfig, 0.1)
      expect(cap.capabilityMethod).toBe('parametric')
      expect(cap.cp).toBeCloseTo(1.6667, 2)
      expect(cap.normality?.is_normal).toBe(true)
    })

    it('triggers percentile-based capability fallback when data is non-normal', () => {
      // Highly non-normal dataset (long upper tail)
      const nonNormalData = [
        6.1, 6.1, 6.2, 6.1, 6.1, 6.2, 6.1, 6.2, 6.1,
        6.2, 6.1, 6.1, 6.1, 6.2, 6.1, 6.1, 6.2, 8.5,
        8.9, 9.2, 9.5, 9.8, 10.0, 11.5, 12.0, 12.5
      ]

      const cap = computeCapability(nonNormalData, specConfig, 0.1)
      expect(cap.capabilityMethod).toBe('non_parametric')
      expect(cap.normality?.is_normal).toBe(false)
      expect(cap.pp).not.toBeNull()
      expect(cap.ppk).not.toBeNull()
      expect(cap.cp).toBe(cap.pp)
      expect(cap.cpk).toBe(cap.ppk)
    })
  })
})
