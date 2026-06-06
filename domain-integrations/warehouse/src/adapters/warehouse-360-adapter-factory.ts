import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'
import { Warehouse360LegacyApiAdapter } from './warehouse-360-legacy-api-adapter.js'


export function createWarehouse360Adapter(): Warehouse360Adapter {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const wh360BaseUrl = import.meta.env.VITE_WH360_API_BASE_URL ?? ''

  if (adapterMode === 'databricks-api') {
    if (!featureFlags.warehouse.databricksApi) {
      return createDisabledAdapter<Warehouse360Adapter>(
        'databricks-api',
        'Warehouse 360 Databricks API adapter is disabled by feature flags.'
      )
    }
    // Falls back to legacy-api or default adapter since Databricks is not implemented yet
  }
  // Empty wh360BaseUrl is intentional for same-origin Databricks Apps deployment.
  if (adapterMode === 'legacy-api') {
    if (!featureFlags.warehouse.databricksApi) {
      return createDisabledAdapter<Warehouse360Adapter>(
        'legacy-api',
        'Warehouse 360 Legacy API adapter is disabled by feature flags.'
      )
    }
    return new Warehouse360LegacyApiAdapter(wh360BaseUrl)
  }
  return new Warehouse360Adapter()
}

export const warehouse360AdapterInstance: Warehouse360Adapter = createWarehouse360Adapter()
