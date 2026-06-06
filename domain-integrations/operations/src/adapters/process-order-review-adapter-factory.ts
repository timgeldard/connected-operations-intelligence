import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import { ProcessOrderReviewLegacyApiAdapter } from './process-order-review-legacy-api-adapter.js'
import { ProcessOrderReviewDatabricksApiAdapter } from './process-order-review-databricks-api-adapter.js'

export function createProcessOrderReviewAdapter(): ProcessOrderReviewAdapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const porBaseUrl = import.meta.env.VITE_POH_API_BASE_URL ?? ''

  // Empty porBaseUrl is intentional for same-origin Databricks Apps deployment.
  if (adapterMode === 'databricks-api') {
    if (!featureFlags.poh.databricksApi) {
      return createDisabledAdapter<ProcessOrderReviewAdapter>(
        'databricks-api',
        'Process Order Review Databricks API adapter is disabled by feature flags.'
      )
    }
    return new ProcessOrderReviewDatabricksApiAdapter(porBaseUrl)
  }
  if (adapterMode === 'legacy-api') {
    // Use the Databricks adapter in legacy-api mode too: operations, confirmations, and goods
    // movements have no V1 equivalents and are Databricks-native. The Databricks adapter extends
    // the legacy adapter so search and header still proxy through the FastAPI backend as before.
    return new ProcessOrderReviewDatabricksApiAdapter(porBaseUrl)
  }
  return new ProcessOrderReviewAdapter()
}

export const processOrderReviewAdapterInstance: ProcessOrderReviewAdapter = createProcessOrderReviewAdapter()
