import { describe, it, expect } from 'vitest'
import { MaintenanceReliabilityAdapter } from './maintenance-reliability-adapter.js'

const FIXED_NOW = '2024-03-08T10:00:00.000Z'
const adapter = new MaintenanceReliabilityAdapter({ now: () => FIXED_NOW })

const request = { plantId: 'IE10' }

describe('MaintenanceReliabilityAdapter', () => {
  describe('getMaintenanceReliabilityContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getMaintenanceReliabilityContext(request)
      expect(result.ok).toBe(true)
    })

    it('returns plantId IE10', async () => {
      const result = await adapter.getMaintenanceReliabilityContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.plantId).toBe('IE10')
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getMaintenanceReliabilityContext(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('getMaintenanceKpiSummary', () => {
    it('returns ok result', async () => {
      const result = await adapter.getMaintenanceKpiSummary(request)
      expect(result.ok).toBe(true)
    })

    it('confidence is between 0 and 1', async () => {
      const result = await adapter.getMaintenanceKpiSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.confidence).toBeGreaterThanOrEqual(0)
      expect(result.data.confidence).toBeLessThanOrEqual(1)
    })

    it('equipmentAvailabilityPercent is between 0 and 100', async () => {
      const result = await adapter.getMaintenanceKpiSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.equipmentAvailabilityPercent).toBeGreaterThanOrEqual(0)
      expect(result.data.equipmentAvailabilityPercent).toBeLessThanOrEqual(100)
    })
  })

  describe('getWorkOrders', () => {
    it('returns ok result with work orders array', async () => {
      const result = await adapter.getWorkOrders(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each work order has a workOrderId', async () => {
      const result = await adapter.getWorkOrders(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const wo of result.data) {
        expect(typeof wo.workOrderId).toBe('string')
      }
    })

    it('each work order has valid priority', async () => {
      const result = await adapter.getWorkOrders(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validPriorities = ['critical', 'high', 'medium', 'low']
      for (const wo of result.data) {
        expect(validPriorities).toContain(wo.priority)
      }
    })
  })

  describe('getPreventiveMaintenanceTasks', () => {
    it('returns ok result with tasks array', async () => {
      const result = await adapter.getPreventiveMaintenanceTasks(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each task has valid status', async () => {
      const result = await adapter.getPreventiveMaintenanceTasks(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validStatuses = ['upcoming', 'due-today', 'overdue', 'completed', 'deferred']
      for (const task of result.data) {
        expect(validStatuses).toContain(task.status)
      }
    })
  })

  describe('getEquipmentAvailability', () => {
    it('returns ok result with equipment array', async () => {
      const result = await adapter.getEquipmentAvailability(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each record has availabilityPercent in [0, 100]', async () => {
      const result = await adapter.getEquipmentAvailability(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const eq of result.data) {
        expect(eq.availabilityPercent).toBeGreaterThanOrEqual(0)
        expect(eq.availabilityPercent).toBeLessThanOrEqual(100)
      }
    })
  })

  describe('getReliabilityMetrics', () => {
    it('returns ok result with metrics array', async () => {
      const result = await adapter.getReliabilityMetrics(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each metric has valid trendDirection', async () => {
      const result = await adapter.getReliabilityMetrics(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validTrends = ['improving', 'stable', 'degrading']
      for (const m of result.data) {
        expect(validTrends).toContain(m.trendDirection)
      }
    })
  })

  describe('getMaintenanceBacklog', () => {
    it('returns ok result with backlog array', async () => {
      const result = await adapter.getMaintenanceBacklog(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each backlog item has estimatedHours >= 0', async () => {
      const result = await adapter.getMaintenanceBacklog(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const item of result.data) {
        expect(item.estimatedHours).toBeGreaterThanOrEqual(0)
      }
    })
  })
})
