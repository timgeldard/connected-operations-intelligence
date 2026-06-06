import { describe, it, expect } from 'vitest'
import { QualityReleaseAdapter } from './quality-release-adapter.js'
import {
  BatchReleaseContextSchema,
  BatchReleaseQueueItemSchema,
  BatchReleaseSummarySchema,
  QualityResultsSummarySchema,
  CoAReadinessSchema,
  DeviationSummarySchema,
  ReleaseDecisionHistoryItemSchema,
} from '@connectio/data-contracts'
import type { QualityReleaseAdapterRequest } from './quality-release-adapter.js'

const request: QualityReleaseAdapterRequest = {
  releaseCaseId: 'RC-2024-001847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new QualityReleaseAdapter({ now: fixedNow })

describe('QualityReleaseAdapter', () => {
  it('getReleaseContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getReleaseContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = BatchReleaseContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getReleaseQueue returns ok: true with at least one item', async () => {
    const result = await adapter.getReleaseQueue(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.length).toBeGreaterThan(0)
    for (const item of result.data) {
      const parsed = BatchReleaseQueueItemSchema.safeParse(item)
      expect(parsed.success).toBe(true)
    }
  })

  it('getReleaseQueue contains the expected case', async () => {
    const result = await adapter.getReleaseQueue(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const caseItem = result.data.find((i) => i.releaseCaseId === 'RC-2024-001847')
    expect(caseItem).toBeDefined()
    expect(caseItem?.priority).toBe('critical')
    expect(caseItem?.hasOpenHold).toBe(true)
  })

  it('getReleaseSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getReleaseSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = BatchReleaseSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.overallReadiness).toBe('blocked')
    expect(result.data.recommendedAction).toBe('reject')
  })

  it('getQualityResults returns ok: true with MIC failures', async () => {
    const result = await adapter.getQualityResults(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = QualityResultsSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.micStatus).toBe('fail')
    expect(result.data.micFailures.length).toBeGreaterThan(0)
  })

  it('getCoAReadiness returns ok: true with incomplete status', async () => {
    const result = await adapter.getCoAReadiness(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = CoAReadinessSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.readinessStatus).toBe('incomplete')
    expect(result.data.missingFields.length).toBeGreaterThan(0)
  })

  it('getDeviations returns ok: true with blocking deviations', async () => {
    const result = await adapter.getDeviations(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = DeviationSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.blockingReleaseCount).toBeGreaterThan(0)
  })

  it('getDecisionHistory returns ok: true with valid items', async () => {
    const result = await adapter.getDecisionHistory(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    for (const item of result.data) {
      const parsed = ReleaseDecisionHistoryItemSchema.safeParse(item)
      expect(parsed.success).toBe(true)
    }
  })

  it('all methods return consistent fetchedAt timestamp', async () => {
    const results = await Promise.all([
      adapter.getReleaseContext(request),
      adapter.getReleaseSummary(request),
      adapter.getQualityResults(request),
    ])
    for (const r of results) {
      if (r.ok) {
        expect(r.fetchedAt).toBe(fixedNow())
      }
    }
  })
})
