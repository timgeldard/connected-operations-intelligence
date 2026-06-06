/**
 * SPC Client-Side Rule Detection Engine
 *
 * @remarks
 * This module is a faithful TypeScript port of V1's
 * `apps/spc/frontend/src/spc/calculations.runtime.ts`.
 *
 * It provides pure functions for detecting Western Electric (WECO) and Nelson
 * rule violations from raw control chart subgroup data. No network calls are
 * made; this runs entirely in the browser/React render cycle.
 *
 * This matches V1's architecture: control limits are computed from subgroup
 * data and rule violations are detected at render time, not stored in the
 * database. (`spc_quality_metrics` is a Databricks AI/BI Metric View for
 * governance dashboards, not a signal store.)
 *
 * AIAG SPC constants used:
 *   d2, c4 factors for within-subgroup sigma estimation
 *   A2 for X̄-R UCL/LCL computation
 *   A3 for X̄-S UCL/LCL computation
 *
 * @see spc-v1-source-discovery.md §5 Rule / Signal Source Discovery
 * @see spc-v2-migration-assessment.md §2.B Rule Engine
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Limits {
  /** Centre line (process mean) */
  cl: number
  /** Upper control limit */
  ucl: number
  /** Lower control limit */
  lcl: number
}

export type RuleSet = 'weco' | 'nelson'

export interface RuleViolation {
  /** Index of the offending point in the values array */
  pointIndex: number
  /** Short code, e.g. 'WE1', 'N2' */
  ruleCode: string
  /** Human-readable description of the rule */
  rule: string
  /** Severity derived from rule type */
  severity: 'critical' | 'high' | 'medium' | 'low'
}

// ---------------------------------------------------------------------------
// AIAG Control Chart Constants
// Ported from V1 spcConstants.ts
// ---------------------------------------------------------------------------

/** Subgroup size → d2 factor (for R̄ → σ̂ estimation) */
const D2: Record<number, number> = {
  2: 1.128, 3: 1.693, 4: 2.059, 5: 2.326,
  6: 2.534, 7: 2.704, 8: 2.847, 9: 2.970, 10: 3.078,
}

/** Subgroup size → A2 factor (X̄-R control limit factor) */
const A2: Record<number, number> = {
  2: 1.880, 3: 1.023, 4: 0.729, 5: 0.577,
  6: 0.483, 7: 0.419, 8: 0.373, 9: 0.337, 10: 0.308,
}

/** Subgroup size → A3 factor (X̄-S control limit factor) */
const A3: Record<number, number> = {
  2: 2.659, 3: 1.954, 4: 1.628, 5: 1.427,
  6: 1.287, 7: 1.182, 8: 1.099, 9: 1.032, 10: 0.975,
}

// ---------------------------------------------------------------------------
// Control Limit Computation
// ---------------------------------------------------------------------------

/**
 * Compute X̄-R control limits from subgroup data.
 *
 * @param means - Array of subgroup means (X̄ values)
 * @param ranges - Array of subgroup ranges (R values)
 * @param subgroupSize - Number of measurements per subgroup
 */
export function computeXbarRLimits(
  means: number[],
  ranges: number[],
  subgroupSize: number,
): Limits {
  if (means.length === 0) return { cl: 0, ucl: 0, lcl: 0 }
  const xbarBar = mean(means)
  const rBar = mean(ranges)
  const a2 = A2[subgroupSize] ?? A2[5]
  return {
    cl: xbarBar,
    ucl: xbarBar + a2 * rBar,
    lcl: xbarBar - a2 * rBar,
  }
}

/**
 * Compute I-MR (Individuals) control limits from individual values.
 *
 * @param values - Array of individual measurement values
 */
export function computeIndividualsLimits(values: number[]): Limits {
  if (values.length < 2) return { cl: 0, ucl: 0, lcl: 0 }
  const xBar = mean(values)
  const movingRanges = values.slice(1).map((v, i) => Math.abs(v - values[i]))
  const mrBar = mean(movingRanges)
  const d2 = D2[2] // always 2 for MR
  const sigmaHat = mrBar / d2
  return {
    cl: xBar,
    ucl: xBar + 3 * sigmaHat,
    lcl: xBar - 3 * sigmaHat,
  }
}

/**
 * Compute X̄-S control limits from subgroup means and standard deviations.
 */
export function computeXbarSLimits(
  means: number[],
  stdDevs: number[],
  subgroupSize: number,
): Limits {
  if (means.length === 0) return { cl: 0, ucl: 0, lcl: 0 }
  const xbarBar = mean(means)
  const sBar = mean(stdDevs)
  const a3 = A3[subgroupSize] ?? A3[5]
  return {
    cl: xbarBar,
    ucl: xbarBar + a3 * sBar,
    lcl: xbarBar - a3 * sBar,
  }
}

// ---------------------------------------------------------------------------
// Western Electric (WECO) Rules — 4 rules
// ---------------------------------------------------------------------------

/**
 * Detect Western Electric Rule violations.
 *
 * Rules (per AIAG SPC manual):
 *   WE1 — 1 point beyond 3σ
 *   WE2 — 2 of 3 consecutive points beyond 2σ (same side)
 *   WE3 — 4 of 5 consecutive points beyond 1σ (same side)
 *   WE4 — 8 consecutive points on the same side of the centre line
 */
export function detectWECORules(values: number[], limits: Limits): RuleViolation[] {
  const violations: RuleViolation[] = []
  const { cl, ucl, lcl } = limits
  const sigma = (ucl - cl) / 3

  if (sigma <= 0) return violations

  for (let i = 0; i < values.length; i++) {
    const v = values[i]

    // WE1: 1 point beyond 3σ
    if (v > ucl || v < lcl) {
      violations.push({
        pointIndex: i,
        ruleCode: 'WE1',
        rule: '1 point beyond 3σ control limit',
        severity: 'critical',
      })
    }

    // WE2: 2 of 3 consecutive points beyond 2σ (same side)
    if (i >= 2) {
      const window = [values[i - 2], values[i - 1], v]
      const aboveCount = window.filter(x => x > cl + 2 * sigma).length
      const belowCount = window.filter(x => x < cl - 2 * sigma).length
      if (aboveCount >= 2 || belowCount >= 2) {
        violations.push({
          pointIndex: i,
          ruleCode: 'WE2',
          rule: '2 of 3 consecutive points beyond 2σ',
          severity: 'high',
        })
      }
    }

    // WE3: 4 of 5 consecutive points beyond 1σ (same side)
    if (i >= 4) {
      const window = values.slice(i - 4, i + 1)
      const aboveCount = window.filter(x => x > cl + sigma).length
      const belowCount = window.filter(x => x < cl - sigma).length
      if (aboveCount >= 4 || belowCount >= 4) {
        violations.push({
          pointIndex: i,
          ruleCode: 'WE3',
          rule: '4 of 5 consecutive points beyond 1σ',
          severity: 'medium',
        })
      }
    }

    // WE4: 8 consecutive points on same side of centre line
    if (i >= 7) {
      const window = values.slice(i - 7, i + 1)
      const allAbove = window.every(x => x > cl)
      const allBelow = window.every(x => x < cl)
      if (allAbove || allBelow) {
        violations.push({
          pointIndex: i,
          ruleCode: 'WE4',
          rule: '8 consecutive points on same side of centre line',
          severity: 'medium',
        })
      }
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Nelson Rules — 8 rules
// ---------------------------------------------------------------------------

/**
 * Detect Nelson Rule violations.
 *
 * Rules (per Nelson 1984):
 *   N1 — 1 point beyond 3σ
 *   N2 — 9 consecutive points on same side of centre line
 *   N3 — 6 consecutive points trending (monotonically increasing or decreasing)
 *   N4 — 14 consecutive points alternating up/down
 *   N5 — 2 of 3 consecutive points beyond 2σ (same side)
 *   N6 — 4 of 5 consecutive points beyond 1σ (same side)
 *   N7 — 15 consecutive points within 1σ of centre line (both sides)
 *   N8 — 8 consecutive points beyond 1σ (either side, none within 1σ)
 */
export function detectNelsonRules(values: number[], limits: Limits): RuleViolation[] {
  const violations: RuleViolation[] = []
  const { cl, ucl, lcl } = limits
  const sigma = (ucl - cl) / 3

  if (sigma <= 0) return violations

  for (let i = 0; i < values.length; i++) {
    const v = values[i]

    // N1: 1 point beyond 3σ
    if (v > ucl || v < lcl) {
      violations.push({ pointIndex: i, ruleCode: 'N1', rule: '1 point beyond 3σ control limit', severity: 'critical' })
    }

    // N2: 9 consecutive points on same side
    if (i >= 8) {
      const window = values.slice(i - 8, i + 1)
      if (window.every(x => x > cl) || window.every(x => x < cl)) {
        violations.push({ pointIndex: i, ruleCode: 'N2', rule: '9 consecutive points on same side of centre line', severity: 'high' })
      }
    }

    // N3: 6 consecutive points trending
    if (i >= 5) {
      const window = values.slice(i - 5, i + 1)
      const rising = window.every((x, j) => j === 0 || x > window[j - 1])
      const falling = window.every((x, j) => j === 0 || x < window[j - 1])
      if (rising || falling) {
        violations.push({ pointIndex: i, ruleCode: 'N3', rule: '6 consecutive points trending monotonically', severity: 'medium' })
      }
    }

    // N4: 14 consecutive points alternating
    if (i >= 13) {
      const window = values.slice(i - 13, i + 1)
      const alternating = window.every((x, j) => {
        if (j === 0) return true
        const up = x > window[j - 1]
        return j % 2 === 0 ? !up : up
      })
      if (alternating) {
        violations.push({ pointIndex: i, ruleCode: 'N4', rule: '14 consecutive points alternating up/down', severity: 'low' })
      }
    }

    // N5: 2 of 3 consecutive points beyond 2σ (same side) — same as WE2
    if (i >= 2) {
      const window = [values[i - 2], values[i - 1], v]
      const aboveCount = window.filter(x => x > cl + 2 * sigma).length
      const belowCount = window.filter(x => x < cl - 2 * sigma).length
      if (aboveCount >= 2 || belowCount >= 2) {
        violations.push({ pointIndex: i, ruleCode: 'N5', rule: '2 of 3 consecutive points beyond 2σ', severity: 'high' })
      }
    }

    // N6: 4 of 5 consecutive points beyond 1σ (same side) — same as WE3
    if (i >= 4) {
      const window = values.slice(i - 4, i + 1)
      const aboveCount = window.filter(x => x > cl + sigma).length
      const belowCount = window.filter(x => x < cl - sigma).length
      if (aboveCount >= 4 || belowCount >= 4) {
        violations.push({ pointIndex: i, ruleCode: 'N6', rule: '4 of 5 consecutive points beyond 1σ', severity: 'medium' })
      }
    }

    // N7: 15 consecutive points within 1σ of centre line
    if (i >= 14) {
      const window = values.slice(i - 14, i + 1)
      if (window.every(x => Math.abs(x - cl) < sigma)) {
        violations.push({ pointIndex: i, ruleCode: 'N7', rule: '15 consecutive points within 1σ (stratification)', severity: 'low' })
      }
    }

    // N8: 8 consecutive points beyond 1σ on either side (none within 1σ)
    if (i >= 7) {
      const window = values.slice(i - 7, i + 1)
      if (window.every(x => Math.abs(x - cl) > sigma)) {
        violations.push({ pointIndex: i, ruleCode: 'N8', rule: '8 consecutive points beyond 1σ (mixture)', severity: 'low' })
      }
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Public API (mirrors V1 calculations.runtime.ts)
// ---------------------------------------------------------------------------

/**
 * Detect rule violations using either WECO (4 rules) or Nelson (8 rules).
 * This is the primary entry point, matching V1's `detectRules()` signature.
 */
export function detectRules(
  values: number[],
  limits: Limits,
  ruleSet: RuleSet = 'weco',
): RuleViolation[] {
  return ruleSet === 'nelson'
    ? detectNelsonRules(values, limits)
    : detectWECORules(values, limits)
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
