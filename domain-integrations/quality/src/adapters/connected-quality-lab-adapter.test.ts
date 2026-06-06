import { describe, it, expect } from 'vitest'
import { ConnectedQualityLabAdapter } from './connected-quality-lab-adapter.js'

describe('ConnectedQualityLabAdapter', () => {
  it('returns mock source for getLabFailures', async () => {
    const adapter = new ConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source).toBe('mock')
      expect(result.data.dataAvailable).toBe(true)
      expect(result.data.fails.length).toBeGreaterThan(0)
    }
  })

  it('filters failures by lotType 89', async () => {
    const adapter = new ConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({ lotType: '89' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fails.length).toBeGreaterThan(0)
      expect(result.data.fails.every((f) => f.lotType === '89')).toBe(true)
    }
  })

  it('filters failures by lotType 04', async () => {
    const adapter = new ConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({ lotType: '04' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fails.length).toBeGreaterThan(0)
      expect(result.data.fails.every((f) => f.lotType === '04')).toBe(true)
    }
  })

  it('returns empty fails for unmatched lotType', async () => {
    const adapter = new ConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({ lotType: 'XX' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fails).toHaveLength(0)
      expect(result.data.dataAvailable).toBe(true)
    }
  })

  it('passes plantId through to response', async () => {
    const adapter = new ConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({ plantId: 'IE10' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.plantId).toBe('IE10')
    }
  })

  it('returns plants with mock source', async () => {
    const adapter = new ConnectedQualityLabAdapter()
    const result = await adapter.getLabPlants()
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.source).toBe('mock')
      expect(result.data.plants.length).toBeGreaterThan(0)
      expect(result.data.plants[0].plantId).toBeTruthy()
      expect(result.data.plants[0].plantName).toBeTruthy()
    }
  })

  it('uses custom now function for fetchedAt', async () => {
    const fixedNow = () => '2026-05-14T10:00:00.000Z'
    const adapter = new ConnectedQualityLabAdapter({ now: fixedNow })
    const result = await adapter.getLabFailures({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fetchedAt).toBe('2026-05-14T10:00:00.000Z')
    }
  })
})
