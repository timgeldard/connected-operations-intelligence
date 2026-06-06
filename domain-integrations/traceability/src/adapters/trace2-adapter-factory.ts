import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { Trace2Adapter } from './trace2-adapter.js'
import { Trace2LegacyApiAdapter } from './trace2-legacy-api-adapter.js'

export function createTrace2Adapter(): Trace2Adapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const traceBaseUrl = import.meta.env.VITE_TRACE_API_BASE_URL ?? ''

  // Empty traceBaseUrl is intentional for same-origin Databricks Apps deployment
  // (fetch('/api/trace2/...') resolves against the current host).
  if (adapterMode === 'legacy-api') {
    if (!featureFlags.traceability.legacyApi) {
      return createDisabledAdapter<Trace2Adapter>(
        'legacy-api',
        'Traceability Legacy API adapter is disabled by feature flags.'
      )
    }
    return new Trace2LegacyApiAdapter(traceBaseUrl)
  }
  if (adapterMode === 'databricks-api') {
    if (!featureFlags.traceability.databricksApi) {
      return createDisabledAdapter<Trace2Adapter>(
        'databricks-api',
        'Traceability Databricks API adapter is disabled by feature flags.'
      )
    }
    return createDisabledAdapter<Trace2Adapter>(
      'databricks-api',
      'Traceability native Databricks API adapter is not yet implemented. ' +
      'Set VITE_ADAPTER_MODE=legacy-api for the V1 proxy, or VITE_ADAPTER_MODE=mock for fixtures.'
    )
  }
  return new Trace2Adapter()
}

/**
 * Singleton Trace2 adapter instance.
 * Mode is determined by VITE_ADAPTER_MODE at build time:
 *   - 'mock'       → returns realistic fixtures (default)
 *   - 'legacy-api' → calls V1 via V2 proxy; requires VITE_TRACE_API_BASE_URL
 *   - 'databricks-api' → calls V2 FastAPI routes backed by Databricks
 */
export const trace2Adapter: Trace2Adapter = createTrace2Adapter()
