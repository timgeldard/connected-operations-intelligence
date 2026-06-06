import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { ConnectedQualityLabAdapter } from './connected-quality-lab-adapter.js'
import { ConnectedQualityLabLegacyApiAdapter } from './connected-quality-lab-legacy-api-adapter.js'

export function createConnectedQualityLabAdapter(): ConnectedQualityLabAdapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const cqBaseUrl = import.meta.env.VITE_CQ_API_BASE_URL ?? ''

  if (adapterMode === 'databricks-api') {
    if (!featureFlags.quality.liveSources) {
      return createDisabledAdapter<ConnectedQualityLabAdapter>(
        'databricks-api',
        'Connected Quality Lab Databricks API adapter is disabled by feature flags.'
      )
    }
    // Falls back to legacy-api or default adapter since Databricks is not implemented yet
  }
  // Empty cqBaseUrl is intentional for same-origin Databricks Apps deployment.
  if (adapterMode === 'legacy-api') {
    if (!featureFlags.quality.liveSources) {
      return createDisabledAdapter<ConnectedQualityLabAdapter>(
        'legacy-api',
        'Connected Quality Lab Legacy API adapter is disabled by feature flags.'
      )
    }
    return new ConnectedQualityLabLegacyApiAdapter(cqBaseUrl)
  }
  return new ConnectedQualityLabAdapter()
}

export const connectedQualityLabAdapterInstance: ConnectedQualityLabAdapter =
  createConnectedQualityLabAdapter()
