import '@testing-library/jest-dom'
import { describe, it, expect } from 'vitest'
import { ProcessOrderReviewAdapter, toProcessOrderReviewAdapterError } from './process-order-review-adapter.js'

import {
  ProcessOrderReviewContextSchema,
  ProcessOrderHeaderSchema,
  OrderProgressSummarySchema,
  ExecutionTimelineItemSchema,
  OrderQualityContextSchema,
  OrderStagingContextSchema,
  RelatedBatchContextSchema,
  ProcessOrderOperationSchema,
  ProcessOrderConfirmationSchema,
  ProcessOrderGoodsMovementSchema,
} from '@connectio/data-contracts'
import { z } from 'zod'

const FIXED_NOW = '2024-03-08T10:00:00.000Z'
const adapter = new ProcessOrderReviewAdapter({ now: () => FIXED_NOW })

const request = { processOrderId: 'PO-240308-3847', plantId: 'IE10' }

function assertSchema<T>(result: unknown, schema: z.ZodType<T>) {
  const res = result as { ok: boolean; data?: unknown }
  expect(res.ok).toBe(true)
  if (res.ok) {
    const parsed = schema.safeParse(res.data)
    if (!parsed.success) {
      console.error(parsed.error)
    }
    expect(parsed.success).toBe(true)
  }
}

describe('ProcessOrderReviewAdapter', () => {
  describe('getProcessOrderReviewContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      assertSchema(result, ProcessOrderReviewContextSchema)
    })

    it('returns processOrderId PO-240308-3847', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.processOrderId).toBe('PO-240308-3847')
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })

    it('returns plantId IE10', async () => {
      const result = await adapter.getProcessOrderReviewContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.plantId).toBe('IE10')
    })
  })

  describe('getProcessOrderHeader', () => {
    it('returns ok result', async () => {
      const result = await adapter.getProcessOrderHeader(request)
      assertSchema(result, ProcessOrderHeaderSchema)
    })

    it('returns valid quantities', async () => {
      const result = await adapter.getProcessOrderHeader(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.plannedQuantity).toBeGreaterThan(0)
      expect(result.data.confirmedQuantity).toBeGreaterThanOrEqual(0)
    })

    it('returns correct orderType', async () => {
      const result = await adapter.getProcessOrderHeader(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.orderType).toBe('process-order')
    })
  })

  describe('getOrderProgressSummary', () => {
    it('returns ok result', async () => {
      const result = await adapter.getOrderProgressSummary(request)
      assertSchema(result, OrderProgressSummarySchema)
    })

    it('progressPercent is between 0 and 100', async () => {
      const result = await adapter.getOrderProgressSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.progressPercent).toBeGreaterThanOrEqual(0)
      expect(result.data.progressPercent).toBeLessThanOrEqual(100)
    })

    it('confidence is between 0 and 1', async () => {
      const result = await adapter.getOrderProgressSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.confidence).toBeGreaterThanOrEqual(0)
      expect(result.data.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('getExecutionTimeline', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getExecutionTimeline(request)
      assertSchema(result, z.array(ExecutionTimelineItemSchema))
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('each event has required fields', async () => {
      const result = await adapter.getExecutionTimeline(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const event of result.data) {
        expect(event.eventId).toBeTruthy()
        expect(event.timestamp).toBeTruthy()
        expect(event.title).toBeTruthy()
      }
    })
  })

  describe('getOrderQualityContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getOrderQualityContext(request)
      assertSchema(result, OrderQualityContextSchema)
    })

    it('releaseBlockers is an array', async () => {
      const result = await adapter.getOrderQualityContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data.releaseBlockers)).toBe(true)
    })

    it('spcSignals count is non-negative', async () => {
      const result = await adapter.getOrderQualityContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.spcSignals).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getOrderStagingContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getOrderStagingContext(request)
      assertSchema(result, OrderStagingContextSchema)
    })

    it('componentsStaged does not exceed componentsRequired', async () => {
      const result = await adapter.getOrderStagingContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.componentsStaged).toBeLessThanOrEqual(result.data.componentsRequired)
    })
  })

  describe('getRelatedBatchContext', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getRelatedBatchContext(request)
      assertSchema(result, z.array(RelatedBatchContextSchema))
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('each batch has valid relationship type', async () => {
      const result = await adapter.getRelatedBatchContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validTypes = ['output', 'input-component', 'co-product', 'by-product', 'rework']
      for (const batch of result.data) {
        expect(validTypes).toContain(batch.relationshipType)
      }
    })

    it('each batch has valid traceRisk', async () => {
      const result = await adapter.getRelatedBatchContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const batch of result.data) {
        expect(['none', 'potential', 'confirmed']).toContain(batch.traceRisk)
      }
    })
  })

  describe('getOrderOperations', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getOrderOperations(request)
      assertSchema(result, z.array(ProcessOrderOperationSchema))
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('returns 8 operations matching progress summary totals', async () => {
      const result = await adapter.getOrderOperations(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.length).toBe(8)
    })

    it('6 operations are confirmed matching operationsComplete count', async () => {
      const result = await adapter.getOrderOperations(request)
      if (!result.ok) throw new Error('Expected ok result')
      const confirmed = result.data.filter(o => o.confirmed)
      expect(confirmed.length).toBe(6)
    })

    it('each operation has valid status', async () => {
      const result = await adapter.getOrderOperations(request)
      if (!result.ok) throw new Error('Expected ok result')
      const validStatuses = ['pending', 'in-progress', 'confirmed', 'skipped']
      for (const op of result.data) {
        expect(validStatuses).toContain(op.status)
      }
    })

    it('plannedDurationMinutes is positive for all operations', async () => {
      const result = await adapter.getOrderOperations(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const op of result.data) {
        expect(op.plannedDurationMinutes).toBeGreaterThan(0)
      }
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getOrderOperations(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('getOrderConfirmations', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getOrderConfirmations(request)
      assertSchema(result, z.array(ProcessOrderConfirmationSchema))
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('returns 7 confirmations matching progress summary totals', async () => {
      const result = await adapter.getOrderConfirmations(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.length).toBe(7)
    })

    it('5 final confirmations matching confirmationsComplete count', async () => {
      const result = await adapter.getOrderConfirmations(request)
      if (!result.ok) throw new Error('Expected ok result')
      const finalConfs = result.data.filter(c => c.isFinalConfirmation)
      expect(finalConfs.length).toBe(5)
    })

    it('2 open confirmations matching openConfirmations count', async () => {
      const result = await adapter.getOrderConfirmations(request)
      if (!result.ok) throw new Error('Expected ok result')
      const openConfs = result.data.filter(c => !c.isFinalConfirmation)
      expect(openConfs.length).toBe(2)
    })

    it('confirmedYield is non-negative for all confirmations', async () => {
      const result = await adapter.getOrderConfirmations(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const conf of result.data) {
        expect(conf.confirmedYield).toBeGreaterThanOrEqual(0)
      }
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getOrderConfirmations(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('getOrderGoodsMovements', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getOrderGoodsMovements(request)
      assertSchema(result, z.array(ProcessOrderGoodsMovementSchema))
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('includes both input and output movements', async () => {
      const result = await adapter.getOrderGoodsMovements(request)
      if (!result.ok) throw new Error('Expected ok result')
      const hasInput = result.data.some(m => m.direction === 'input')
      const hasOutput = result.data.some(m => m.direction === 'output')
      expect(hasInput).toBe(true)
      expect(hasOutput).toBe(true)
    })

    it('each movement has valid direction', async () => {
      const result = await adapter.getOrderGoodsMovements(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const mov of result.data) {
        expect(['input', 'output', 'unknown']).toContain(mov.direction)
      }
    })

    it('each movement has positive quantity', async () => {
      const result = await adapter.getOrderGoodsMovements(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const mov of result.data) {
        expect(mov.quantity).toBeGreaterThan(0)
      }
    })

    it('output movement references output batch CH-240308-0047', async () => {
      const result = await adapter.getOrderGoodsMovements(request)
      if (!result.ok) throw new Error('Expected ok result')
      const outputMov = result.data.find(m => m.direction === 'output')
      expect(outputMov?.batchId).toBe('CH-240308-0047')
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getOrderGoodsMovements(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('source attribution', () => {
    it('returns source: "mock" for success paths', async () => {
      const headerRes = await adapter.getProcessOrderHeader(request)
      expect(headerRes.source).toBe('mock')

      const opsRes = await adapter.getOrderOperations(request)
      expect(opsRes.source).toBe('mock')

      const confRes = await adapter.getOrderConfirmations(request)
      expect(confRes.source).toBe('mock')

      const movsRes = await adapter.getOrderGoodsMovements(request)
      expect(movsRes.source).toBe('mock')
    })

    it('returns source: "mock" for error paths', () => {
      const errRes = toProcessOrderReviewAdapterError(new Error('Test error'))
      expect(errRes.ok).toBe(false)
      if (!errRes.ok) {
        expect(errRes.source).toBe('mock')
        expect(errRes.displayState).toBe('error')
        expect(errRes.error.code).toBe('unknown')
        expect(errRes.error.message).toBe('Test error')
      }
    })
  })
})
