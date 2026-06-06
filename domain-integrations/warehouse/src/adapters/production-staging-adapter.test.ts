import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { ProductionStagingAdapter } from './production-staging-adapter.js'
import {
  ProductionStagingContextSchema,
  StagingReadinessSummarySchema,
  StagingOrderSummarySchema,
  StagingPickTaskSchema,
  StagingZoneCapacitySchema,
  StagingShortfallSchema,
  StagingMoveRequestSchema,
  StagingPickingWaveSchema,
  StagingAlertSchema,
} from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new ProductionStagingAdapter({ now: fixedNow })
const request = { plantId: 'IE10', warehouseId: 'WH-IE10-01', planDate: '2024-03-08' }

describe('ProductionStagingAdapter', () => {
  it('getProductionStagingContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getProductionStagingContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = ProductionStagingContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingReadinessSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingReadinessSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = StagingReadinessSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingOrderSummaries returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingOrderSummaries(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingOrderSummarySchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingPickTasks returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingPickTasks(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingPickTaskSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingZoneCapacity returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingZoneCapacity(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingZoneCapacitySchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingShortfalls returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingShortfalls(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingShortfallSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingMoveRequests returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingMoveRequests(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingMoveRequestSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingPickingWaves returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingPickingWaves(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingPickingWaveSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getStagingAlerts returns ok: true with valid contract data', async () => {
    const result = await adapter.getStagingAlerts(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(StagingAlertSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('readiness summary confidence is within valid range [0,1]', async () => {
    const result = await adapter.getStagingReadinessSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.confidence).toBeGreaterThanOrEqual(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  it('mock context shows at-risk status', async () => {
    const result = await adapter.getProductionStagingContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.riskStatus).toBe('at-risk')
  })

  it('mock context reports 18 total orders', async () => {
    const result = await adapter.getProductionStagingContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.totalOrders).toBe(18)
  })
})
