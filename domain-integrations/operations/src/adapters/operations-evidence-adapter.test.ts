import { describe, it, expect } from 'vitest'
import { OperationsEvidenceAdapter, toAdapterError } from './operations-evidence-adapter.js'
import { ProcessOrderReleaseEvidenceSchema } from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new OperationsEvidenceAdapter({ now: fixedNow })
const request = { batchId: 'CH-240308-0047', processOrderId: 'PO-240308-3847' }

describe('OperationsEvidenceAdapter', () => {
  it('getProcessOrderEvidence returns ok: true with valid contract data', async () => {
    const result = await adapter.getProcessOrderEvidence(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = ProcessOrderReleaseEvidenceSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('yield percent is within valid range', async () => {
    const result = await adapter.getProcessOrderEvidence(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.yieldPercent).toBeGreaterThanOrEqual(0)
    expect(result.data.yieldPercent).toBeLessThanOrEqual(200)
  })

  it('mock data shows non-conformant status', async () => {
    const result = await adapter.getProcessOrderEvidence(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.conformanceStatus).toBe('non-conformant')
  })

  it('returns source: "mock" for success and error paths', async () => {
    const result = await adapter.getProcessOrderEvidence(request)
    expect(result.source).toBe('mock')

    const errResult = toAdapterError(new Error('Test error'))
    expect(errResult.ok).toBe(false)
    expect(errResult.source).toBe('mock')
  })
})
