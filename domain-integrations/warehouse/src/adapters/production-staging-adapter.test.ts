import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { z } from 'zod'
import { ProductionStagingAdapter } from './production-staging-adapter.js'
import {
  ProductionStagingContextSchema,
  StagingReadinessSummarySchema,
  StagingOrderSummarySchema,
  StagingPickTaskSchema,
  StagingZoneCapacitySchema,
  StagingShortfallSchema,
  StagingMoveRequestSchema,
  StagingPickingWaveSchema,
  StagingAlertSchema,
} from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new ProductionStagingAdapter({ now: fixedNow })
const request = { plantId: 'IE10', warehouseId: 'WH-IE10-01', planDate: '2024-03-08' }

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/warehouse360/staging-readiness')) {
      return {
        ok: true,
        json: async () => ({
          plantId: 'IE10',
          planDate: '2024-03-08',
          totalOrders: 18,
          fullyStaged: 12,
          partiallyStaged: 3,
          notStaged: 2,
          blocked: 1,
        }),
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
          {
            plantId: 'IE10',
            materialId: 'MAT-RM-OTHER',
            shortfallQty: 20,
            openItemsCount: 1,
            oldestTrDate: '2026-05-13T08:00:00.000Z',
          }
        ],
      } as Response
    }
    if (url.includes('/api/warehouse360/pick-tasks')) {
      return {
        ok: true,
        json: async () => [
          {
            plantId: 'IE10', warehouseNumber: '104', taskId: 'TO900001', itemNumber: '1',
            materialId: 'MAT-CHIP-VAR-001', batchId: 'B-2024-01',
            sourceStorageType: '100', sourceStorageBin: 'A-01-01',
            destinationStorageType: '902', destinationStorageBin: 'STAGE-1',
            requestedQuantity: 10.0, confirmedQuantity: 4.0,
            itemStatus: 'Partially Confirmed', createdDatetime: '2024-03-08 06:00:00',
            orderReferenceType: 'F', orderReferenceNumber: '000700123456',
            transferPriority: '2', assignee: 'M.OBRIEN', ageHours: 9.0,
          },
        ],
      } as Response
    }
    if (url.includes('/api/warehouse360/move-requests')) {
      return {
        ok: true,
        json: async () => [
          {
            plantId: 'IE10', warehouseNumber: '104', requestId: 'TR500001', itemNumber: '1',
            materialId: 'MAT-SALT-IND-002',
            sourceStorageType: '100', sourceStorageBin: 'B-02-04',
            destinationStorageType: '902', destinationStorageBin: 'STAGE-2',
            requiredQuantity: 500.0, openQuantity: 500.0,
            createdDatetime: '2024-03-08 05:30:00', queue: 'REPL',
            transferPriority: '8', orderReferenceType: 'F', orderReferenceNumber: '000700123457',
            ageHours: 9.5,
          },
        ],
      } as Response
    }
    return { ok: true, json: async () => [] } as Response
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('ProductionStagingAdapter', () => {
  it('getProductionStagingContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getProductionStagingContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = ProductionStagingContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingReadinessSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingReadinessSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = StagingReadinessSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingOrderSummaries returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingOrderSummaries(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingOrderSummarySchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingPickTasks maps governed open TO items', async () => {
    const result = await adapter.getStagingPickTasks(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.source).toBe('databricks-api')
    const parsed = z.array(StagingPickTaskSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
    const task = result.data[0]
    expect(task.taskId).toBe('TO900001/1')
    expect(task.status).toBe('in-progress')          // Partially Confirmed
    expect(task.processOrderId).toBe('000700123456') // BETYP='F' linkage
    expect(task.assignee).toBe('M.OBRIEN')
    expect(task.priority).toBe('high')               // SAP priority 2
    expect(task.storageLocation).toBe('100/A-01-01')
    expect(task.pickedQuantity).toBe(4.0)
  })

  it('getStagingZoneCapacity returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingZoneCapacity(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingZoneCapacitySchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingShortfalls returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingShortfalls(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingShortfallSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingMoveRequests maps governed open TR items', async () => {
    const result = await adapter.getStagingMoveRequests(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.source).toBe('databricks-api')
    const parsed = z.array(StagingMoveRequestSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
    const req = result.data[0]
    expect(req.requestId).toBe('TR500001/1')
    expect(req.status).toBe('open')
    expect(req.quantity).toBe(500.0)
    expect(req.priority).toBe('low')   // SAP priority 8
    expect(req.reason).toBe('REPL')    // WM queue
    // Documented data gaps stay undefined — never invented.
    expect(req.requestedBy).toBeUndefined()
    expect(req.assignedTo).toBeUndefined()
  })

  it('getStagingPickingWaves returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingPickingWaves(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingPickingWaveSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingAlerts returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingAlerts(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingAlertSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('readiness summary confidence is within valid range [0,1]', async () => {
    const result = await adapter.getStagingReadinessSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.confidence).toBeGreaterThanOrEqual(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  it('context derives blocked risk status from the live readiness summary', async () => {
    const result = await adapter.getProductionStagingContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // readiness stub has blocked=1 -> riskStatus 'blocked' wins over at-risk.
    expect(result.data.riskStatus).toBe('blocked')
    expect(result.source).toBe('databricks-api')
    // warehouseName is a documented data gap — never invented.
    expect(result.data.warehouseName).toBeUndefined()
  })

  it('context reports the live readiness totals', async () => {
    const result = await adapter.getProductionStagingContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.totalOrders).toBe(18)
    expect(result.data.stagedOrders).toBe(12)
    expect(result.data.openShortfalls).toBe(2)
  })
})
