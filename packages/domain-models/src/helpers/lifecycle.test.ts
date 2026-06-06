import { describe, it, expect } from 'vitest'
import { isVisible, isNavigable } from './lifecycle.js'

describe('isVisible', () => {
  it('returns true for live', () => {
    expect(isVisible('live')).toBe(true)
  })

  it('returns true for pilot', () => {
    expect(isVisible('pilot')).toBe(true)
  })

  it('returns false for concept-lab', () => {
    expect(isVisible('concept-lab')).toBe(false)
  })

  it('returns false for deprecated', () => {
    expect(isVisible('deprecated')).toBe(false)
  })

  it('returns false for hidden', () => {
    expect(isVisible('hidden')).toBe(false)
  })
})

describe('isNavigable', () => {
  it('returns true for live', () => {
    expect(isNavigable('live')).toBe(true)
  })

  it('returns true for pilot', () => {
    expect(isNavigable('pilot')).toBe(true)
  })

  it('returns true for concept-lab', () => {
    expect(isNavigable('concept-lab')).toBe(true)
  })

  it('returns false for deprecated', () => {
    expect(isNavigable('deprecated')).toBe(false)
  })

  it('returns false for hidden', () => {
    expect(isNavigable('hidden')).toBe(false)
  })
})
