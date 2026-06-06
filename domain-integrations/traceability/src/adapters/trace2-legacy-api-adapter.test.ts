import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Trace2LegacyApiAdapter } from './trace2-legacy-api-adapter.js'
import type { Trace2AdapterRequest } from './trace2-adapter.js'
import type { BackendTraceGraphResponse } from './trace2-graph-mapper.js'

// ---------------------------------------------------------------------------
// V1-shaped batch header response fixture (snake_case)
// ---------------------------------------------------------------------------

const V1_BATCH_HEADER_OK = {
  material_id: '100023847',
  batch_id: 'CH-240308-0047',
  material_name: 'EMMENTAL BLOCK NATURAL 100KG',
  process_order: 'PO-240308-1189',
  plant_id: 'IE10',
  manufacture_date: '2024-03-08',
  expiry_date: '2024-09-08',
  uom: 'KG',
  qty_produced: 2400,
  unrestricted: 0,
  blocked: 100,
  qi: 2300,
  restricted: 0,
  transit: 0,
  batch_status: 'blocked',
}

const BASE_URL = 'http://localhost:8000'
const adapter = new Trace2LegacyApiAdapter(BASE_URL)

const fullRequest: Trace2AdapterRequest = {
  investigationId: 'INV-001',
  batchId: 'CH-240308-0047',
  materialId: '100023847',
  plantId: 'IE10',
}

const partialRequest: Trace2AdapterRequest = {
  investigationId: 'INV-001',
  // batchId and materialId intentionally absent
}

const SEARCH_RESPONSE_OK = {
  query: 'cheese',
  total: 1,
  truncated: false,
  wildcardApplied: false,
  items: [
    {
      materialId: '20035129',
      materialDescription: 'CHEESE POWDER BLEND 25KG',
      batchId: '8000049668',
      plantId: 'C061',
      plantName: 'Kerry Cork',
      processOrderId: '007006964801',
      quantity: 1000,
      uom: 'KG',
      matchTypes: ['description'],
    },
  ],
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
  vi.stubGlobal('fetch', mockFetch(200, V1_BATCH_HEADER_OK))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Trace2LegacyApiAdapter.searchBatches', () => {
  it('calls POST /api/trace2/batch-search with query and max_rows', async () => {
    vi.stubGlobal('fetch', mockFetch(200, SEARCH_RESPONSE_OK))

    await adapter.searchBatches({
      query: '20035129 8000049668',
      materialId: '20035129',
      batchId: '8000049668',
      maxRows: 10,
    })

    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/batch-search')
    expect(opts?.method).toBe('POST')
    const body = JSON.parse(String(opts?.body))
    expect(body.query).toBe('20035129 8000049668')
    expect(body.material_id).toBe('20035129')
    expect(body.batch_id).toBe('8000049668')
    expect(body.max_rows).toBe(10)
  })

  it('returns source=databricks-api and validates search results', async () => {
    vi.stubGlobal('fetch', mockFetch(200, SEARCH_RESPONSE_OK))

    const result = await adapter.searchBatches({ query: 'cheese' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.items[0].materialId).toBe('20035129')
    expect(result.data.items[0].matchTypes).toEqual(['description'])
  })

  it('returns ok:false without fetch for blank search', async () => {
    const result = await adapter.searchBatches({ query: '   ' })

    expect(result.ok).toBe(false)
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.source).toBe('databricks-api')
  })

  it('surfaces 401 as unauthorized', async () => {
    vi.stubGlobal('fetch', mockFetch(401, { detail: 'Unauthorized' }, false))

    const result = await adapter.searchBatches({ query: 'cheese' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.displayState).toBe('unauthorized')
    expect(result.source).toBe('databricks-api')
  })

  it('does not fall back to mock on backend outage', async () => {
    vi.stubGlobal('fetch', mockFetch(503, { detail: 'batch-search requires BACKEND_ADAPTER_MODE=databricks-api' }, false))

    const result = await adapter.searchBatches({ query: 'cheese' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.source).toBe('databricks-api')
  })
})

describe('Trace2LegacyApiAdapter.getBatchHeaderSummary', () => {
  it('returns ok:true with source=legacy-api on a successful V1 response', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('legacy-api')
  })

  it('maps V1 snake_case fields to BatchHeaderSummary contract', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const d = result.data
    expect(d.materialId).toBe('100023847')
    expect(d.batchId).toBe('CH-240308-0047')
    expect(d.materialDescription).toBe('EMMENTAL BLOCK NATURAL 100KG')
    expect(d.plantId).toBe('IE10')
    expect(d.quantity).toBe(2400)
    expect(d.uom).toBe('KG')
    expect(d.processOrderId).toBe('PO-240308-1189')
  })

  it('maps V1 individual stock quantities to schema fields', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const d = result.data
    // Fixture: unrestricted=0, blocked=100, qi=2300, restricted=0, transit=0
    expect(d.unrestricted).toBe(0)
    expect(d.blocked).toBe(100)
    expect(d.qualityInspection).toBe(2300)
    expect(d.restricted).toBe(0)
    expect(d.transit).toBe(0)
  })

  it('pads bare dates to ISO 8601 format', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.manufactureDate).toBe('2024-03-08T00:00:00.000Z')
    expect(result.data.expiryDate).toBe('2024-09-08T00:00:00.000Z')
  })

  it('maps batch_status="blocked" → batchStatus="blocked"', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.batchStatus).toBe('blocked')
  })

  it('derives stockStatus from stock quantities (qi>0 → quality-inspection)', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Fixture: blocked=100, qi=2300 → blocked wins
    expect(result.data.stockStatus).toBe('blocked')
  })

  it('derives releaseStatus=blocked when blocked>0', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.releaseStatus).toBe('blocked')
  })

  it('derives stockStatus=restricted when restricted>0 and transit=0', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ ...V1_BATCH_HEADER_OK, blocked: 0, qi: 0, transit: 0, restricted: 50 }),
        { status: 200 },
      ),
    )
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.stockStatus).toBe('restricted')
  })

  it('falls back to mock (source from super) when batchId is missing', async () => {
    const result = await adapter.getBatchHeaderSummary(partialRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Mock returns source undefined (base adapter doesn't set source)
    expect(result.source).toBeUndefined()
    // fetch should NOT have been called
    const fetchMock = vi.mocked(global.fetch)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns ok:false with code=unauthorized on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.source).toBe('legacy-api')
    expect(result.displayState).toBe('unauthorized')
    expect(result.error.retryable).toBe(false)
  })

  it('returns ok:false with code=not-found on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}, false))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.displayState).toBe('error')
  })

  it('returns ok:false with code=network on 500, retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}, false))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('returns ok:false on network failure (TypeError)', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to fetch'))
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('includes fetchedAt ISO timestamp on success', async () => {
    const result = await adapter.getBatchHeaderSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('passes material_id and batch_id as JSON body to V1', async () => {
    await adapter.getBatchHeaderSummary(fullRequest)
    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/trace2/batch-header')
    const body = JSON.parse(opts?.body as string)
    expect(body.material_id).toBe('100023847')
    expect(body.batch_id).toBe('CH-240308-0047')
  })

  it('includes plant_id in body when request has plantId', async () => {
    await adapter.getBatchHeaderSummary(fullRequest)  // fullRequest has plantId='IE10'
    const fetchMock = vi.mocked(global.fetch)
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.plant_id).toBe('IE10')
  })

  it('omits plant_id from body when request has no plantId', async () => {
    const noPlantRequest: Trace2AdapterRequest = {
      investigationId: 'INV-001',
      batchId: 'CH-240308-0047',
      materialId: '100023847',
    }
    await adapter.getBatchHeaderSummary(noPlantRequest)
    const fetchMock = vi.mocked(global.fetch)
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.plant_id).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getTraceGraph tests
// ---------------------------------------------------------------------------

const ANCHOR_KEY = '20052009:0008602411:C061'
const UPSTREAM_KEY = '99000001:0001111111:C061'

const BACKEND_GRAPH_OK: BackendTraceGraphResponse = {
  rootBatch: '20052009/0008602411',
  nodes: [
    {
      id: ANCHOR_KEY,
      materialId: '20052009',
      batchId: '0008602411',
      plantId: 'C061',
      depth: 0,
      directions: ['anchor'],
      isAnchor: true,
    },
    {
      id: UPSTREAM_KEY,
      materialId: '99000001',
      batchId: '0001111111',
      plantId: 'C061',
      depth: 1,
      directions: ['upstream'],
      isAnchor: false,
    },
  ],
  edges: [
    {
      id: `${UPSTREAM_KEY}|${ANCHOR_KEY}|PRODUCTION||0`,
      source: UPSTREAM_KEY,
      target: ANCHOR_KEY,
      linkType: 'PRODUCTION',
      processOrderId: 'PO-001',
      materialDocumentNumber: 'MAT-001',
      purchaseOrderId: null,
      supplierId: null,
      customerId: null,
      deliveryId: null,
      salesOrderId: null,
      quantity: 100.0,
      uom: 'KG',
      postingDate: '2026-01-01',
      movementType: '101',
    },
  ],
  depth: 1,
  truncated: false,
  warnings: [],
}

const traceRequest: Trace2AdapterRequest = {
  investigationId: 'INV-001',
  batchId: '0008602411',
  materialId: '20052009',
  plantId: 'C061',
  direction: 'both',
  maxDepth: 6,
  maxEdges: 1000,
}

describe('Trace2LegacyApiAdapter.getTraceGraph', () => {
  it('calls POST /api/trace2/trace-graph', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph(traceRequest)
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/trace-graph')
    expect(opts?.method).toBe('POST')
    vi.unstubAllGlobals()
  })

  it('sends correct snake_case request body', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph(traceRequest)
    const [, opts] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.material_id).toBe('20052009')
    expect(body.batch_id).toBe('0008602411')
    expect(body.plant_id).toBe('C061')
    expect(body.direction).toBe('both')
    expect(body.max_depth).toBe(6)
    expect(body.max_edges).toBe(1000)
    vi.unstubAllGlobals()
  })

  it('returns ok:true with source=databricks-api on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('maps backend response to TraceGraph frontend contract', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const g = result.data
    expect(g.rootBatch).toBe('0008602411')
    expect(g.nodes).toHaveLength(2)
    expect(g.edges).toHaveLength(1)
    expect(g.edges[0].relationshipType).toBe('produced-from')
    expect(g.direction).toBe('both')
    vi.unstubAllGlobals()
  })

  it('preserves leading zeros in batch_id (string not numeric)', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const anchorNode = result.data.nodes.find(n => n.id === ANCHOR_KEY)
    expect(anchorNode?.batchId).toBe('0008602411')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with code=unauthorized on 401 — does not use mock', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with code=network on 503 — does not use mock', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}, false))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('network')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false on network error — does not use mock', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to fetch'))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false (not mock) when plantId is missing', async () => {
    const partialTraceRequest: Trace2AdapterRequest = {
      investigationId: 'INV-001',
      batchId: '0008602411',
      materialId: '20052009',
      // plantId absent
    }
    const result = await adapter.getTraceGraph(partialTraceRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    // fetch must not have been called
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    expect(result.source).toBe('databricks-api')
  })

  it('propagates warnings and truncated flag', async () => {
    const truncatedGraph: BackendTraceGraphResponse = {
      ...BACKEND_GRAPH_OK,
      truncated: true,
      warnings: ['max_edges_reached', 'max_depth_reached'],
    }
    vi.stubGlobal('fetch', mockFetch(200, truncatedGraph))
    const result = await adapter.getTraceGraph(traceRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.truncated).toBe(true)
    expect(result.data.warnings).toContain('max_edges_reached')
    expect(result.data.warnings).toContain('max_depth_reached')
    vi.unstubAllGlobals()
  })

  it('passes direction from request when provided', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph({ ...traceRequest, direction: 'upstream' })
    const [, opts] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.direction).toBe('upstream')
    vi.unstubAllGlobals()
  })

  it('defaults direction to both when not in request', async () => {
    const minimalRequest: Trace2AdapterRequest = {
      investigationId: 'INV-001',
      batchId: '0008602411',
      materialId: '20052009',
      plantId: 'C061',
    }
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph(minimalRequest)
    const [, opts] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.direction).toBe('both')
    expect(body.max_depth).toBe(3)
    expect(body.max_edges).toBe(1000)
    vi.unstubAllGlobals()
  })

  it('passes maxDepth and maxEdges from request when provided', async () => {
    vi.stubGlobal('fetch', mockFetch(200, BACKEND_GRAPH_OK))
    await adapter.getTraceGraph({ ...traceRequest, maxDepth: 4, maxEdges: 500 })
    const [, opts] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(opts?.body as string)
    expect(body.max_depth).toBe(4)
    expect(body.max_edges).toBe(500)
    vi.unstubAllGlobals()
  })
})

// ---------------------------------------------------------------------------
// getCustomerExposureSummary tests
// ---------------------------------------------------------------------------

const CE_RESPONSE_OK = {
  affectedCustomers: 2,
  affectedDeliveries: 3,
  shippedQuantity: 600.0,
  countries: [],
  highestSeverity: 'medium',
  blockedDeliveries: 0,
  recallRecommended: false,
  maxExposureDepth: 1,
}

describe('Trace2LegacyApiAdapter.getCustomerExposureSummary', () => {
  it('calls POST /api/trace2/customer-deliveries', async () => {
    vi.stubGlobal('fetch', mockFetch(200, CE_RESPONSE_OK))
    await adapter.getCustomerExposureSummary(fullRequest)
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/customer-deliveries')
    expect(opts?.method).toBe('POST')
    vi.unstubAllGlobals()
  })

  it('returns ok:true with source=databricks-api on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, CE_RESPONSE_OK))
    const result = await adapter.getCustomerExposureSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.affectedCustomers).toBe(2)
    expect(result.data.countries).toEqual([])
    expect(result.data.maxExposureDepth).toBe(1)
    vi.unstubAllGlobals()
  })

  it('returns ok:false with not-found and "do not interpret" message on 404', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(404, { detail: 'No customer delivery records returned from current source — do not interpret as zero exposure until source coverage is validated.' }, false),
    )
    const result = await adapter.getCustomerExposureSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.error.message.toLowerCase()).toContain('do not interpret as zero exposure')
    expect(result.displayState).toBe('error')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with unavailable message on 503', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}, false))
    const result = await adapter.getCustomerExposureSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message.toLowerCase()).toContain('do not interpret as zero exposure')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false (not mock) when batchId is missing', async () => {
    const result = await adapter.getCustomerExposureSummary(partialRequest)
    expect(result.ok).toBe(false)
    // fetch must NOT have been called — no network request for missing context
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.source).toBe('databricks-api')
  })
})

// ---------------------------------------------------------------------------
// getMassBalanceSummary tests
// ---------------------------------------------------------------------------

const MB_RESPONSE_OK = {
  inputQuantity: 1000.0,
  outputQuantity: 250.0,
  varianceQuantity: 750.0,
  variancePercent: 75.0,
  uom: 'KG',
  confidence: 1.0,
  unresolvedMovements: 0,
  movements: [],
}

describe('Trace2LegacyApiAdapter.getMassBalanceSummary', () => {
  it('calls POST /api/trace2/mass-balance', async () => {
    vi.stubGlobal('fetch', mockFetch(200, MB_RESPONSE_OK))
    await adapter.getMassBalanceSummary(fullRequest)
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/mass-balance')
    expect(opts?.method).toBe('POST')
    vi.unstubAllGlobals()
  })

  it('returns ok:true with source=databricks-api on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, MB_RESPONSE_OK))
    const result = await adapter.getMassBalanceSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.inputQuantity).toBe(1000.0)
    expect(result.data.uom).toBe('KG')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with not-found and "do not interpret" message on 404', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(404, { detail: 'No mass balance movements returned for this material + batch — do not interpret as a balanced mass balance until source coverage is validated.' }, false),
    )
    const result = await adapter.getMassBalanceSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.error.message.toLowerCase()).toContain('do not interpret')
    expect(result.error.message.toLowerCase()).toContain('balanced')
    expect(result.displayState).toBe('error')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false with unavailable message on 503', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}, false))
    const result = await adapter.getMassBalanceSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.message.toLowerCase()).toContain('do not interpret as balanced')
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false (not mock) when batchId is missing', async () => {
    const result = await adapter.getMassBalanceSummary(partialRequest)
    expect(result.ok).toBe(false)
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.source).toBe('databricks-api')
  })
})

// ---------------------------------------------------------------------------
// getSupplierExposureSummary tests
// ---------------------------------------------------------------------------

const SE_RESPONSE_OK = {
  supplierCount: 1,
  supplierLots: 20,
  upstreamMaterials: 1,
  openSupplierActions: 0,
  suppliers: [
    {
      supplierId: '0005002928',
      supplierName: 'PQ Silicas UK',
      countryId: 'GB',
      countryName: 'United Kingdom',
      receivedQuantity: 201300,
      batchCount: 20,
      uom: 'KG',
      lastReceiptDate: '2025-06-04',
    },
  ],
}

describe('Trace2LegacyApiAdapter.getSupplierExposureSummary', () => {
  it('calls POST /api/trace2/supplier-exposure', async () => {
    vi.stubGlobal('fetch', mockFetch(200, SE_RESPONSE_OK))
    await adapter.getSupplierExposureSummary(fullRequest)
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/supplier-exposure')
    expect(opts?.method).toBe('POST')
    vi.unstubAllGlobals()
  })

  it('returns ok:true with source=databricks-api on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, SE_RESPONSE_OK))
    const result = await adapter.getSupplierExposureSummary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.supplierCount).toBe(1)
    expect(result.data.suppliers?.[0].supplierName).toBe('PQ Silicas UK')
    expect(result.data.openSupplierActions).toBe(0)
    vi.unstubAllGlobals()
  })

  it('returns ok:false with unavailable message on 503', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}, false))
    const result = await adapter.getSupplierExposureSummary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.source).toBe('databricks-api')
    vi.unstubAllGlobals()
  })

  it('returns ok:false (not mock) when batchId is missing', async () => {
    const result = await adapter.getSupplierExposureSummary(partialRequest)
    expect(result.ok).toBe(false)
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.source).toBe('databricks-api')
  })
})

// ---------------------------------------------------------------------------
// getProductionHistory tests
// ---------------------------------------------------------------------------

const PH_RESPONSE_OK = {
  materialId: '70948010',
  totalBatches: 2,
  passCount: 1,
  failCount: 1,
  unknownCount: 0,
  rows: [
    {
      processOrderId: '007006964801',
      batchId: '0011062334',
      plantId: 'P648',
      materialId: '70948010',
      postingDate: '2025-09-28',
      quantity: 31335.789,
      uom: 'KG',
      qualityStatus: 'pass' as const,
    },
    {
      processOrderId: '007006964537',
      batchId: '0011059723',
      plantId: 'P132',
      materialId: '70948010',
      postingDate: '2025-09-28',
      quantity: 50804.613,
      uom: 'KG',
      qualityStatus: 'fail' as const,
    },
  ],
}

describe('Trace2LegacyApiAdapter.getProductionHistory', () => {
  it('calls POST /api/trace2/production-history', async () => {
    vi.stubGlobal('fetch', mockFetch(200, PH_RESPONSE_OK))
    await adapter.getProductionHistory(fullRequest)
    const [url, opts] = vi.mocked(global.fetch).mock.calls[0]
    expect(String(url)).toContain('/api/trace2/production-history')
    expect(opts?.method).toBe('POST')
    vi.unstubAllGlobals()
  })

  it('only sends material_id in body (no plant filter)', async () => {
    vi.stubGlobal('fetch', mockFetch(200, PH_RESPONSE_OK))
    await adapter.getProductionHistory(fullRequest)
    const [, opts] = vi.mocked(global.fetch).mock.calls[0]
    const body = JSON.parse(String(opts?.body))
    expect(body.material_id).toBe('100023847')
    expect(body.plant_id).toBeUndefined()
    expect(body.batch_id).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('returns ok:true with source=databricks-api on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, PH_RESPONSE_OK))
    const result = await adapter.getProductionHistory(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.totalBatches).toBe(2)
    expect(result.data.passCount).toBe(1)
    expect(result.data.failCount).toBe(1)
    vi.unstubAllGlobals()
  })

  it('returns ok:false (not mock) when materialId is missing', async () => {
    const result = await adapter.getProductionHistory(partialRequest)
    expect(result.ok).toBe(false)
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.source).toBe('databricks-api')
  })
})
