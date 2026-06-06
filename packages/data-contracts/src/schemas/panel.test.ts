import { describe, it, expect } from 'vitest'
import {
  EvidencePanelDisplayStateSchema,
  FreshnessMetadataSchema,
  ConfidenceMetadataSchema,
  EvidencePanelStateSchema,
} from './panel.js'

describe('EvidencePanelDisplayStateSchema', () => {
  const validStates = ['loading', 'ready', 'stale', 'partial', 'error', 'unauthorized', 'not-applicable', 'waiting-for-context'] as const

  for (const state of validStates) {
    it(`accepts '${state}'`, () => {
      expect(EvidencePanelDisplayStateSchema.safeParse(state).success).toBe(true)
    })
  }

  it('rejects an unknown state', () => {
    expect(EvidencePanelDisplayStateSchema.safeParse('pending').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(EvidencePanelDisplayStateSchema.safeParse('').success).toBe(false)
  })
})

describe('FreshnessMetadataSchema', () => {
  it('parses a valid freshness object', () => {
    const result = FreshnessMetadataSchema.safeParse({
      lastRefreshedAt: '2024-01-15T10:00:00.000Z',
      isStale: false,
      staleAfterSeconds: 300,
    })
    expect(result.success).toBe(true)
  })

  it('accepts null lastRefreshedAt', () => {
    const result = FreshnessMetadataSchema.safeParse({
      lastRefreshedAt: null,
      isStale: true,
      staleAfterSeconds: 300,
    })
    expect(result.success).toBe(true)
  })

  it('fails when staleAfterSeconds is missing', () => {
    const result = FreshnessMetadataSchema.safeParse({
      lastRefreshedAt: null,
      isStale: false,
    })
    expect(result.success).toBe(false)
  })
})

describe('ConfidenceMetadataSchema', () => {
  it('parses a valid confidence object', () => {
    const result = ConfidenceMetadataSchema.safeParse({
      level: 0.85,
      reason: 'Based on 30 samples',
      hidden: false,
    })
    expect(result.success).toBe(true)
  })

  it('defaults hidden to false when not provided', () => {
    const result = ConfidenceMetadataSchema.safeParse({ level: 0.5 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.hidden).toBe(false)
    }
  })

  it('accepts null level', () => {
    const result = ConfidenceMetadataSchema.safeParse({ level: null, hidden: true })
    expect(result.success).toBe(true)
  })

  it('fails when level exceeds 1', () => {
    const result = ConfidenceMetadataSchema.safeParse({ level: 1.5 })
    expect(result.success).toBe(false)
  })

  it('fails when level is below 0', () => {
    const result = ConfidenceMetadataSchema.safeParse({ level: -0.1 })
    expect(result.success).toBe(false)
  })
})

describe('EvidencePanelStateSchema', () => {
  it('parses a minimal valid panel state', () => {
    const result = EvidencePanelStateSchema.safeParse({
      panelId: 'panel-001',
      displayState: 'ready',
    })
    expect(result.success).toBe(true)
  })

  it('parses a full panel state with optional fields', () => {
    const result = EvidencePanelStateSchema.safeParse({
      panelId: 'panel-001',
      displayState: 'error',
      errorMessage: 'Connection timeout',
      freshness: { lastRefreshedAt: null, isStale: true, staleAfterSeconds: 60 },
      confidence: { level: 0.9, hidden: false },
    })
    expect(result.success).toBe(true)
  })

  it('fails when panelId is missing', () => {
    const result = EvidencePanelStateSchema.safeParse({ displayState: 'ready' })
    expect(result.success).toBe(false)
  })

  it('fails when displayState is invalid', () => {
    const result = EvidencePanelStateSchema.safeParse({ panelId: 'p1', displayState: 'unknown' })
    expect(result.success).toBe(false)
  })
})
