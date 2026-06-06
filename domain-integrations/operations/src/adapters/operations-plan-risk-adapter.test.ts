import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { OperationsPlanRiskAdapter, toAdapterError } from './operations-plan-risk-adapter.js'
import {
  OperationsPlanRiskContextSchema,
  PlanRiskSummarySchema,
  LateOrderSchema,
  MaterialShortageSchema,
  LineStatusSchema,
  ScheduleAdherenceSummarySchema,
  YieldVarianceSummarySchema,
  ShiftHandoverItemSchema,
  OperationsActionQueueItemSchema,
} from '@connectio/data-contracts'

const fixedNow = () => '2024-03-08T15:00:00.000Z'
const adapter = new OperationsPlanRiskAdapter({ now: fixedNow })
const request = { plantId: 'IE10', planDate: '2024-03-08' }

describe('OperationsPlanRiskAdapter', () => {
  it('getOperationsPlanRiskContext returns ok: true with valid contract data', async () => {
    const result = await adapter.getOperationsPlanRiskContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = OperationsPlanRiskContextSchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getPlanRiskSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getPlanRiskSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = PlanRiskSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getLateOrders returns ok: true with valid contract data', async () => {
    const result = await adapter.getLateOrders(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(LateOrderSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getMaterialShortages returns ok: true with valid contract data', async () => {
    const result = await adapter.getMaterialShortages(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(MaterialShortageSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getLineStatus returns ok: true with valid contract data', async () => {
    const result = await adapter.getLineStatus(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(LineStatusSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getScheduleAdherenceSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getScheduleAdherenceSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = ScheduleAdherenceSummarySchema.safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getYieldVarianceSummary returns ok: true with valid contract data', async () => {
    const result = await adapter.getYieldVarianceSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(YieldVarianceSummarySchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getShiftHandoverItems returns ok: true with valid contract data', async () => {
    const result = await adapter.getShiftHandoverItems(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(ShiftHandoverItemSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('getOperationsActionQueue returns ok: true with valid contract data', async () => {
    const result = await adapter.getOperationsActionQueue(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.fetchedAt).toBe(fixedNow())
    const parsed = z.array(OperationsActionQueueItemSchema).safeParse(result.data)
    expect(parsed.success).toBe(true)
  })

  it('plan risk summary confidence is within valid range', async () => {
    const result = await adapter.getPlanRiskSummary(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.confidence).toBeGreaterThanOrEqual(0)
    expect(result.data.confidence).toBeLessThanOrEqual(1)
  })

  it('mock data shows at-risk status', async () => {
    const result = await adapter.getOperationsPlanRiskContext(request)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.riskStatus).toBe('at-risk')
  })

  it('returns source: "mock" for success and error paths', async () => {
    const result = await adapter.getOperationsPlanRiskContext(request)
    expect(result.source).toBe('mock')

    const errResult = toAdapterError(new Error('Test error'))
    expect(errResult.ok).toBe(false)
    expect(errResult.source).toBe('mock')
  })
})
