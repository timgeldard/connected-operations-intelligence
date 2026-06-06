import { useQuery } from '@tanstack/react-query'
import type { MaintenanceConstraint } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { maintenanceConstraintsAdapter, toMaintenanceAdapterError } from './maintenance-constraints-adapter.js'
import type { MaintenanceConstraintsAdapterRequest } from './maintenance-constraints-adapter.js'

const STALE_TIME_MS = 5 * 60 * 1000

export function useMaintenanceConstraints(request: MaintenanceConstraintsAdapterRequest) {
  return useQuery<AdapterResult<MaintenanceConstraint[]>>({
    queryKey: ['maintenance', 'constraints', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await maintenanceConstraintsAdapter.getMaintenanceConstraintsForPlan(request)
      } catch (e) {
        return toMaintenanceAdapterError<MaintenanceConstraint[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}
