import { describe, it, expect } from 'vitest'
import {
  parsePohConsumerCombinedSearch,
  resolvePohConsumerSearch,
  resolvePohConsumerSelection,
} from './bindings.js'
import type { ProcessOrderSearchItem } from '@connectio/data-contracts'

const MOCK_ITEMS: readonly ProcessOrderSearchItem[] = [
  {
    processOrderId: 'PO-240308-3847',
    materialId: 'MAT-CH-EMMENTAL',
    materialDescription: 'Emmental Cheese',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    orderStatus: 'released',
    matchTypes: ['process-order-id'],
  },
  {
    processOrderId: 'PO-240308-3847',
    materialId: 'MAT-CH-EMMENTAL',
    materialDescription: 'Emmental Cheese',
    batchId: 'CH-240308-0047',
    plantId: 'IE11',
    plantName: 'Kerry Charleville (IE11)',
    orderStatus: 'released',
    matchTypes: ['process-order-id'],
  },
  {
    processOrderId: 'PO-240308-3849',
    materialId: 'MAT-CH-CHEDDAR',
    materialDescription: 'Cheddar Cheese',
    batchId: 'CH-240308-0049',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    orderStatus: 'released',
    matchTypes: ['description'],
  },
]

describe('PohConsumer Search Bindings', () => {
  describe('parsePohConsumerCombinedSearch', () => {
    it('returns processOrderId from exact pattern', () => {
      const parsed = parsePohConsumerCombinedSearch('PO-240308-3847')
      expect(parsed).toEqual({ processOrderId: 'PO-240308-3847' })
    })

    it('returns processOrderId from 10 digit numeric pattern', () => {
      const parsed = parsePohConsumerCombinedSearch('7006965038')
      expect(parsed).toEqual({ processOrderId: '7006965038' })
    })

    it('returns null for ambiguous description string', () => {
      const parsed = parsePohConsumerCombinedSearch('cheese powder')
      expect(parsed).toBeNull()
    })
  })

  describe('resolvePohConsumerSearch', () => {
    it('returns no-results on empty array', () => {
      const result = resolvePohConsumerSearch('test', [])
      expect(result.step).toBe('no-results')
    })

    it('resolves immediately on exact order id match with single plant', () => {
      const result = resolvePohConsumerSearch('PO-240308-3849', MOCK_ITEMS)
      expect(result).toEqual({
        step: 'resolved',
        request: {
          processOrderId: 'PO-240308-3849',
          plantId: 'IE10',
          materialId: 'MAT-CH-CHEDDAR',
          batchId: 'CH-240308-0049',
        },
      })
    })

    it('asks for plant selection on exact order id match with multiple plants', () => {
      const result = resolvePohConsumerSearch('PO-240308-3847', MOCK_ITEMS)
      expect(result.step).toBe('select-plant')
      if (result.step === 'select-plant') {
        expect(result.plants).toHaveLength(2)
        expect(result.plants[0].id).toBe('IE10')
        expect(result.plants[1].id).toBe('IE11')
      }
    })

    it('groups by material when multiple materials matched', () => {
      const result = resolvePohConsumerSearch('cheese', MOCK_ITEMS)
      expect(result.step).toBe('materials-for-query')
      if (result.step === 'materials-for-query') {
        expect(result.materials).toHaveLength(2)
      }
    })
  })

  describe('resolvePohConsumerSelection', () => {
    it('resolves single matched order', () => {
      const matchedOrders = MOCK_ITEMS.map((item) => ({ ...item, matchTypes: item.matchTypes as any }))
      const result = resolvePohConsumerSelection('PO-240308-3849', matchedOrders)
      expect(result).toEqual({
        step: 'resolved',
        request: {
          processOrderId: 'PO-240308-3849',
          plantId: 'IE10',
          materialId: 'MAT-CH-CHEDDAR',
          batchId: 'CH-240308-0049',
        },
      })
    })
  })
})
