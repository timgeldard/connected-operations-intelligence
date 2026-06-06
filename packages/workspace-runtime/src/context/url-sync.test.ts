import { describe, expect, it } from 'vitest'
import {
  readInvestigationContextFromUrl,
  writeInvestigationContextToUrl,
} from './url-sync.js'

describe('investigation context URL sync', () => {
  it('reads investigation context fields from query params', () => {
    const context = readInvestigationContextFromUrl(
      '?workspace=trace-investigation&batchId=B-001&materialId=M-001&plantId=IE10&processOrderId=7006965038&scopeFrom=2026-05-01&scopeTo=2026-05-20',
      () => '2026-05-20T10:00:00.000Z',
    )

    expect(context.batchId).toBe('B-001')
    expect(context.materialId).toBe('M-001')
    expect(context.plantId).toBe('IE10')
    expect(context.processOrderId).toBe('7006965038')
    expect(context.scope?.from?.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(context.scope?.to?.toISOString()).toBe('2026-05-20T00:00:00.000Z')
  })

  it('writes context fields without dropping existing workspace params', () => {
    const search = writeInvestigationContextToUrl(
      '?workspace=trace-investigation&view=overview',
      {
        batchId: 'B-001',
        plantId: 'IE10',
        scope: { from: new Date('2026-05-01T00:00:00.000Z') },
        timestamp: '2026-05-20T10:00:00.000Z',
      },
    )

    const params = new URLSearchParams(search)
    expect(params.get('workspace')).toBe('trace-investigation')
    expect(params.get('view')).toBe('overview')
    expect(params.get('batchId')).toBe('B-001')
    expect(params.get('plantId')).toBe('IE10')
    expect(params.get('scopeFrom')).toBe('2026-05-01')
  })

  it('removes absent context params from the URL', () => {
    const search = writeInvestigationContextToUrl(
      '?workspace=trace-investigation&batchId=B-001&plantId=IE10',
      { timestamp: '2026-05-20T10:00:00.000Z' },
    )

    const params = new URLSearchParams(search)
    expect(params.get('workspace')).toBe('trace-investigation')
    expect(params.get('batchId')).toBeNull()
    expect(params.get('plantId')).toBeNull()
  })
})
