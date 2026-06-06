import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setFeatureFlags } from '@connectio/feature-flags'
import { createTrace2Adapter } from './trace2-adapter-factory.js'
import { Trace2LegacyApiAdapter } from './trace2-legacy-api-adapter.js'

describe('Trace2Adapter Factory Gating', () => {
  beforeEach(() => {
    setFeatureFlags({})
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    vi.stubEnv('VITE_TRACE_API_BASE_URL', 'http://localhost:8000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is legacy-api but featureFlag is false', async () => {
    setFeatureFlags({
      'traceability.legacyApi': false,
    })

    const adapter = createTrace2Adapter()
    const result = await adapter.getBatchHeaderSummary({ batchId: 'B123', materialId: 'M123', plantId: 'IE10' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('legacy-api')
    expect(result.error.code).toBe('unauthorized')
    expect(result.error.message).toContain('disabled')
  })

  it('returns a Trace2 legacy API adapter when VITE_ADAPTER_MODE is legacy-api and featureFlag is true', () => {
    setFeatureFlags({
      'traceability.legacyApi': true,
    })

    const adapter = createTrace2Adapter()
    expect(adapter).toBeInstanceOf(Trace2LegacyApiAdapter)
  })

  it('returns the HTTP adapter when VITE_ADAPTER_MODE is databricks-api and featureFlag is true', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    setFeatureFlags({
      'traceability.databricksApi': true,
    })

    const adapter = createTrace2Adapter()
    expect(adapter).toBeInstanceOf(Trace2LegacyApiAdapter)
  })

  it('returns a disabled adapter when databricks-api mode is feature-flagged off', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    setFeatureFlags({
      'traceability.databricksApi': false,
    })

    const adapter = createTrace2Adapter()
    const result = await adapter.searchBatches({ query: 'cheese' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.message).toContain('disabled')
  })
})
