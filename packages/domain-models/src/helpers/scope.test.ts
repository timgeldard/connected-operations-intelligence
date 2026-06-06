import { describe, it, expect } from 'vitest'
import { scopeIncludes } from './scope.js'
import type { ScopePolicy } from '../types/scope.js'

const makeScopePolicy = (supportedLevels: ScopePolicy['supportedLevels']): ScopePolicy => ({
  supportedLevels,
  defaultLevel: supportedLevels[0] ?? 'plant',
  autoElevate: false,
})

describe('scopeIncludes', () => {
  it('returns true when the level is in supportedLevels', () => {
    const policy = makeScopePolicy(['plant', 'line'])
    expect(scopeIncludes(policy, 'plant')).toBe(true)
  })

  it('returns false when the level is not in supportedLevels', () => {
    const policy = makeScopePolicy(['plant', 'line'])
    expect(scopeIncludes(policy, 'region')).toBe(false)
  })

  it('works with a single-element supportedLevels', () => {
    const policy = makeScopePolicy(['global'])
    expect(scopeIncludes(policy, 'global')).toBe(true)
    expect(scopeIncludes(policy, 'plant')).toBe(false)
  })

  it('works with a multi-element supportedLevels — all members match', () => {
    const policy = makeScopePolicy(['plant', 'line', 'work-centre'])
    expect(scopeIncludes(policy, 'plant')).toBe(true)
    expect(scopeIncludes(policy, 'line')).toBe(true)
    expect(scopeIncludes(policy, 'work-centre')).toBe(true)
  })

  it('works with a multi-element supportedLevels — non-member does not match', () => {
    const policy = makeScopePolicy(['plant', 'line', 'work-centre'])
    expect(scopeIncludes(policy, 'batch')).toBe(false)
  })
})
