import { useQuery } from '@tanstack/react-query'
import type {
  EnvMonContext,
  EnvMonSiteSummary,
  EnvMonZone,
  EnvMonAlert,
  EnvMonSwabResult,
  EnvMonTrend,
  EnvMonHeatmapCell,
  EnvMonCorrectiveAction,
  EnvMonSwabVector,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { envmonAdapter, toEnvMonAdapterError } from './envmon-adapter.js'
import type { EnvMonAdapterRequest } from './envmon-adapter.js'

const STALE_TIME_MS = 5 * 60 * 1000

export function useEnvMonContext(request: EnvMonAdapterRequest, options: { enabled?: boolean } = {}) {
  return useQuery<AdapterResult<EnvMonContext>>({
    queryKey: ['envmon', 'context', request.plantId ?? null, request.regionId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonContext(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonContext>(e)
      }
    },
    staleTime: STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

export function useEnvMonSiteSummary(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonSiteSummary>>({
    queryKey: ['envmon', 'site-summary', request.plantId ?? null, request.regionId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonSiteSummary(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonSiteSummary>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonZones(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonZone[]>>({
    queryKey: ['envmon', 'zones', request.plantId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonZones(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonZone[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonAlerts(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonAlert[]>>({
    queryKey: ['envmon', 'alerts', request.plantId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonAlerts(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonAlert[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonSwabResults(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonSwabResult[]>>({
    queryKey: ['envmon', 'swab-results', request.plantId ?? null, request.periodStart ?? null, request.periodEnd ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonSwabResults(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonSwabResult[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonTrends(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonTrend[]>>({
    queryKey: ['envmon', 'trends', request.plantId ?? null, request.periodStart ?? null, request.periodEnd ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonTrends(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonTrend[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonHeatmap(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonHeatmapCell[]>>({
    queryKey: ['envmon', 'heatmap', request.plantId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonHeatmap(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonHeatmapCell[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonCorrectiveActions(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonCorrectiveAction[]>>({
    queryKey: ['envmon', 'corrective-actions', request.plantId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonCorrectiveActions(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonCorrectiveAction[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useEnvMonSwabVectors(request: EnvMonAdapterRequest) {
  return useQuery<AdapterResult<EnvMonSwabVector[]>>({
    queryKey: ['envmon', 'swab-vectors', request.plantId ?? null],
    queryFn: async () => {
      try {
        return await envmonAdapter.getEnvMonSwabVectors(request)
      } catch (e) {
        return toEnvMonAdapterError<EnvMonSwabVector[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}
