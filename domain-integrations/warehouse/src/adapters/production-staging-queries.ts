import { useQuery } from '@tanstack/react-query'
import type {
  ProductionStagingContext,
  StagingReadinessSummary,
  StagingOrderSummary,
  StagingPickTask,
  StagingZoneCapacity,
  StagingShortfall,
  StagingMoveRequest,
  StagingPickingWave,
  StagingAlert,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  productionStagingAdapter,
  toProductionStagingAdapterError,
} from './production-staging-adapter.js'
import type { ProductionStagingAdapterRequest } from './production-staging-adapter.js'

const STALE_TIME_MS = 5 * 60 * 1000

export function useProductionStagingContext(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<ProductionStagingContext>>({
    queryKey: ['production-staging', 'context', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getProductionStagingContext(request)
      } catch (e) {
        return toProductionStagingAdapterError<ProductionStagingContext>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingReadinessSummary(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingReadinessSummary>>({
    queryKey: ['production-staging', 'readiness', request.warehouseId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingReadinessSummary(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingReadinessSummary>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingOrderSummaries(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingOrderSummary[]>>({
    queryKey: ['production-staging', 'orders', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingOrderSummaries(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingOrderSummary[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingPickTasks(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingPickTask[]>>({
    queryKey: ['production-staging', 'pick-tasks', request.warehouseId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingPickTasks(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingPickTask[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingZoneCapacity(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingZoneCapacity[]>>({
    queryKey: ['production-staging', 'zone-capacity', request.warehouseId ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingZoneCapacity(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingZoneCapacity[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingShortfalls(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingShortfall[]>>({
    queryKey: ['production-staging', 'shortfalls', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingShortfalls(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingShortfall[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingMoveRequests(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingMoveRequest[]>>({
    queryKey: ['production-staging', 'move-requests', request.warehouseId ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingMoveRequests(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingMoveRequest[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingPickingWaves(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingPickingWave[]>>({
    queryKey: ['production-staging', 'picking-waves', request.warehouseId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingPickingWaves(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingPickingWave[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useStagingAlerts(request: ProductionStagingAdapterRequest) {
  return useQuery<AdapterResult<StagingAlert[]>>({
    queryKey: ['production-staging', 'alerts', request.warehouseId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await productionStagingAdapter.getStagingAlerts(request)
      } catch (e) {
        return toProductionStagingAdapterError<StagingAlert[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}
