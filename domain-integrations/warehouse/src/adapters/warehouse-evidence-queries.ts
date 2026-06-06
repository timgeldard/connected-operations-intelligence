import { useQuery } from '@tanstack/react-query'
import type { WarehouseHoldStatus } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { warehouseEvidenceAdapter, toAdapterError } from './warehouse-evidence-adapter.js'
import type { WarehouseEvidenceAdapterRequest } from './warehouse-evidence-adapter.js'

const WAREHOUSE_STALE_TIME_MS = 5 * 60 * 1000

export function useWarehouseHoldStatus(request: WarehouseEvidenceAdapterRequest) {
  return useQuery<AdapterResult<WarehouseHoldStatus>>({
    queryKey: [
      'warehouse-evidence',
      'getWarehouseHoldStatus',
      request.batchId ?? null,
      request.plantId ?? null,
    ],
    queryFn: async () => {
      try {
        return await warehouseEvidenceAdapter.getWarehouseHoldStatus(request)
      } catch (e) {
        return toAdapterError<WarehouseHoldStatus>(e)
      }
    },
    staleTime: WAREHOUSE_STALE_TIME_MS,
  })
}
