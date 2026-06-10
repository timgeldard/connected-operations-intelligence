import { useQuery } from '@tanstack/react-query'
import { wmOperationsAdapter } from './wm-operations-adapter.js'
import type { WmOperationsAdapterRequest } from './wm-operations-adapter.js'

const STALE = 60 * 1000 // worklists move fast — 1-minute stale time (PER_USER_60S server cache)

export function useWmWorklist(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: [
      'wm-ops-worklist',
      request.plantId ?? null,
      request.warehouseId ?? null,
      request.workArea ?? null,
      request.status ?? null,
      request.includeComplete ?? false,
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
    queryKey: ['wm-ops-order-readiness', request.plantId ?? null, request.warehouseId ?? null],
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
