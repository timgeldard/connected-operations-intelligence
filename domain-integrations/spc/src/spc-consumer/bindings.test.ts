import { describe, expect, it } from 'vitest'
import { resolveSPCConsumerSearch } from './bindings.js'
import { spcConsumerSearchRegistry } from './fixtures.js'

describe('resolveSPCConsumerSearch', () => {
  it('should return idle when query is empty', () => {
    const result = resolveSPCConsumerSearch('', spcConsumerSearchRegistry)
    expect(result.step).toBe('idle')
  })

  it('should return no-results when no items match', () => {
    const result = resolveSPCConsumerSearch('unknown-item', spcConsumerSearchRegistry)
    expect(result.step).toBe('no-results')
  })

  it('should return materials-for-query when multiple materials match', () => {
    // Both Cheddar and Emmental might match a generic query like "MAT"
    const result = resolveSPCConsumerSearch('MAT', spcConsumerSearchRegistry)
    expect(result.step).toBe('materials-for-query')
    if (result.step === 'materials-for-query') {
      expect(result.materials.length).toBeGreaterThan(1)
    }
  })

  it('should return resolved when uniquely matched', () => {
    const result = resolveSPCConsumerSearch('Cheddar', spcConsumerSearchRegistry)
    // Cheddar white matches both Listowel and Wisconsin.
    expect(result.step).toBe('plants-for-material')
    if (result.step === 'plants-for-material') {
      expect(result.materialId).toBe('MAT-CH-CHEDDAR-WHITE')
      expect(result.plants.length).toBe(2)
    }
  })

  it('should step through and resolve characteristic', () => {
    const result = resolveSPCConsumerSearch('Emmental', spcConsumerSearchRegistry)
    // Emmental block is only at Listowel (IE10), but has 5 characteristics, so should step to characteristics-for-plant
    expect(result.step).toBe('characteristics-for-plant')
    if (result.step === 'characteristics-for-plant') {
      expect(result.materialId).toBe('MAT-CH-EMMENTAL-BLOCK')
      expect(result.plantId).toBe('IE10')
      expect(result.characteristics.length).toBe(5)
    }
  })

  it('should resolve request directly when specific batch matches', () => {
    const result = resolveSPCConsumerSearch('CH-240305-0018', spcConsumerSearchRegistry)
    expect(result.step).toBe('resolved')
    if (result.step === 'resolved') {
      expect(result.request.materialId).toBe('MAT-CH-CHEDDAR-WHITE')
      expect(result.request.plantId).toBe('IE10')
      expect(result.request.characteristicId).toBe('CHAR-PH-001')
      expect(result.request.batchId).toBe('CH-240305-0018')
    }
  })
})
