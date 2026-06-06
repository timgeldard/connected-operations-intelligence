import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setFeatureFlags } from '@connectio/feature-flags'
import { createProcessOrderReviewAdapter } from './process-order-review-adapter-factory.js'
import { ProcessOrderReviewDatabricksApiAdapter } from './process-order-review-databricks-api-adapter.js'

describe('ProcessOrderReviewAdapter Factory Gating', () => {
  beforeEach(() => {
    setFeatureFlags({})
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    vi.stubEnv('VITE_POH_API_BASE_URL', 'http://localhost:8000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is databricks-api but featureFlag is false', async () => {
    setFeatureFlags({
      'poh.databricksApi': false,
    })

    const adapter = createProcessOrderReviewAdapter()
    const result = await adapter.getProcessOrderHeader({ processOrderId: 'PO-123', plantId: 'IE10' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.code).toBe('unauthorized')
    expect(result.error.message).toContain('disabled')
  })

  it('returns a Databricks API adapter when VITE_ADAPTER_MODE is databricks-api and featureFlag is true', () => {
    setFeatureFlags({
      'poh.databricksApi': true,
    })

    const adapter = createProcessOrderReviewAdapter()
    expect(adapter).toBeInstanceOf(ProcessOrderReviewDatabricksApiAdapter)
  })
})
