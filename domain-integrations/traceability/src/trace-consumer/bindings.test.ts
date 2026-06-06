import { describe, expect, it } from 'vitest'
import {
  parseTraceConsumerCombinedSearch,
  resolveTraceConsumerBatchesForMaterial,
  resolveTraceConsumerSearch,
  resolveTraceConsumerSelection,
  type TraceConsumerSearchItem,
} from './bindings.js'
import { TRACE_CONSUMER_SEARCH_FIXTURES } from './fixtures.js'

describe('resolveTraceConsumerSearch', () => {
  it('matches material descriptions by partial text via material-first step', () => {
    const result = resolveTraceConsumerSearch('cheese powder', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('materials-for-query')
    if (result.step !== 'materials-for-query') return
    expect(result.materials).toHaveLength(1)
    expect(result.materials[0].materialId).toBe('20035129')
    expect(result.materials[0].batchCount).toBe(2)
    expect(result.batches.map(batch => batch.batchId)).toEqual(['8000049668', '8000049669'])
  })

  it('matches material ids with wildcards via material-first step', () => {
    const result = resolveTraceConsumerSearch('10002384*', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('materials-for-query')
    if (result.step !== 'materials-for-query') return
    expect(result.materials.map(material => material.materialId)).toEqual(
      expect.arrayContaining(['100023847', '100023848']),
    )
  })

  it('exact material id skips material picker and goes straight to batches', () => {
    const result = resolveTraceConsumerSearch('20035129', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('batches-for-material')
    if (result.step !== 'batches-for-material') return
    expect(result.selectedMaterial?.id).toBe('20035129')
    expect(result.batches.map(batch => batch.batchId)).toEqual(['8000049668', '8000049669'])
  })

  it('ambiguous description text matches multiple materials', () => {
    const result = resolveTraceConsumerSearch('cheese', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('materials-for-query')
    if (result.step !== 'materials-for-query') return
    expect(result.materials.length).toBeGreaterThan(1)
    expect(result.materials.map(material => material.materialId)).toEqual(
      expect.arrayContaining(['20035129', '100023848']),
    )
  })

  it('matches batch ids and preserves multi-plant options', () => {
    const result = resolveTraceConsumerSearch('CH-240308-0047', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('materials-for-batch')
    if (result.step !== 'materials-for-batch') return
    const emmental = result.materials.find(material => material.materialId === '100023847')
    expect(result.selectedBatch).toBe('CH-240308-0047')
    expect(emmental?.plants.map(plant => plant.id)).toEqual(['IE10', 'IE11'])
  })

  it('matches process order ids and skips material confirmation when uniquely matched', () => {
    const result = resolveTraceConsumerSearch('PO-240308-1189', TRACE_CONSUMER_SEARCH_FIXTURES)

    // Single material match → auto-skip material step and go to plant selection
    expect(result.step).toBe('select-plant')
    if (result.step !== 'select-plant') return
    expect(result.materialId).toBe('100023847')
    expect(result.batchId).toBe('CH-240308-0047')
    expect(result.plants.map(p => p.id)).toEqual(['IE10', 'IE11'])
  })

  it('does not resolve unknown batch-like input without complete context', () => {
    const result = resolveTraceConsumerSearch('UNKNOWN-BATCH-001', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result).toEqual({ step: 'no-results' })
  })

  it.each([
    '20035129 8000049668',
    '20035129/8000049668',
    '20035129, 8000049668',
  ])('parses combined material and batch input: %s', query => {
    expect(parseTraceConsumerCombinedSearch(query)).toEqual({
      materialId: '20035129',
      batchId: '8000049668',
    })
  })

  it('combined material and batch input resolves to the exact single-plant batch', () => {
    const result = resolveTraceConsumerSearch('20035129 8000049668', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('resolved')
    if (result.step !== 'resolved') return
    expect(result.request).toEqual({
      materialId: '20035129',
      batchId: '8000049668',
      plantId: 'C061',
    })
  })

  it('combined material and batch input with multiple plants routes to plant selection', () => {
    const result = resolveTraceConsumerSearch('100023847/CH-240308-0047', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result.step).toBe('select-plant')
    if (result.step !== 'select-plant') return
    expect(result.materialId).toBe('100023847')
    expect(result.batchId).toBe('CH-240308-0047')
    expect(result.plants.map(plant => plant.id)).toEqual(['IE10', 'IE11'])
  })

  it('combined material and batch input with no plant does not launch trace', () => {
    const rows: readonly TraceConsumerSearchItem[] = [
      {
        materialId: '20035129',
        materialDescription: 'CHEESE POWDER BLEND 25KG',
        batchId: '8000049668',
        plantId: '',
        plantName: '',
      },
    ]

    const result = resolveTraceConsumerSearch('20035129 8000049668', rows)

    expect(result.step).toBe('missing-plant')
    if (result.step !== 'missing-plant') return
    expect(result.message).toContain('Plant context is required')
  })

  it('unknown combined material and batch input returns no results', () => {
    const result = resolveTraceConsumerSearch('20035129 0000000000', TRACE_CONSUMER_SEARCH_FIXTURES)

    expect(result).toEqual({ step: 'no-results' })
  })

  it('selection helper never resolves with an empty plant id', () => {
    const noPlant = resolveTraceConsumerSelection('20035129', '8000049668', [])
    const blankPlant = resolveTraceConsumerSelection('20035129', '8000049668', [{ id: '', name: '' }])

    expect(noPlant.step).toBe('missing-plant')
    expect(blankPlant.step).toBe('missing-plant')
  })

  it('orders batch candidates by latest posting date, quantity, then batch id', () => {
    const rows: readonly TraceConsumerSearchItem[] = [
      {
        materialId: 'MAT-1',
        materialDescription: 'Cheese blend',
        batchId: 'B-002',
        plantId: 'P1',
        plantName: 'Plant 1',
        latestPostingDate: '2024-01-01',
        quantity: 999,
      },
      {
        materialId: 'MAT-1',
        materialDescription: 'Cheese blend',
        batchId: 'B-001',
        plantId: 'P1',
        plantName: 'Plant 1',
        latestPostingDate: '2025-01-01',
        quantity: 100,
      },
      {
        materialId: 'MAT-1',
        materialDescription: 'Cheese blend',
        batchId: 'B-003',
        plantId: 'P1',
        plantName: 'Plant 1',
        latestPostingDate: '2025-01-01',
        quantity: 200,
      },
    ]

    const result = resolveTraceConsumerSearch('Cheese', rows)

    expect(result.step).toBe('materials-for-query')
    if (result.step !== 'materials-for-query') return
    expect(result.materials).toHaveLength(1)
    expect(result.materials[0].batchCount).toBe(3)

    const batches = resolveTraceConsumerBatchesForMaterial(
      'MAT-1',
      'Cheese blend',
      result.batches,
    )
    expect(batches.batches.map(batch => batch.batchId)).toEqual(['B-003', 'B-001', 'B-002'])
  })
})
