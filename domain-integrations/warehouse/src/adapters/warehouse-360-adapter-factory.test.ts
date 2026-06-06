import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setFeatureFlags } from '@connectio/feature-flags'
import { createWarehouse360Adapter } from './warehouse-360-adapter-factory.js'
import { Warehouse360LegacyApiAdapter } from './warehouse-360-legacy-api-adapter.js'

describe('Warehouse360Adapter Factory Gating', () => {
  beforeEach(() => {
    setFeatureFlags({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is databricks-api but featureFlag is false', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'databricks-api')
    setFeatureFlags({
      'warehouse.databricksApi': false,
    })

    const adapter = createWarehouse360Adapter()
    const result = await adapter.getWarehouse360Summary({ plantId: 'IE10', warehouseId: 'W123' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.code).toBe('unauthorized')
    expect(result.error.message).toContain('disabled')
  })

  it('returns a disabled adapter when VITE_ADAPTER_MODE is legacy-api but featureFlag is false', async () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    setFeatureFlags({
      'warehouse.databricksApi': false,
    })

    const adapter = createWarehouse360Adapter()
    const result = await adapter.getWarehouse360Summary({ plantId: 'IE10', warehouseId: 'W123' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('legacy-api')
    expect(result.error.code).toBe('unauthorized')
  })

  it('returns a Warehouse360 legacy API adapter when VITE_ADAPTER_MODE is legacy-api and featureFlag is true', () => {
    vi.stubEnv('VITE_ADAPTER_MODE', 'legacy-api')
    setFeatureFlags({
      'warehouse.databricksApi': true,
    })

    const adapter = createWarehouse360Adapter()
    expect(adapter).toBeInstanceOf(Warehouse360LegacyApiAdapter)
  })
})
