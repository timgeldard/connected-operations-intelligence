import { describe, it, expect } from 'vitest'
import { Trace2Adapter, Trace2BatchSearchResponseSchema } from './trace2-adapter.js'
import {
  TraceInvestigationContextSchema,
  BatchHeaderSummarySchema,
  TraceGraphSchema,
  MassBalanceSummarySchema,
  CustomerExposureSummarySchema,
  SupplierExposureSummarySchema,
  CoAReleaseStatusSchema,
  TraceRiskSignalSchema,
  RelatedInvestigationSchema,
  TraceEventSchema,
} from '@connectio/data-contracts'
import type { Trace2AdapterRequest } from './trace2-adapter.js'

const request: Trace2AdapterRequest = {
  investigationId: 'INV-2024-003847',
  batchId: 'CH-240308-0047',
  plantId: 'IE10',
}

/** Fixed clock for deterministic fetchedAt assertions. */
const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new Trace2Adapter({ now: fixedNow })

describe('Trace2Adapter', () => {
  it('getInvestigationContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getInvestigationContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    // Validate the returned data against the Zod schema
    const parsed = TraceInvestigationContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getBatchHeaderSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getBatchHeaderSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = BatchHeaderSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.batchId).toBe('CH-240308-0047')
    expect(result.data.releaseStatus).toBe('blocked')
  })

  it('searchBatches supports structured material and batch criteria in mock mode', async () => {
    const result = await adapter.searchBatches({
      query: '20035129 8000049668',
      materialId: '20035129',
      batchId: '8000049668',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Trace2BatchSearchResponseSchema.safeParse(result.data).success).toBe(true)
    expect(result.data.items).toHaveLength(1)
    expect(result.data.items[0].materialId).toBe('20035129')
    expect(result.data.items[0].batchId).toBe('8000049668')
    expect(result.data.items[0].matchTypes).toEqual(['material-id', 'batch-id'])
  })

  it('getTraceGraph returns ok: true with valid contract data', async () => {
    const result = await adapter.getTraceGraph(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = TraceGraphSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.nodes.length).toBeGreaterThan(0)
    expect(result.data.edges.length).toBeGreaterThan(0)
    expect(result.data.rootBatch).toBe('CH-240308-0047')
  })

  it('getMassBalanceSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getMassBalanceSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = MassBalanceSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    expect(result.data.confidence).toBeGreaterThan(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  it('getCustomerExposureSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getCustomerExposureSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = CustomerExposureSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
    // Mock data has recall recommended for this high-severity case
    expect(result.data.recallRecommended).toBe(true)
  })

  it('getSupplierExposureSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getSupplierExposureSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = SupplierExposureSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEventTimeline returns ok: true with at least one event', async () => {
    const result = await adapter.getEventTimeline(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.length).toBeGreaterThan(0)
    // All events must pass schema validation
    for (const event of result.data) {
      const parsed = TraceEventSchema.safeParse(event)
      expect(parsed.success).toBe(true)
    }
  })

  it('getCoAReleaseStatus returns ok: true with valid contract data', async () => {
    const result = await adapter.getCoAReleaseStatus(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const parsed = CoAReleaseStatusSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getRiskSignals returns ok: true with valid signals', async () => {
    const result = await adapter.getRiskSignals(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.length).toBeGreaterThan(0)
    for (const signal of result.data) {
      const parsed = TraceRiskSignalSchema.safeParse(signal)
      expect(parsed.success).toBe(true)
      expect(signal.confidence).toBeGreaterThanOrEqual(0)
      expect(signal.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('getRelatedInvestigations returns ok: true with valid data', async () => {
    const result = await adapter.getRelatedInvestigations(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    for (const inv of result.data) {
      const parsed = RelatedInvestigationSchema.safeParse(inv)
      expect(parsed.success).toBe(true)
    }
  })

  it('all methods return a consistent fetchedAt timestamp', async () => {
    const methods = [
      adapter.getInvestigationContext(request),
      adapter.getBatchHeaderSummary(request),
      adapter.getTraceGraph(request),
    ] as const

    const results = await Promise.all(methods)
    for (const r of results) {
      if (r.ok) {
        expect(r.fetchedAt).toBe(fixedNow())
      }
    }
  })
})
