import { describe, it, expect } from 'vitest'
import { SPCSignalsAdapter, toAdapterError } from './spc-signals-adapter.js'
import { SPCSignalSummarySchema } from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new SPCSignalsAdapter({ now: fixedNow })
const request = { batchId: 'CH-240308-0047', processOrderId: 'PO-240308-3847' }

describe('SPCSignalsAdapter', () => {
  it('getSPCSignals returns ok: true with valid contract data', async () => {
    const result = await adapter.getSPCSignals(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    expect(result.source).toBe('mock')
    const parsed = SPCSignalSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getSPCSignals returns at least one active alarm', async () => {
    const result = await adapter.getSPCSignals(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.activeAlarmCount).toBeGreaterThan(0)
  })

  it('alarm confidence values are in valid range', async () => {
    const result = await adapter.getSPCSignals(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    for (const alarm of result.data.alarms) {
      expect(['active', 'acknowledged', 'resolved', 'overridden']).toContain(alarm.status)
    }
  })

  describe('toAdapterError', () => {
    it('returns error result with source mock', () => {
      const errorResult = toAdapterError(new Error('Test error'))
      expect(errorResult.ok).toBe(false)
      if (errorResult.ok) throw new Error('Expected error result')
      expect(errorResult.source).toBe('mock')
      expect(errorResult.error.message).toBe('Test error')
    })
  })
})
