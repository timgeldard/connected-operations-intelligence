import { useQuery } from '@tanstack/react-query'
import { wmOperationsAdapter } from './wm-operations-adapter.js'
import type { WmDrillRequest, WmOperationsAdapterRequest } from './wm-operations-adapter.js'

export function useWmOrderComponents(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-components', request.plantId ?? null, request.orderId ?? null],
    queryFn: () => wmOperationsAdapter.getOrderComponents(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmOperatorActivity(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-operator-activity', request.plantId ?? null, request.warehouseId ?? null, request.days ?? 14],
    queryFn: () => wmOperationsAdapter.getOperatorActivity(request),
    staleTime: 60 * 1000,
  })
}

export function useWmQueueWorkload(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-queue-workload', request.plantId ?? null, request.warehouseId ?? null],
    queryFn: () => wmOperationsAdapter.getQueueWorkload(request),
    staleTime: 60 * 1000,
  })
}

export function useWmOutbound(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-outbound', request.plantId ?? null, request.warehouseId ?? null, request.includeShipped ?? false],
    queryFn: () => wmOperationsAdapter.getOutbound(request),
    staleTime: 60 * 1000,
  })
}

export function useWmReconAlerts(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-recon-alerts', request.plantId ?? null, request.warehouseId ?? null],
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
    queryKey: ['wm-ops-batch-movements', request.plantId ?? null, request.materialId ?? null, request.batchId ?? null],
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
    queryKey: ['wm-ops-order-readiness', request.plantId ?? null, request.warehouseId ?? null, request.startFromDaysAgo ?? null, request.startToDaysAhead ?? null],
    queryFn: () => wmOperationsAdapter.getOrderReadiness(request),
    staleTime: STALE,
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
    ],
    queryFn: () => wmOperationsAdapter.getBinStock(request),
    staleTime: STALE,
  })
}
