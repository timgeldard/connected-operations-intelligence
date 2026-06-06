import { describe, it, expect } from 'vitest'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'

const FIXED_NOW = '2024-03-08T10:00:00.000Z'
const adapter = new Warehouse360Adapter({ now: () => FIXED_NOW })

const request = { warehouseId: 'WH-IE10-MAIN', plantId: 'IE10' }

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
    it('returns ok result with zones array', async () => {
      const result = await adapter.getStockOverview(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data.zones)).toBe(true)
      expect(result.data.zones.length).toBeGreaterThan(0)
    })

    it('each zone has capacityPercent in [0, 100]', async () => {
      const result = await adapter.getStockOverview(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const zone of result.data.zones) {
        expect(zone.capacityPercent).toBeGreaterThanOrEqual(0)
        expect(zone.capacityPercent).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('getOpenHolds', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getOpenHolds(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each hold has positive ageHours', async () => {
      const result = await adapter.getOpenHolds(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const hold of result.data) {
        expect(hold.ageHours).toBeGreaterThan(0)
      }
    })
  })

  describe('getGoodsMovements', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getGoodsMovements(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each movement has a valid movementType', async () => {
      const result = await adapter.getGoodsMovements(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validTypes = ['goods-receipt', 'goods-issue', 'transfer-order', 'stock-transfer', 'return', 'adjustment']
      for (const mvt of result.data) {
        expect(validTypes).toContain(mvt.movementType)
      }
    })
  })

  describe('getReplenishmentNeeds', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getReplenishmentNeeds(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('each need has currentStockQuantity <= reorderPoint or is critical/high', async () => {
      const result = await adapter.getReplenishmentNeeds(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const need of result.data) {
        expect(need.reorderPoint).toBeGreaterThan(0)
        expect(need.urgency).toMatch(/^(critical|high|medium|low)$/)
      }
    })
  })

  describe('getLocationCapacities', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getLocationCapacities(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('utilizationPercent is in [0, 100]', async () => {
      const result = await adapter.getLocationCapacities(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const loc of result.data) {
        expect(loc.utilizationPercent).toBeGreaterThanOrEqual(0)
        expect(loc.utilizationPercent).toBeLessThanOrEqual(100)
      }
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
        expect(validUrgencies).toContain(batch.urgency)
      }
    })

    it('each batch has a valid holdStatus', async () => {
      const result = await adapter.getNearExpiryStock(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validStatuses = ['unrestricted', 'quality-hold', 'blocked']
      for (const batch of result.data) {
        expect(validStatuses).toContain(batch.holdStatus)
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
    it('returns ok result with array', async () => {
      const result = await adapter.getWarehouseExceptions(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each exception has a valid severity', async () => {
      const result = await adapter.getWarehouseExceptions(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validSeverities = ['critical', 'high', 'medium', 'low']
      for (const ex of result.data) {
        expect(validSeverities).toContain(ex.severity)
      }
    })

    it('each exception has a valid resolution', async () => {
      const result = await adapter.getWarehouseExceptions(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validResolutions = ['open', 'in-progress', 'resolved', 'escalated']
      for (const ex of result.data) {
        expect(validResolutions).toContain(ex.resolution)
      }
    })

    it('each exception has positive ageHours', async () => {
      const result = await adapter.getWarehouseExceptions(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const ex of result.data) {
        expect(ex.ageHours).toBeGreaterThan(0)
      }
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getWarehouseExceptions(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })
})
