import { useQuery } from '@tanstack/react-query'
import type { WarehouseStagingStatus, MaterialShortage } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { warehouseStagingAdapter, toStagingAdapterError } from './warehouse-staging-adapter.js'
import type { WarehouseStagingAdapterRequest } from './warehouse-staging-adapter.js'

const STALE_TIME_MS = 5 * 60 * 1000

export function useWarehouseStagingStatus(request: WarehouseStagingAdapterRequest) {
  return useQuery<AdapterResult<WarehouseStagingStatus[]>>({
    queryKey: ['warehouse-staging', 'status', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await warehouseStagingAdapter.getWarehouseStagingStatus(request)
      } catch (e) {
        return toStagingAdapterError<WarehouseStagingStatus[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useMaterialShortagesForPlan(request: WarehouseStagingAdapterRequest) {
  return useQuery<AdapterResult<MaterialShortage[]>>({
    queryKey: ['warehouse-staging', 'material-shortages', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await warehouseStagingAdapter.getMaterialShortagesForPlan(request)
      } catch (e) {
        return toStagingAdapterError<MaterialShortage[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}
