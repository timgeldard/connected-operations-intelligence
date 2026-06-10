import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { WarehouseEvidenceAdapter } from './warehouse-evidence-adapter.js'
import { WarehouseHoldStatusSchema } from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new WarehouseEvidenceAdapter({ now: fixedNow })
const request = { batchId: 'CH-240308-0047', plantId: 'IE10' }

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/api/warehouse360/batch/')) {
      return {
        ok: true,
        json: async () => ({
          batchId: 'CH-240308-0047',
          materialId: 'MAT-01',
          plantId: 'IE10',
          storageLocationId: 'SL-01',
          stockType: 'blocked',
          totalQuantity: 1000.0,
          blockedQuantity: 1000.0,
          restrictedQuantity: 0.0,
          unrestrictedQuantity: 0.0,
          uom: 'KG',
          activeHolds: [
            {
              holdId: 'H-01',
              holdType: 'quality',
              reason: 'Quality Hold',
              placedBy: 'Inspector',
              placedAt: '2024-03-08T10:00:00Z',
              expiresAt: null,
              status: 'active',
            },
          ],
          hasBlockingHold: true,
          lastUpdatedAt: '2024-03-08T15:00:00.000Z',
        }),
      } as Response
    }
    return { ok: true, json: async () => ({}) } as Response
  }))
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('WarehouseEvidenceAdapter', () => {
  it('getWarehouseHoldStatus returns ok: true with valid contract data', async () => {
    const result = await adapter.getWarehouseHoldStatus(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = WarehouseHoldStatusSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('mock data shows blocking hold', async () => {
    const result = await adapter.getWarehouseHoldStatus(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.hasBlockingHold).toBe(true)
    expect(result.data.activeHolds.length).toBeGreaterThan(0)
  })

  it('blocked quantity matches total when fully held', async () => {
    const result = await adapter.getWarehouseHoldStatus(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.blockedQuantity).toBe(result.data.totalQuantity)
    expect(result.data.unrestrictedQuantity).toBe(0)
  })
})

