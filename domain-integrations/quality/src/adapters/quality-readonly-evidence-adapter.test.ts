import { describe, expect, it } from 'vitest'
import { QualityEvidenceResponseSchema } from '@connectio/data-contracts'
import { QualityReadOnlyEvidenceAdapter } from './quality-readonly-evidence-adapter.js'

const fixedNow = () => '2026-05-21T09:15:00.000Z'

describe('QualityReadOnlyEvidenceAdapter', () => {
  it('returns an explicit pending-source-verification response in mock mode', async () => {
    const adapter = new QualityReadOnlyEvidenceAdapter({ now: fixedNow, source: 'mock' })

    const result = await adapter.getQualityEvidence({
      plantId: 'C113',
      materialId: '000000000070373871',
      batchId: '0008602411',
      inspectionLotId: '000000123456',
      processOrderId: '7006965038',
      dateFrom: '2026-01-01',
      dateTo: '2026-05-21',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.source).toBe('mock')
    expect(result.fetchedAt).toBe(fixedNow())
    expect(result.data.summary.source).toBe('mock')
    expect(result.data.summary.status).toBe('pending-source-verification')
    expect(result.data.summary.sourceFreshnessStatus).toBe('not-verified')
    expect(result.data.summary.usageDecisionStatus).toBe('source-unverified')
    expect(result.data.inspectionLots).toEqual([])
    expect(result.data.micResults).toEqual([])
    expect(result.data.usageDecision).toBeNull()
    expect(result.data.coaResults).toEqual([])
    expect(result.data.request.materialId).toBe('000000000070373871')

    const parsed = QualityEvidenceResponseSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('does not return mock evidence or release-decision fields', async () => {
    const adapter = new QualityReadOnlyEvidenceAdapter({ now: fixedNow, source: 'databricks-api' })
    const result = await adapter.getQualityEvidence({ batchId: '0008602411' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.source).not.toBe('mock')
    expect(result.data.summary.source).not.toBe('mock')
    expect(result.data.summary.warnings.join(' ')).toContain('not be interpreted')
    expect('releaseApproved' in result.data).toBe(false)
    expect('canRelease' in result.data).toBe(false)
  })
})
