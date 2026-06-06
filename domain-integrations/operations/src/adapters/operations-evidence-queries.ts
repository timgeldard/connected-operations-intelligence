import { useQuery } from '@tanstack/react-query'
import type { ProcessOrderReleaseEvidence } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { operationsEvidenceAdapter, toAdapterError } from './operations-evidence-adapter.js'
import type { OperationsEvidenceAdapterRequest } from './operations-evidence-adapter.js'

const OPS_STALE_TIME_MS = 5 * 60 * 1000

export function useProcessOrderEvidence(request: OperationsEvidenceAdapterRequest) {
  return useQuery<AdapterResult<ProcessOrderReleaseEvidence>>({
    queryKey: [
      'operations-evidence',
      'getProcessOrderEvidence',
      request.batchId ?? null,
      request.processOrderId ?? null,
    ],
    queryFn: async () => {
      try {
        return await operationsEvidenceAdapter.getProcessOrderEvidence(request)
      } catch (e) {
        return toAdapterError<ProcessOrderReleaseEvidence>(e)
      }
    },
    staleTime: OPS_STALE_TIME_MS,
  })
}
