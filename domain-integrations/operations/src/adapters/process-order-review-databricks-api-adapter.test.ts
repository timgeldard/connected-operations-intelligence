import '@testing-library/jest-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProcessOrderReviewDatabricksApiAdapter } from './process-order-review-databricks-api-adapter.js'

const adapter = new ProcessOrderReviewDatabricksApiAdapter('http://localhost:8000')

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  })
}

describe('ProcessOrderReviewDatabricksApiAdapter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(200, []))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('attributes the same-origin header route to databricks-api mode', async () => {
    vi.stubGlobal('fetch', mockFetch(200, {
      processOrderId: '7006965038',
      orderType: 'process-order',
      materialId: '70373871',
      materialDescription: 'MIXED BERRY FLV LQD',
      plantId: 'C113',
      plannedQuantity: 0,
      confirmedQuantity: 0,
      uom: '',
      plannedStart: null,
      plannedFinish: null,
      orderStatus: 'closed',
    }))

    const result = await adapter.getProcessOrderHeader({
      processOrderId: '7006965038',
      plantId: 'C113',
    })

    expect(result.source).toBe('databricks-api')
    expect(result.ok).toBe(true)
  })

  it('does not fall back to mock when processOrderId is missing in databricks mode', async () => {
    const result = await adapter.getOrderOperations({})

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.code).toBe('invalid-data')
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
  })

  it('returns explicit databricks-api errors without mock fallback', async () => {
    vi.stubGlobal('fetch', mockFetch(503, { detail: 'BACKEND_ADAPTER_MODE required' }, false))

    const result = await adapter.getOrderGoodsMovements({ processOrderId: '7006965038' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.error.message).toContain('503')
  })
})
