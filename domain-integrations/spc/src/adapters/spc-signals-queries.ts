import { useQuery } from '@tanstack/react-query'
import type { SPCSignalSummary } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { spcSignalsAdapter, toAdapterError } from './spc-signals-adapter.js'
import type { SPCSignalsAdapterRequest } from './spc-signals-adapter.js'

const SPC_STALE_TIME_MS = 2 * 60 * 1000

export function useSPCSignals(request: SPCSignalsAdapterRequest) {
  return useQuery<AdapterResult<SPCSignalSummary>>({
    queryKey: ['spc-signals', 'getSPCSignals', request.batchId ?? null, request.processOrderId ?? null],
    queryFn: async () => {
      try {
        return await spcSignalsAdapter.getSPCSignals(request)
      } catch (e) {
        return toAdapterError<SPCSignalSummary>(e)
      }
    },
    staleTime: SPC_STALE_TIME_MS,
  })
}
