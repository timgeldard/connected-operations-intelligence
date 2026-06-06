import { createDisabledAdapter } from '@connectio/source-adapters'
import { featureFlags } from '@connectio/feature-flags'
import { SPCMonitoringAdapter } from './spc-monitoring-adapter.js'
import { SPCMonitoringLegacyApiAdapter } from './spc-monitoring-legacy-api-adapter.js'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'

/**
 * Factory for creating the appropriate SPC monitoring adapter based on the
 * VITE_ADAPTER_MODE environment variable.
 */
export function spcMonitoringAdapterFactory(): SPCMonitoringAdapter {
  const mode = import.meta.env.VITE_ADAPTER_MODE || 'mock'
  const baseUrl = import.meta.env.VITE_LEGACY_API_BASE_URL ?? 'http://127.0.0.1:8000'

  if (mode === 'databricks-api') {
    if (!featureFlags.spc.liveSources) {
      return createDisabledAdapter<SPCMonitoringAdapter>(
        'databricks-api',
        'SPC Monitoring Databricks API adapter is disabled by feature flags.',
      )
    }
    // Native Databricks integration is currently blocked/pending gold-view alignment.
    // Returns unavailable/not-implemented status until native routes exist.
    return new SPCMonitoringDatabricksApiAdapter(baseUrl)
  }

  if (mode === 'legacy-api') {
    if (!featureFlags.spc.liveSources) {
      return createDisabledAdapter<SPCMonitoringAdapter>(
        'legacy-api',
        'SPC Monitoring Legacy API adapter is disabled by feature flags.',
      )
    }
    // V1 SPC proxy routes exist (wired but not browser-verified).
    // Proxies to V1 SPC FastAPI backend via V2 gateway.
    return new SPCMonitoringLegacyApiAdapter(baseUrl)
  }

  return new SPCMonitoringAdapter()
}

/** Shared singleton instance for hooks and panels. */
export const spcMonitoringAdapter = spcMonitoringAdapterFactory()
