import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'

const FIXED_NOW = '2024-03-08T10:00:00.000Z'
const adapter = new Warehouse360Adapter({ now: () => FIXED_NOW })

const request = { warehouseId: 'WH-IE10-MAIN', plantId: 'IE10' }

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/warehouse360/stock-exceptions')) {
      return {
        ok: true,
        json: async () => [
          {
            plantId: 'IE10',
            materialId: 'MAT-START-CULTURE-B10',
            batchId: 'SC-240308-0003',
            exceptionType: 'expiry',
            qty: 3.5,
            minimumDaysToExpiry: 1,
            hasMinimumShelfLifeBreach: false,
          },
          {
            plantId: 'IE10',
            materialId: 'MAT-RM-RENNET',
            batchId: 'RM-240301-0021',
            exceptionType: 'expired',
            qty: 75,
            minimumDaysToExpiry: -2,
            hasMinimumShelfLifeBreach: true,
          },
        ],
      } as Response
    }
    if (url.includes('/api/warehouse360/shortfalls')) {
      return {
        ok: true,
        json: async () => [
          {
            plantId: 'IE10',
            materialId: 'MAT-RM-RENNET',
            shortfallQty: 75,
            openItemsCount: 2,
            oldestTrDate: '2026-05-12T08:00:00.000Z',
          },
        ],
      } as Response
    }
    if (url.includes('/api/warehouse360/overview')) {
      return {
        ok: true,
        json: async () => ({
          blockedStockCount: 29,
          inboundDueCount: 7,
          outboundDueCount: 12,
          stagingOpenCount: 23,
          binUtilPct: 74.2,
          stagingOverdueCount: 5,
        }),
      } as Response
    }
    return { ok: true, json: async () => [] } as Response
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('Warehouse360Adapter', () => {
  describe('getWarehouse360Context', () => {
    it('returns ok result', async () => {
      const result = await adapter.getWarehouse360Context(request)
      expect(result.ok).toBe(true)
    })

    it('returns warehouseId WH-IE10-MAIN', async () => {
      const result = await adapter.getWarehouse360Context(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.warehouseId).toBe('WH-IE10-MAIN')
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getWarehouse360Context(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('getWarehouse360Summary', () => {
    it('returns ok result', async () => {
      const result = await adapter.getWarehouse360Summary(request)
      expect(result.ok).toBe(true)
    })

    it('holdLines + unrestrictedLines + qualityInspectionLines <= totalStockLines', async () => {
      const result = await adapter.getWarehouse360Summary(request)
      if (!result.ok) throw new Error('Expected ok result')
      const d = result.data
      expect(d.holdLines + d.unrestrictedLines + d.qualityInspectionLines).toBeLessThanOrEqual(d.totalStockLines)
    })

    it('confidence is between 0 and 1', async () => {
      const result = await adapter.getWarehouse360Summary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.confidence).toBeGreaterThanOrEqual(0)
      expect(result.data.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('getStockOverview', () => {
    it('returns ok result with empty zones array', async () => {
      const result = await adapter.getStockOverview(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data.zones)).toBe(true)
      expect(result.data.zones.length).toBe(0)
    })
  })

  describe('getOpenHolds', () => {
    it('returns ok result with empty array', async () => {
      const result = await adapter.getOpenHolds(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBe(0)
    })
  })

  describe('getGoodsMovements', () => {
    it('returns ok result with empty array', async () => {
      const result = await adapter.getGoodsMovements(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBe(0)
    })
  })

  describe('getReplenishmentNeeds', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getReplenishmentNeeds(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('each need has reorderPoint or is critical/high', async () => {
      const result = await adapter.getReplenishmentNeeds(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const need of result.data) {
        expect(need.reorderPoint).toBeGreaterThan(0)
        expect(need.urgency).toMatch(/^(critical|high|medium|low)$/)
      }
    })
  })

  describe('getLocationCapacities', () => {
    it('returns ok result with empty array', async () => {
      const result = await adapter.getLocationCapacities(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBe(0)
    })
  })

  describe('getNearExpiryStock', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getNearExpiryStock(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each batch has a valid urgency', async () => {
      const result = await adapter.getNearExpiryStock(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validUrgencies = ['expired', 'critical', 'warning', 'caution']
      for (const batch of result.data) {
        expect(batch.urgency ? validUrgencies.includes(batch.urgency) : true).toBe(true)
      }
    })

    it('each batch has a valid holdStatus', async () => {
      const result = await adapter.getNearExpiryStock(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validStatuses = ['unrestricted', 'quality-hold', 'blocked']
      for (const batch of result.data) {
        expect(batch.holdStatus ? validStatuses.includes(batch.holdStatus) : true).toBe(true)
      }
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getNearExpiryStock(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })

    it('mock data includes an expired batch', async () => {
      const result = await adapter.getNearExpiryStock(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.some((b) => b.urgency === 'expired')).toBe(true)
    })
  })

  describe('getWarehouseExceptions', () => {
    it('returns ok result with empty array', async () => {
      const result = await adapter.getWarehouseExceptions(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBe(0)
    })
  })
})
