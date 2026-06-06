import '@testing-library/jest-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ProcessOrderReviewLegacyApiAdapter } from './process-order-review-legacy-api-adapter.js'
import type { ProcessOrderReviewAdapterRequest } from './process-order-review-adapter.js'

// ---------------------------------------------------------------------------
// V1-shaped process order header response fixture (snake_case)
// ---------------------------------------------------------------------------

const V1_ORDER_HEADER_OK = {
  process_order_id: 'PO-240308-3847',
  order_type: 'process-order',
  material_id: 'MAT-CH-EMMENTAL-BLOCK',
  material_description: 'Emmental Block 4 kg',
  batch_id: 'CH-240308-0047',
  plant_id: 'IE10',
  planned_qty: 2400,
  confirmed_qty: 1860,
  uom: 'KG',
  planned_start: '2024-03-08T00:00:00.000Z',
  planned_finish: '2024-03-08T23:59:00.000Z',
  actual_start: '2024-03-08T00:15:00.000Z',
  order_status: 'in-process',
}

const BASE_URL = 'http://localhost:8000'
const adapter = new ProcessOrderReviewLegacyApiAdapter(BASE_URL)

const fullRequest: ProcessOrderReviewAdapterRequest = {
  processOrderId: 'PO-240308-3847',
  plantId: 'IE10',
  batchId: 'CH-240308-0047',
}

const emptyRequest: ProcessOrderReviewAdapterRequest = {
  // processOrderId intentionally absent → falls back to mock
}

function mockFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  })
}

function mockFetchError(message = 'Network error') {
  return vi.fn().mockRejectedValue(new TypeError(message))
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(200, V1_ORDER_HEADER_OK))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProcessOrderReviewLegacyApiAdapter.getProcessOrderHeader', () => {
  it('returns ok:true with source=legacy-api on a successful V1 response', async () => {
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('legacy-api')
  })

  it('maps V1 snake_case fields to ProcessOrderHeader contract', async () => {
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const d = result.data
    expect(d.processOrderId).toBe('PO-240308-3847')
    expect(d.orderType).toBe('process-order')
    expect(d.materialId).toBe('MAT-CH-EMMENTAL-BLOCK')
    expect(d.materialDescription).toBe('Emmental Block 4 kg')
    expect(d.batchId).toBe('CH-240308-0047')
    expect(d.plantId).toBe('IE10')
    expect(d.plannedQuantity).toBe(2400)
    expect(d.confirmedQuantity).toBe(1860)
    expect(d.uom).toBe('KG')
    expect(d.plannedStart).toBe('2024-03-08T00:00:00.000Z')
    expect(d.plannedFinish).toBe('2024-03-08T23:59:00.000Z')
    expect(d.actualStart).toBe('2024-03-08T00:15:00.000Z')
    expect(d.orderStatus).toBe('in-process')
  })

  it('falls back to camelCase variant fields when snake_case is absent', async () => {
    const camelResponse = {
      processOrderId: 'PO-240308-3847',
      orderType: 'process-order',
      materialId: 'MAT-CH-EMMENTAL-BLOCK',
      materialDescription: 'Emmental Block 4 kg',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      plannedQuantity: 2400,
      confirmedQuantity: 1860,
      uom: 'KG',
      plannedStart: '2024-03-08T00:00:00.000Z',
      plannedFinish: '2024-03-08T23:59:00.000Z',
      orderStatus: 'in-process',
    }
    vi.stubGlobal('fetch', mockFetch(200, camelResponse))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.processOrderId).toBe('PO-240308-3847')
    expect(result.data.plannedQuantity).toBe(2400)
  })

  it('falls back to mock when processOrderId is absent', async () => {
    const result = await adapter.getProcessOrderHeader(emptyRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Base mock adapter now sets source to 'mock'
    expect(result.source).toBe('mock')
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
  })

  it('returns ok:false with code=unauthorized on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.displayState).toBe('unauthorized')
    expect(result.source).toBe('legacy-api')
    expect(result.error.retryable).toBe(false)
  })

  it('returns ok:false with code=not-found on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}, false))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.displayState).toBe('error')
  })

  it('returns ok:false with retryable=true on 500', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}, false))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('returns ok:false on network failure, retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to connect'))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('includes fetchedAt ISO timestamp on success', async () => {
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sends process_order_id and plant_id in the request body', async () => {
    await adapter.getProcessOrderHeader(fullRequest)
    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/por/order-header')
    const body = JSON.parse(opts?.body as string)
    expect(body.process_order_id).toBe('PO-240308-3847')
    expect(body.plant_id).toBe('IE10')
  })

  it('falls back request.processOrderId when V1 omits process_order_id', async () => {
    const noId = { ...V1_ORDER_HEADER_OK }
    delete (noId as Record<string, unknown>).process_order_id
    vi.stubGlobal('fetch', mockFetch(200, noId))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.processOrderId).toBe('PO-240308-3847')
  })
})

// ---------------------------------------------------------------------------
// Source-truthful unavailable defaults (PR #110)
// ---------------------------------------------------------------------------

describe('ProcessOrderReviewLegacyApiAdapter source-truthful defaults', () => {
  it('falls back orderStatus to "unknown" (NOT "released") when V1 omits the field', async () => {
    const noStatus = { ...V1_ORDER_HEADER_OK }
    delete (noStatus as Record<string, unknown>).order_status
    vi.stubGlobal('fetch', mockFetch(200, noStatus))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.orderStatus).not.toBe('released')
    expect(result.data.orderStatus).toBe('unknown')
  })

  it('preserves plannedStart=null when V1 omits planned_start (no synthetic now() default)', async () => {
    const noStart = { ...V1_ORDER_HEADER_OK }
    delete (noStart as Record<string, unknown>).planned_start
    vi.stubGlobal('fetch', mockFetch(200, noStart))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.plannedStart).toBeNull()
  })

  it('preserves plannedFinish=null when V1 omits planned_finish (no synthetic now() default)', async () => {
    const noFinish = { ...V1_ORDER_HEADER_OK }
    delete (noFinish as Record<string, unknown>).planned_finish
    vi.stubGlobal('fetch', mockFetch(200, noFinish))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.plannedFinish).toBeNull()
  })

  it('preserves actualStart/actualFinish=null when V1 omits both fields', async () => {
    const noActuals = { ...V1_ORDER_HEADER_OK }
    delete (noActuals as Record<string, unknown>).actual_start
    delete (noActuals as Record<string, unknown>).actual_finish
    vi.stubGlobal('fetch', mockFetch(200, noActuals))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.actualStart).toBeNull()
    expect(result.data.actualFinish).toBeNull()
  })

  it('propagates orderStatus="unknown" verbatim when V1 returns it explicitly', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { ...V1_ORDER_HEADER_OK, order_status: 'unknown' }))
    const result = await adapter.getProcessOrderHeader(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.orderStatus).toBe('unknown')
  })
})
