import { useQuery } from '@tanstack/react-query'
import type {
  ConnectedQualityLabFailuresResponse,
  ConnectedQualityLabPlantsResponse,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { toConnectedQualityLabAdapterError } from './connected-quality-lab-adapter.js'
import type { ConnectedQualityLabAdapterRequest } from './connected-quality-lab-adapter.js'
import { connectedQualityLabAdapterInstance } from './connected-quality-lab-adapter-factory.js'

const LAB_FAILURES_STALE_TIME_MS = 60 * 1000
const LAB_PLANTS_STALE_TIME_MS = 10 * 60 * 1000

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

export function useConnectedQualityLabPlants() {
  return useQuery<AdapterResult<ConnectedQualityLabPlantsResponse>>({
    queryKey: ['connected-quality-lab', 'plants'] as const,
    queryFn: async () => {
      try {
        return await connectedQualityLabAdapterInstance.getLabPlants()
      } catch (e) {
        return toConnectedQualityLabAdapterError<ConnectedQualityLabPlantsResponse>(e)
      }
    },
    staleTime: LAB_PLANTS_STALE_TIME_MS,
  })
}
