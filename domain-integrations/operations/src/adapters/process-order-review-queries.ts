import { useQuery } from '@tanstack/react-query'
import { processOrderReviewAdapterInstance as processOrderReviewAdapter } from './process-order-review-adapter-factory.js'
import type { ProcessOrderReviewAdapterRequest, ProcessOrderSearchRequest } from './process-order-review-adapter.js'

const STALE = 5 * 60 * 1000

interface QueryHookOptions {
  readonly enabled?: boolean
}

export function useProcessOrderReviewContext(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-context', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getProcessOrderReviewContext(request),
    staleTime: STALE,
    enabled: options.enabled ?? true,
  })
}

export function useProcessOrderHeader(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-header', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getProcessOrderHeader(request),
    enabled: Boolean(request.processOrderId) && (options.enabled ?? true),
    staleTime: STALE,
  })
}

export function useOrderProgressSummary(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-progress', request.processOrderId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderProgressSummary(request),
    staleTime: STALE,
    enabled: options.enabled ?? true,
  })
}

export function useExecutionTimeline(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-timeline', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getExecutionTimeline(request),
    staleTime: STALE,
    enabled: options.enabled ?? true,
  })
}

export function useOrderQualityContext(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-quality', request.processOrderId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderQualityContext(request),
    staleTime: STALE,
    enabled: options.enabled ?? true,
  })
}

export function useOrderStagingContext(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-staging', request.processOrderId ?? null, request.plantId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderStagingContext(request),
    staleTime: STALE,
    enabled: options.enabled ?? true,
  })
}

export function useRelatedBatchContext(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-batches', request.processOrderId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getRelatedBatchContext(request),
    staleTime: STALE,
    enabled: options.enabled ?? true,
  })
}

export function useOrderOperations(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-operations', request.processOrderId ?? null, request.plantId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderOperations(request),
    enabled: Boolean(request.processOrderId) && (options.enabled ?? true),
    staleTime: STALE,
  })
}

export function useOrderConfirmations(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-confirmations', request.processOrderId ?? null, request.plantId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderConfirmations(request),
    enabled: Boolean(request.processOrderId) && (options.enabled ?? true),
    staleTime: STALE,
  })
}

export function useOrderGoodsMovements(request: ProcessOrderReviewAdapterRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-goods-movements', request.processOrderId ?? null, request.plantId ?? null, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.getOrderGoodsMovements(request),
    enabled: Boolean(request.processOrderId) && (options.enabled ?? true),
    staleTime: STALE,
  })
}

export function useProcessOrderSearch(request: ProcessOrderSearchRequest, options: QueryHookOptions = {}) {
  return useQuery({
    queryKey: ['por-search', request.query, request.materialId ?? null, request.batchId ?? null],
    queryFn: () => processOrderReviewAdapter.searchOrders(request),
    enabled: Boolean(request.query.trim()) && (options.enabled ?? true),
    staleTime: STALE,
  })
}

