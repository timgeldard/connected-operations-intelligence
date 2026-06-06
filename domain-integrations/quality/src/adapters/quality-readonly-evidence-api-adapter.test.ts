import { describe, expect, it, vi, afterEach } from 'vitest'

import { QualityReadOnlyEvidenceApiAdapter } from './quality-readonly-evidence-api-adapter.js'

describe('QualityReadOnlyEvidenceApiAdapter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the backend route and returns parsed data on success', async () => {
    const mockResponse = {
      request: { batchId: '123' },
      summary: {
        source: 'databricks-api',
        status: 'pending-source-verification',
        inspectionLotCount: 0,
        micResultCount: 0,
        usageDecisionStatus: 'source-unverified',
        coaResultCount: 0,
        unavailableEvidence: ['deviations'],
        warnings: ['Read-only Quality evidence is pending'],
        queriedAt: '2026-05-21T09:15:00.000Z',
        sourceFreshnessStatus: 'not-verified'
      },
      inspectionLots: [],
      micResults: [],
      usageDecision: null,
      coaResults: []
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse
    }))

    const adapter = new QualityReadOnlyEvidenceApiAdapter('http://localhost', 'databricks-api')
    const result = await adapter.getQualityEvidence({ batchId: '123' })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.source).toBe('databricks-api')
    expect(result.data.summary.status).toBe('pending-source-verification')
  })

  it('returns error state on network failure without falling back to mock', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({})
    }))

    const adapter = new QualityReadOnlyEvidenceApiAdapter('http://localhost', 'legacy-api')
    const result = await adapter.getQualityEvidence({ batchId: '123' })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.source).toBe('legacy-api')
    expect(result.displayState).toBe('error')
    expect(result.error.code).toBe('network')
  })
})
