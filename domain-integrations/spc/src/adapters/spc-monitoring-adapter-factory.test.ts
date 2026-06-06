import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setFeatureFlags } from '@connectio/feature-flags'
import { spcMonitoringAdapterFactory } from './spc-monitoring-adapter-factory.js'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'
import { SPCMonitoringLegacyApiAdapter } from './spc-monitoring-legacy-api-adapter.js'

describe('SPCMonitoringAdapter Factory Gating', () => {
  beforeEach(() => {
    setFeatureFlags({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is databricks-api but featureFlag is false', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    setFeatureFlags({
      'spc.liveSources': false,
    })

    const adapter = spcMonitoringAdapterFactory()
    const result = await adapter.getMonitoredCharacteristics({ materialId: 'MAT-12345', plantId: 'IE10' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.code).toBe('unauthorized')
    expect(result.error.message).toContain('disabled')
  })

  it('returns a Databricks API adapter when VITE_ADAPTER_MODE is databricks-api and featureFlag is true', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    setFeatureFlags({
      'spc.liveSources': true,
    })

    const adapter = spcMonitoringAdapterFactory()
    expect(adapter).toBeInstanceOf(SPCMonitoringDatabricksApiAdapter)
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is legacy-api but featureFlag is false', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    setFeatureFlags({
      'spc.liveSources': false,
    })

    const adapter = spcMonitoringAdapterFactory()
    const result = await adapter.getMonitoredCharacteristics({ materialId: 'MAT-12345', plantId: 'IE10' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('legacy-api')
    expect(result.error.code).toBe('unauthorized')
  })

  it('returns a legacy-api adapter when VITE_ADAPTER_MODE is legacy-api and featureFlag is true', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    setFeatureFlags({
      'spc.liveSources': true,
    })

    const adapter = spcMonitoringAdapterFactory()
    expect(adapter).toBeInstanceOf(SPCMonitoringLegacyApiAdapter)
  })
})
