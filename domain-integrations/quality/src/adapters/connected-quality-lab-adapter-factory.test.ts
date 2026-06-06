import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setFeatureFlags } from '@connectio/feature-flags'
import { createConnectedQualityLabAdapter } from './connected-quality-lab-adapter-factory.js'
import { ConnectedQualityLabLegacyApiAdapter } from './connected-quality-lab-legacy-api-adapter.js'

describe('ConnectedQualityLabAdapter Factory Gating', () => {
  beforeEach(() => {
    setFeatureFlags({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is databricks-api but featureFlag is false', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    setFeatureFlags({
      'quality.liveSources': false,
    })

    const adapter = createConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({ plantId: 'IE10' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.code).toBe('unauthorized')
    expect(result.error.message).toContain('disabled')
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is legacy-api but featureFlag is false', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    setFeatureFlags({
      'quality.liveSources': false,
    })

    const adapter = createConnectedQualityLabAdapter()
    const result = await adapter.getLabFailures({ plantId: 'IE10' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('legacy-api')
    expect(result.error.code).toBe('unauthorized')
  })

  it('returns a ConnectedQualityLab legacy API adapter when VITE_ADAPTER_MODE is legacy-api and featureFlag is true', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    setFeatureFlags({
      'quality.liveSources': true,
    })

    const adapter = createConnectedQualityLabAdapter()
    expect(adapter).toBeInstanceOf(ConnectedQualityLabLegacyApiAdapter)
  })
})
