import { describe, it, expect } from 'vitest'
import { WarehouseEvidenceAdapter } from './warehouse-evidence-adapter.js'
import { WarehouseHoldStatusSchema } from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new WarehouseEvidenceAdapter({ now: fixedNow })
const request = { batchId: 'CH-240308-0047', plantId: 'IE10' }

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
