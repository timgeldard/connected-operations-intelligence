import { describe, it, expect, vi, afterEach } from 'vitest'
import { z } from 'zod'
import { EnvMonAdapter } from './envmon-adapter.js'
import {
  EnvMonContextSchema,
  EnvMonSiteSummarySchema,
  EnvMonZoneSchema,
  EnvMonAlertSchema,
  EnvMonSwabResultSchema,
  EnvMonTrendSchema,
  EnvMonHeatmapCellSchema,
  EnvMonCorrectiveActionSchema,
  EnvMonSwabVectorSchema,
} from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new EnvMonAdapter({ now: fixedNow })
const request = { regionId: 'EU-WEST', plantId: 'IE10' }

describe('EnvMonAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
  it('getEnvMonContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = EnvMonContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonSiteSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonSiteSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = EnvMonSiteSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonZones returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonZones(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonZoneSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonAlerts returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonAlerts(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonAlertSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonSwabResults returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonSwabResults(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonSwabResultSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonTrends returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonTrends(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonTrendSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonHeatmap returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonHeatmap(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonHeatmapCellSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonCorrectiveActions returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonCorrectiveActions(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonCorrectiveActionSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getEnvMonSwabVectors returns ok: true with valid contract data', async () => {
    const result = await adapter.getEnvMonSwabVectors(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(EnvMonSwabVectorSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('site summary confidence is within valid range [0,1]', async () => {
    const result = await adapter.getEnvMonSiteSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.confidence).toBeGreaterThanOrEqual(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  it('mock context shows elevated risk status', async () => {
    const result = await adapter.getEnvMonContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.overallRiskStatus).toBe('elevated')
  })

  it('mock context reports 3 active alerts', async () => {
    const result = await adapter.getEnvMonContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.activeAlerts).toBe(3)
  })

  it('getNativeSiteSummary calls the databricks-api route and marks source', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        plantId: 'C061',
        plantName: '',
        zonesMonitored: 1,
        zonesWithAlerts: 0,
        positiveCount: 0,
        positiveRate: 0,
        openCorrectiveActions: 0,
        overdueActions: 0,
        complianceRate: 100,
        riskStatus: 'compliant',
        highestSeverity: 'low',
        confidence: 1,
      }),
    }))
    const nativeAdapter = new EnvMonAdapter({ now: fixedNow, baseUrl: 'http://api.test' })

    const result = await nativeAdapter.getNativeSiteSummary({
      plantId: 'C061',
      periodStart: '2026-01-01',
      periodEnd: '2026-05-18',
    })

    expect(fetch).toHaveBeenCalledWith('http://api.test/api/envmon/site-summary?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.plantId).toBe('C061')
  })

  it('getNativeSwabResults preserves source-backed SAP QM fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        inspectionLotId: '00001234',
        inspectionPointId: 'IP-001',
        sampleId: 'S-001',
        operationId: '0010',
        functionalLocation: 'FL-001',
        sampleSummary: 'Line swab',
        sampleHour: 8,
        plantId: 'C061',
        inspectionType: '14',
        createdDate: '2026-01-15',
        inspectionEndDate: '2026-01-16',
        micId: 'MIC-001',
        micName: 'TVC',
        micCode: 'TVC',
        result: 'REJECT',
        quantitativeResult: 450,
        qualitativeResult: null,
        targetValue: 100,
        upperTolerance: 200,
        lowerTolerance: null,
        unitOfMeasure: 'CFU',
        valuation: 'R',
        status: 'fail',
        inspector: 'USER001',
        inspectionMethod: 'METHOD-001',
        materialId: '000000000020052009',
        batchId: '0008602411',
        processOrderId: '7006965038',
      }]),
    }))
    const nativeAdapter = new EnvMonAdapter({ now: fixedNow, baseUrl: '' })

    const result = await nativeAdapter.getNativeSwabResults({
      plantId: 'C061',
      periodStart: '2026-01-01',
      periodEnd: '2026-05-18',
      limit: 100,
    })

    expect(fetch).toHaveBeenCalledWith('/api/envmon/swab-results?plant_id=C061&period_start=2026-01-01&period_end=2026-05-18&limit=100')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data[0].inspectionLotId).toBe('00001234')
    expect(result.data[0].functionalLocation).toBe('FL-001')
    expect(result.data[0].upperTolerance).toBe(200)
    expect(result.data[0].status).toBe('fail')
  })

  it('getNativeSwabResults rejects responses that do not match the native swab contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([{
        inspectionLotId: '00001234',
        inspectionPointId: 'IP-001',
        sampleId: 'S-001',
        operationId: '0010',
        functionalLocation: 'FL-001',
        sampleSummary: 'Line swab',
        sampleHour: 8,
        plantId: 'C061',
        inspectionType: '14',
        createdDate: '2026-01-15',
        inspectionEndDate: '2026-01-16',
        micId: 'MIC-001',
        micName: 'TVC',
        micCode: 'TVC',
        result: 'REJECT',
        quantitativeResult: '450',
        qualitativeResult: null,
        targetValue: 100,
        upperTolerance: 200,
        lowerTolerance: null,
        unitOfMeasure: 'CFU',
        valuation: 'R',
        status: 'invalid-status-value',
        inspector: 'USER001',
        inspectionMethod: 'METHOD-001',
        materialId: '000000000020052009',
        batchId: '0008602411',
        processOrderId: '7006965038',
      }]),
    }))
    const nativeAdapter = new EnvMonAdapter({ now: fixedNow, baseUrl: '' })

    const result = await nativeAdapter.getNativeSwabResults({
      plantId: 'C061',
      periodStart: '2026-01-01',
      periodEnd: '2026-05-18',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.code).toBe('invalid-data')
    expect(result.error.message).toContain('expected contract')
  })

  it('getNativeSwabResults returns a databricks-api error without mock fallback', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: async () => ({ detail: 'EnvMon swab results requires BACKEND_ADAPTER_MODE=databricks-api' }),
    }))
    const nativeAdapter = new EnvMonAdapter({ now: fixedNow, baseUrl: '' })

    const result = await nativeAdapter.getNativeSwabResults({
      plantId: 'C061',
      periodStart: '2026-01-01',
      periodEnd: '2026-05-18',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.message).toContain('BACKEND_ADAPTER_MODE=databricks-api')
    expect(result.error.retryable).toBe(true)
  })
})
