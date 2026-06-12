import { useQuery } from '@tanstack/react-query'
import type {
  ConnectedQualityLabFailuresResponse,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  connectedQualityLabAdapterInstance,
  toConnectedQualityLabAdapterError,
} from './connected-quality-lab-databricks-adapter.js'
import type { ConnectedQualityLabAdapterRequest } from './connected-quality-lab-databricks-adapter.js'

const LAB_FAILURES_STALE_TIME_MS = 60 * 1000

export function useConnectedQualityLabFailures(request: ConnectedQualityLabAdapterRequest) {
  return useQuery<AdapterResult<ConnectedQualityLabFailuresResponse>>({
    queryKey: [
      'connected-quality-lab',
      'failures',
      request.plantId ?? null,
      request.lotType ?? null,
    ] as const,
    queryFn: async () => {
      try {
        return await connectedQualityLabAdapterInstance.getLabFailures(request)
      } catch (e) {
        return toConnectedQualityLabAdapterError<ConnectedQualityLabFailuresResponse>(e)
      }
    },
    staleTime: LAB_FAILURES_STALE_TIME_MS,
  })
}
