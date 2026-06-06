import { useQuery } from '@tanstack/react-query'
import type { QualityEvidenceResponse } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { qualityReadOnlyEvidenceAdapterInstance } from './quality-readonly-evidence-adapter-factory.js'
import type { QualityReadOnlyEvidenceAdapterRequest } from './quality-readonly-evidence-adapter.js'

const QUALITY_EVIDENCE_STALE_TIME_MS = 3 * 60 * 1000

function qualityEvidenceKey(request: QualityReadOnlyEvidenceAdapterRequest) {
  return [
    'quality-readonly-evidence',
    request.plantId ?? null,
    request.materialId ?? null,
    request.batchId ?? null,
    request.inspectionLotId ?? null,
    request.processOrderId ?? null,
    request.dateFrom ?? null,
    request.dateTo ?? null,
  ] as const
}

export function useQualityReadOnlyEvidence(request: QualityReadOnlyEvidenceAdapterRequest) {
  return useQuery<AdapterResult<QualityEvidenceResponse>>({
    queryKey: qualityEvidenceKey(request),
    queryFn: () => qualityReadOnlyEvidenceAdapterInstance.getQualityEvidence(request),
    staleTime: QUALITY_EVIDENCE_STALE_TIME_MS,
  })
}
