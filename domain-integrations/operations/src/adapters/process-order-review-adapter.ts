import type {
  ProcessOrderReviewContext,
  ProcessOrderHeader,
  OrderProgressSummary,
  ExecutionTimelineItem,
  OrderQualityContext,
  OrderStagingContext,
  RelatedBatchContext,
  ProcessOrderOperation,
  ProcessOrderConfirmation,
  ProcessOrderGoodsMovement,
  ProcessOrderReviewAdapterRequest,
  ProcessOrderSearchRequest,
  ProcessOrderSearchResponse,
} from '@connectio/data-contracts'
export type { ProcessOrderReviewAdapterRequest, ProcessOrderSearchRequest, ProcessOrderSearchResponse }
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockProcessOrderReviewContext,
  mockProcessOrderHeader,
  mockOrderProgressSummary,
  mockExecutionTimeline,
  mockOrderQualityContext,
  mockOrderStagingContext,
  mockRelatedBatchContexts,
  mockOrderOperations,
  mockOrderConfirmations,
  mockOrderGoodsMovements,
} from './process-order-review-mock-data.js'

type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(
  code: AdapterError['code'],
  message: string,
  retryable = false
): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface ProcessOrderReviewAdapterOptions {
  readonly now?: NowFn
}

export class ProcessOrderReviewAdapter {
  private readonly now: NowFn

  constructor(options: ProcessOrderReviewAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getProcessOrderReviewContext(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<ProcessOrderReviewContext>> {
    return ok(mockProcessOrderReviewContext, this.now)
  }

  async getProcessOrderHeader(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<ProcessOrderHeader>> {
    return ok(mockProcessOrderHeader, this.now)
  }

  async getOrderProgressSummary(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<OrderProgressSummary>> {
    return ok(mockOrderProgressSummary, this.now)
  }

  async getExecutionTimeline(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<ExecutionTimelineItem[]>> {
    return ok(mockExecutionTimeline, this.now)
  }

  async getOrderQualityContext(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<OrderQualityContext>> {
    return ok(mockOrderQualityContext, this.now)
  }

  async getOrderStagingContext(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<OrderStagingContext>> {
    return ok(mockOrderStagingContext, this.now)
  }

  async getRelatedBatchContext(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<RelatedBatchContext[]>> {
    return ok(mockRelatedBatchContexts, this.now)
  }

  async getOrderOperations(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<ProcessOrderOperation[]>> {
    return ok(mockOrderOperations, this.now)
  }

  async getOrderConfirmations(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<ProcessOrderConfirmation[]>> {
    return ok(mockOrderConfirmations, this.now)
  }

  async getOrderGoodsMovements(
    _request: ProcessOrderReviewAdapterRequest
  ): Promise<AdapterResult<ProcessOrderGoodsMovement[]>> {
    return ok(mockOrderGoodsMovements, this.now)
  }

  async searchOrders(
    request: ProcessOrderSearchRequest
  ): Promise<AdapterResult<ProcessOrderSearchResponse>> {
    const items = [
      {
        processOrderId: 'PO-240308-3847',
        materialId: 'MAT-CH-EMMENTAL-BLOCK',
        materialDescription: 'Emmental Cheese Block 4kg',
        batchId: 'CH-240308-0047',
        plantId: 'IE10',
        plantName: 'Kerry Listowel (IE10)',
        orderStatus: 'released',
        plannedQuantity: 10000,
        confirmedQuantity: 9800,
        uom: 'KG',
        plannedStart: '2026-05-27T06:00:00Z',
        plannedFinish: '2026-05-27T14:00:00Z',
        matchTypes: ['process-order-id', 'material-id', 'description'] as any[],
      },
      {
        processOrderId: '7006965038',
        materialId: 'MAT-RM-MILK-STD',
        materialDescription: 'Standardised Whole Milk',
        batchId: 'B-MILK-9842',
        plantId: 'C113',
        plantName: 'Kerry Cork (C113)',
        orderStatus: 'confirmed',
        plannedQuantity: 50000,
        confirmedQuantity: 50120,
        uom: 'L',
        plannedStart: '2026-05-26T22:00:00Z',
        plannedFinish: '2026-05-27T04:00:00Z',
        matchTypes: ['process-order-id'] as any[],
      }
    ]

    const query = request.query.toLowerCase()
    const filtered = items.filter(
      item =>
        item.processOrderId.toLowerCase().includes(query) ||
        item.materialId.toLowerCase().includes(query) ||
        item.materialDescription.toLowerCase().includes(query) ||
        (item.batchId && item.batchId.toLowerCase().includes(query))
    )

    return ok({
      items: filtered,
      total: filtered.length,
      truncated: false,
      wildcardApplied: query.includes('*'),
    }, this.now)
  }
}

export const processOrderReviewAdapter = new ProcessOrderReviewAdapter()

export function toProcessOrderReviewAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
