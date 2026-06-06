import { useQuery } from '@tanstack/react-query'
import type {
  BatchReleaseContext,
  BatchReleaseQueueItem,
  BatchReleaseSummary,
  QualityResultsSummary,
  CoAReadiness,
  DeviationSummary,
  ReleaseDecisionHistoryItem,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { qualityReleaseAdapter, toAdapterError } from './quality-release-adapter.js'
import type { QualityReleaseAdapterRequest } from './quality-release-adapter.js'

const RELEASE_STALE_TIME_MS = 3 * 60 * 1000

function releaseKey(method: string, request: QualityReleaseAdapterRequest) {
  return ['quality-release', method, request.releaseCaseId, request.batchId ?? null] as const
}

export function useReleaseContext(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<BatchReleaseContext>>({
    queryKey: releaseKey('getReleaseContext', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getReleaseContext(request)
      } catch (e) {
        return toAdapterError<BatchReleaseContext>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}

export function useReleaseQueue(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<readonly BatchReleaseQueueItem[]>>({
    queryKey: releaseKey('getReleaseQueue', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getReleaseQueue(request)
      } catch (e) {
        return toAdapterError<readonly BatchReleaseQueueItem[]>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}

export function useReleaseSummary(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<BatchReleaseSummary>>({
    queryKey: releaseKey('getReleaseSummary', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getReleaseSummary(request)
      } catch (e) {
        return toAdapterError<BatchReleaseSummary>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}

export function useQualityResults(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<QualityResultsSummary>>({
    queryKey: releaseKey('getQualityResults', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getQualityResults(request)
      } catch (e) {
        return toAdapterError<QualityResultsSummary>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}

export function useCoAReadiness(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<CoAReadiness>>({
    queryKey: releaseKey('getCoAReadiness', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getCoAReadiness(request)
      } catch (e) {
        return toAdapterError<CoAReadiness>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}

export function useDeviations(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<DeviationSummary>>({
    queryKey: releaseKey('getDeviations', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getDeviations(request)
      } catch (e) {
        return toAdapterError<DeviationSummary>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}

export function useDecisionHistory(request: QualityReleaseAdapterRequest) {
  return useQuery<AdapterResult<readonly ReleaseDecisionHistoryItem[]>>({
    queryKey: releaseKey('getDecisionHistory', request),
    queryFn: async () => {
      try {
        return await qualityReleaseAdapter.getDecisionHistory(request)
      } catch (e) {
        return toAdapterError<readonly ReleaseDecisionHistoryItem[]>(e)
      }
    },
    staleTime: RELEASE_STALE_TIME_MS,
  })
}
