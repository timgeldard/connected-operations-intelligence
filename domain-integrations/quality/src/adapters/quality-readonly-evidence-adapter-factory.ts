import { QualityReadOnlyEvidenceAdapter } from './quality-readonly-evidence-adapter.js'
import { QualityReadOnlyEvidenceApiAdapter } from './quality-readonly-evidence-api-adapter.js'

export function createQualityReadOnlyEvidenceAdapter(): QualityReadOnlyEvidenceAdapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const legacyBaseUrl = import.meta.env.VITE_LEGACY_API_BASE_URL ?? 'http://127.0.0.1:8000'

  if (adapterMode === 'databricks-api') {
    // Both databricks-api and legacy-api route to the same explicitly unavailable
    // backend route for now, because live wiring is not complete.
    return new QualityReadOnlyEvidenceApiAdapter('', 'databricks-api')
  }

  if (adapterMode === 'legacy-api') {
    return new QualityReadOnlyEvidenceApiAdapter(legacyBaseUrl, 'legacy-api')
  }

  // mock mode returns the existing local unavailable response from the base adapter
  return new QualityReadOnlyEvidenceAdapter({ source: 'mock' })
}

export const qualityReadOnlyEvidenceAdapterInstance = createQualityReadOnlyEvidenceAdapter()
