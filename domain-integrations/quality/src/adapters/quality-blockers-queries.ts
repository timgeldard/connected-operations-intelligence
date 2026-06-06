import { useQuery } from '@tanstack/react-query'
import type { QualityBlocker, ReleaseHoldImpact } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { qualityBlockersAdapter, toQualityBlockersAdapterError } from './quality-blockers-adapter.js'
import type { QualityBlockersAdapterRequest } from './quality-blockers-adapter.js'

const STALE_TIME_MS = 5 * 60 * 1000

export function useQualityBlockers(request: QualityBlockersAdapterRequest) {
  return useQuery<AdapterResult<QualityBlocker[]>>({
    queryKey: ['quality-blockers', 'blockers', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await qualityBlockersAdapter.getQualityBlockersForPlan(request)
      } catch (e) {
        return toQualityBlockersAdapterError<QualityBlocker[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useReleaseHoldImpacts(request: QualityBlockersAdapterRequest) {
  return useQuery<AdapterResult<ReleaseHoldImpact[]>>({
    queryKey: ['quality-blockers', 'hold-impacts', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await qualityBlockersAdapter.getReleaseHoldImpacts(request)
      } catch (e) {
        return toQualityBlockersAdapterError<ReleaseHoldImpact[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}
