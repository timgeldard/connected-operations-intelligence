import { useQuery } from '@tanstack/react-query'
import { wmOperationsAdapter } from './wm-operations-adapter.js'
import type { WmDrillRequest, WmOperationsAdapterRequest, WmWipStageItem, WmScheduleAdherenceDailyItem, WmOrderYieldItem, WmComponentVarianceItem } from './wm-operations-adapter.js'

export function useWmOrderComponents(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-components', request.plantId ?? null, request.orderId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderComponents(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmOrderOperations(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-operations', request.plantId ?? null, request.orderId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderOperations(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmOperatorActivity(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-operator-activity', request.plantId ?? null, request.warehouseId ?? null, request.days ?? 14, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOperatorActivity(request),
    staleTime: 60 * 1000,
  })
}

export function useWmQueueWorkload(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-queue-workload', request.plantId ?? null, request.warehouseId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getQueueWorkload(request),
    staleTime: 60 * 1000,
  })
}

export function useWmOutbound(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-outbound', request.plantId ?? null, request.warehouseId ?? null, request.includeShipped ?? false, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOutbound(request),
    staleTime: 60 * 1000,
  })
}

export function useWmReconAlerts(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-recon-alerts', request.plantId ?? null, request.warehouseId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getReconAlerts(request),
    staleTime: 60 * 1000,
  })
}

/** Generic hook for the declarative second-wave list endpoints. */
export function useWmList<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['wm-ops-list', path, JSON.stringify(params)],
    queryFn: () => wmOperationsAdapter.getList<T>(path, params),
    staleTime: 60 * 1000,
    enabled,
  })
}

export function useWmBatchMovements(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-batch-movements', request.plantId ?? null, request.materialId ?? null, request.batchId ?? null, request.days ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getBatchMovements(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.materialId),
  })
}

const STALE = 60 * 1000 // worklists move fast — 1-minute stale time (PER_USER_60S server cache)

export function useWmWorklist(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: [
      'wm-ops-worklist',
      request.plantId ?? null,
      request.warehouseId ?? null,
      request.workArea ?? null,
      request.status ?? null,
      request.queue ?? null,
      request.campaign ?? null,
      request.reference ?? null,
      request.includeComplete ?? false,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getWorklist(request),
    staleTime: STALE,
  })
}

export function useWmWorklistSummary(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: ['wm-ops-worklist-summary', request.plantId ?? null, request.warehouseId ?? null],
    queryFn: () => wmOperationsAdapter.getWorklistSummary(request),
    staleTime: STALE,
  })
}

export function useWmOrderReadiness(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: ['wm-ops-order-readiness', request.plantId ?? null, request.warehouseId ?? null, request.startFromDaysAgo ?? null, request.startToDaysAhead ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderReadiness(request),
    staleTime: STALE,
  })
}

export function useWmOrderJourney(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-journey', request.plantId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderJourney(request),
    staleTime: 60 * 1000,
    enabled,
  })
}

export function useWmOrderJourneyEvents(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-journey-events', request.plantId ?? null, request.orderId ?? null],
    queryFn: () => wmOperationsAdapter.getOrderJourneyEvents(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmWipStages(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-wip-stages', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmWipStageItem>(
      '/api/wm-operations/wip-stages',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmScheduleAdherenceDaily(plantId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-schedule-adherence-daily', plantId ?? null],
    queryFn: () => wmOperationsAdapter.getList<WmScheduleAdherenceDailyItem>(
      '/api/wm-operations/schedule-adherence-daily',
      { plant_id: plantId ?? undefined, limit: 200 },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmOrderYield(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-yield', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmOrderYieldItem>(
      '/api/wm-operations/order-yield',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmComponentVariance(
  plantId: string | null | undefined,
  orderId?: string,
  limit = 500,
  enabled = true,
) {
  return useQuery({
    queryKey: ['wm-ops-component-variance', plantId ?? null, orderId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmComponentVarianceItem>(
      '/api/wm-operations/component-variance',
      { plant_id: plantId ?? undefined, order_id: orderId, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmBinStock(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: [
      'wm-ops-bin-stock',
      request.plantId ?? null,
      request.warehouseId ?? null,
      request.storageZone ?? null,
      request.storageType ?? null,
      request.materialId ?? null,
      request.binId ?? null,
      request.expiringWithinDays ?? null,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getBinStock(request),
    staleTime: STALE,
  })
}
