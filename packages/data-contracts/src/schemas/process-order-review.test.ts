import { describe, it, expect } from 'vitest'
import {
  ProcessOrderReviewContextSchema,
  ProcessOrderHeaderSchema,
  OrderProgressSummarySchema,
  ExecutionTimelineItemSchema,
  OrderQualityContextSchema,
  OrderStagingContextSchema,
  RelatedBatchContextSchema,
} from './process-order-review.js'

describe('ProcessOrderReviewContextSchema', () => {
  it('accepts a valid context', () => {
    const result = ProcessOrderReviewContextSchema.safeParse({
      processOrderId: 'PO-240308-3847',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      materialDescription: 'Emmental Block 4 kg',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      orderStatus: 'in-process',
      qualityStatus: 'in-inspection',
      stagingStatus: 'partial',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing processOrderId', () => {
    const result = ProcessOrderReviewContextSchema.safeParse({
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      materialDescription: 'Emmental Block 4 kg',
      plantId: 'IE10',
      orderStatus: 'in-process',
      qualityStatus: 'in-inspection',
      stagingStatus: 'partial',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid orderStatus', () => {
    const result = ProcessOrderReviewContextSchema.safeParse({
      processOrderId: 'PO-001',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      plantId: 'IE10',
      orderStatus: 'pending',
      qualityStatus: 'not-inspected',
      stagingStatus: 'not-started',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('allows optional fields to be omitted', () => {
    const result = ProcessOrderReviewContextSchema.safeParse({
      processOrderId: 'PO-001',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      plantId: 'IE10',
      orderStatus: 'released',
      qualityStatus: 'not-inspected',
      stagingStatus: 'not-started',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('ProcessOrderHeaderSchema', () => {
  it('accepts valid header', () => {
    const result = ProcessOrderHeaderSchema.safeParse({
      processOrderId: 'PO-240308-3847',
      orderType: 'process-order',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      materialDescription: 'Emmental Block 4 kg',
      plantId: 'IE10',
      plannedQuantity: 2400,
      confirmedQuantity: 1860,
      uom: 'KG',
      plannedStart: '2024-03-08T00:00:00.000Z',
      plannedFinish: '2024-03-08T23:59:00.000Z',
      orderStatus: 'in-process',
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative plannedQuantity', () => {
    const result = ProcessOrderHeaderSchema.safeParse({
      processOrderId: 'PO-001',
      orderType: 'process-order',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      plantId: 'IE10',
      plannedQuantity: -100,
      confirmedQuantity: 0,
      uom: 'KG',
      plannedStart: '2024-03-08T00:00:00.000Z',
      plannedFinish: '2024-03-08T23:59:00.000Z',
      orderStatus: 'released',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid orderType', () => {
    const result = ProcessOrderHeaderSchema.safeParse({
      processOrderId: 'PO-001',
      orderType: 'unknown-order',
      materialId: 'MAT-001',
      materialDescription: 'Material',
      plantId: 'IE10',
      plannedQuantity: 100,
      confirmedQuantity: 0,
      uom: 'KG',
      plannedStart: '2024-03-08T00:00:00.000Z',
      plannedFinish: '2024-03-08T23:59:00.000Z',
      orderStatus: 'released',
    })
    expect(result.success).toBe(false)
  })
})

describe('OrderProgressSummarySchema', () => {
  it('accepts valid progress summary', () => {
    const result = OrderProgressSummarySchema.safeParse({
      processOrderId: 'PO-240308-3847',
      progressPercent: 77.5,
      operationsComplete: 6,
      operationsTotal: 8,
      confirmationsComplete: 5,
      openConfirmations: 2,
      delayMinutes: 35,
      riskLevel: 'at-risk',
      confidence: 0.88,
    })
    expect(result.success).toBe(true)
  })

  it('rejects progressPercent > 100', () => {
    const result = OrderProgressSummarySchema.safeParse({
      processOrderId: 'PO-001',
      progressPercent: 110,
      operationsComplete: 6,
      operationsTotal: 8,
      confirmationsComplete: 5,
      openConfirmations: 2,
      delayMinutes: 0,
      riskLevel: 'on-track',
      confidence: 0.9,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid riskLevel', () => {
    const result = OrderProgressSummarySchema.safeParse({
      processOrderId: 'PO-001',
      progressPercent: 50,
      operationsComplete: 4,
      operationsTotal: 8,
      confirmationsComplete: 4,
      openConfirmations: 0,
      delayMinutes: 0,
      riskLevel: 'unknown',
      confidence: 0.9,
    })
    expect(result.success).toBe(false)
  })
})

describe('ExecutionTimelineItemSchema', () => {
  it('accepts valid timeline item', () => {
    const result = ExecutionTimelineItemSchema.safeParse({
      eventId: 'EVT-001',
      timestamp: '2024-03-08T00:00:00.000Z',
      eventType: 'order-released',
      title: 'Process Order Released',
      description: 'Released to production.',
      sourceSystem: 'SAP ERP',
    })
    expect(result.success).toBe(true)
  })

  it('accepts alert type with severity', () => {
    const result = ExecutionTimelineItemSchema.safeParse({
      eventId: 'EVT-005',
      timestamp: '2024-03-08T05:45:00.000Z',
      eventType: 'alert',
      title: 'SPC Signal',
      description: 'pH out of control.',
      sourceSystem: 'SPC',
      severity: 'high',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid eventType', () => {
    const result = ExecutionTimelineItemSchema.safeParse({
      eventId: 'EVT-001',
      timestamp: '2024-03-08T00:00:00.000Z',
      eventType: 'unknown-event',
      title: 'Something',
      description: 'Something happened.',
      sourceSystem: 'System',
    })
    expect(result.success).toBe(false)
  })
})

describe('OrderQualityContextSchema', () => {
  it('accepts valid quality context', () => {
    const result = OrderQualityContextSchema.safeParse({
      inspectionLotId: 'IL-240308-0047',
      releaseCaseId: 'RC-2024-0847',
      qualityStatus: 'in-inspection',
      failedCharacteristics: 1,
      openDeviations: 1,
      spcSignals: 2,
      releaseBlockers: ['pH signal requires investigation.'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal quality context without optional fields', () => {
    const result = OrderQualityContextSchema.safeParse({
      qualityStatus: 'passed',
      failedCharacteristics: 0,
      openDeviations: 0,
      spcSignals: 0,
      releaseBlockers: [],
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid qualityStatus', () => {
    const result = OrderQualityContextSchema.safeParse({
      qualityStatus: 'pending',
      failedCharacteristics: 0,
      openDeviations: 0,
      spcSignals: 0,
      releaseBlockers: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('OrderStagingContextSchema', () => {
  it('accepts valid staging context', () => {
    const result = OrderStagingContextSchema.safeParse({
      processOrderId: 'PO-240308-3847',
      stagingStatus: 'partial',
      componentsRequired: 8,
      componentsStaged: 5,
      missingComponents: 2,
      blockedComponents: 1,
      openTransferRequirements: 3,
      readinessStatus: 'partial',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid stagingStatus', () => {
    const result = OrderStagingContextSchema.safeParse({
      processOrderId: 'PO-001',
      stagingStatus: 'in-progress',
      componentsRequired: 5,
      componentsStaged: 3,
      missingComponents: 2,
      blockedComponents: 0,
      openTransferRequirements: 0,
      readinessStatus: 'partial',
    })
    expect(result.success).toBe(false)
  })
})

describe('RelatedBatchContextSchema', () => {
  it('accepts valid related batch', () => {
    const result = RelatedBatchContextSchema.safeParse({
      batchId: 'CH-240308-0047',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      relationshipType: 'output',
      traceRisk: 'potential',
      qualityStatus: 'under-review',
      stockStatus: 'quality-inspection',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid relationshipType', () => {
    const result = RelatedBatchContextSchema.safeParse({
      batchId: 'CH-001',
      materialId: 'MAT-001',
      relationshipType: 'sub-component',
      traceRisk: 'none',
      qualityStatus: 'released',
      stockStatus: 'unrestricted',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid traceRisk', () => {
    const result = RelatedBatchContextSchema.safeParse({
      batchId: 'CH-001',
      materialId: 'MAT-001',
      relationshipType: 'output',
      traceRisk: 'high',
      qualityStatus: 'released',
      stockStatus: 'unrestricted',
    })
    expect(result.success).toBe(false)
  })
})
