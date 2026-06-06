import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Warehouse360LegacyApiAdapter } from './warehouse-360-legacy-api-adapter.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

// ---------------------------------------------------------------------------
// V1-shaped warehouse summary response fixture (snake_case)
// ---------------------------------------------------------------------------

const V1_WAREHOUSE_SUMMARY_OK = {
  warehouse_id: 'WH-IE10-MAIN',
  total_stock_lines: 412,
  unrestricted_lines: 380,
  hold_lines: 8,
  qi_lines: 24,
  open_gr: 3,
  open_gi: 5,
  open_transfers: 11,
  capacity_pct: 72.4,
  replenishment_needs: 2,
  confidence: 0.93,
}

const BASE_URL = 'http://localhost:8000'
const adapter = new Warehouse360LegacyApiAdapter(BASE_URL)

const fullRequest: Warehouse360AdapterRequest = {
  warehouseId: 'WH-IE10-MAIN',
  plantId: 'IE10',
}

const emptyRequest: Warehouse360AdapterRequest = {
  warehouseId: '', // falsy → falls back to mock
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
  vi.stubGlobal('fetch', mockFetch(200, V1_WAREHOUSE_SUMMARY_OK))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Warehouse360LegacyApiAdapter.getWarehouse360Summary', () => {
  it('returns ok:true with source=legacy-api on a successful V1 response', async () => {
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('legacy-api')
  })

  it('maps V1 snake_case fields to Warehouse360Summary contract', async () => {
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const d = result.data
    expect(d.warehouseId).toBe('WH-IE10-MAIN')
    expect(d.totalStockLines).toBe(412)
    expect(d.unrestrictedLines).toBe(380)
    expect(d.holdLines).toBe(8)
    expect(d.qualityInspectionLines).toBe(24)
    expect(d.openGoodsReceipts).toBe(3)
    expect(d.openGoodsIssues).toBe(5)
    expect(d.openTransfers).toBe(11)
    expect(d.capacityUtilizationPercent).toBe(72.4)
    expect(d.activeReplenishmentNeeds).toBe(2)
    expect(d.confidence).toBe(0.93)
  })

  it('falls back to camelCase variant fields when snake_case is absent', async () => {
    const camelResponse = {
      warehouseId: 'WH-IE10-MAIN',
      totalStockLines: 10,
      unrestrictedLines: 10,
      holdLines: 0,
      qualityInspectionLines: 0,
      openGoodsReceipts: 0,
      openGoodsIssues: 0,
      openTransfers: 0,
      capacityUtilizationPercent: 50,
      activeReplenishmentNeeds: 0,
    }
    vi.stubGlobal('fetch', mockFetch(200, camelResponse))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.warehouseId).toBe('WH-IE10-MAIN')
    expect(result.data.totalStockLines).toBe(10)
  })

  it('falls back to mock when warehouseId is empty/falsy', async () => {
    const result = await adapter.getWarehouse360Summary(emptyRequest)
    expect(result.ok).toBe(true)
    // Mock adapter sets source to 'mock'
    expect(result.source).toBe('mock')
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled()
  })

  it('returns ok:false with code=unauthorized on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unauthorized')
    expect(result.displayState).toBe('unauthorized')
    expect(result.source).toBe('legacy-api')
    expect(result.error.retryable).toBe(false)
  })

  it('returns ok:false with code=not-found on 404', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}, false))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not-found')
    expect(result.displayState).toBe('error')
  })

  it('returns ok:false with retryable=true on 500', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}, false))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('returns ok:false on network failure, retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetchError('Failed to connect'))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('unknown')
    expect(result.error.retryable).toBe(true)
    expect(result.source).toBe('legacy-api')
  })

  it('includes fetchedAt ISO timestamp on success', async () => {
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('sends warehouse_id and plant_id in the request body', async () => {
    await adapter.getWarehouse360Summary(fullRequest)
    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/wh360/warehouse-summary')
    const body = JSON.parse(opts?.body as string)
    expect(body.warehouse_id).toBe('WH-IE10-MAIN')
    expect(body.plant_id).toBe('IE10')
  })

  it('defaults confidence to 0.9 when absent from V1 response', async () => {
    const noConfidence = { ...V1_WAREHOUSE_SUMMARY_OK }
    delete (noConfidence as Record<string, unknown>).confidence
    vi.stubGlobal('fetch', mockFetch(200, noConfidence))
    const result = await adapter.getWarehouse360Summary(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.confidence).toBe(0.9)
  })
})

describe('Warehouse360LegacyApiAdapter native endpoints', () => {
  const fakeOverview = {
    plantId: 'IE10',
    warehouseId: 'WH-IE10-MAIN',
    inboundDueCount: 3,
    inboundOverdueCount: 1,
    outboundDueCount: 5,
    outboundOverdueCount: 0,
    stagingOpenCount: 8,
    stagingOverdueCount: 2,
    nearExpiryCount: 4,
    reconciliationExceptionCount: 2,
    blockedStockCount: 1,
  }

  const fakeInboundItem = {
    documentType: 'PO',
    purchaseOrderId: 'PO-001',
    stockTransportOrderId: '',
    itemId: '00010',
    vendorId: 'VEND-01',
    supplyingPlantId: '',
    materialId: 'MAT-01',
    materialDescription: 'Raw Milk',
    batchId: 'B-001',
    plantId: 'IE10',
    storageLocation: 'SL01',
    warehouseNumber: 'WH-IE10-MAIN',
    expectedDate: '2026-05-18T00:00:00',
    receivedDate: '',
    quantity: 100,
    unitOfMeasure: 'KG',
    status: 'OPEN',
    exceptionReason: '',
  }

  const fakeOutboundItem = {
    deliveryId: 'DEL-01',
    deliveryItemId: '000010',
    customerId: 'CUST-01',
    salesOrderId: 'SO-01',
    materialId: 'MAT-02',
    materialDescription: 'Emmental Block',
    batchId: 'B-002',
    plantId: 'IE10',
    storageLocation: 'SL02',
    warehouseNumber: 'WH-IE10-MAIN',
    plannedGoodsIssueDate: '2026-05-18T15:00:00',
    actualGoodsIssueDate: '',
    quantity: 50,
    unitOfMeasure: 'KG',
    status: 'OPEN',
    exceptionReason: '',
  }

  const fakeStagingItem = {
    processOrderId: 'PO-001',
    reservationId: 'RES-01',
    reservationItemId: '0001',
    materialId: 'MAT-03',
    materialDescription: 'Starter Culture',
    batchId: 'B-003',
    plantId: 'IE10',
    storageLocation: 'SL03',
    warehouseNumber: 'WH-IE10-MAIN',
    requirementDate: '2026-05-18T08:30:00',
    requiredQuantity: 2.5,
    stagedQuantity: 2.0,
    openQuantity: 0.5,
    unitOfMeasure: 'KG',
    stagingStatus: 'PARTIAL',
    exceptionReason: '',
  }

  const fakeExceptionItem = {
    exceptionType: 'quantity-mismatch',
    severity: 'high',
    materialId: 'MAT-01',
    batchId: 'B-001',
    plantId: 'IE10',
    storageLocation: 'SL01',
    warehouseNumber: 'WH-IE10-MAIN',
    quantity: 20,
    unitOfMeasure: 'KG',
    expiryDate: '2026-06-18T00:00:00',
    daysToExpiry: 31,
    documentId: 'DOC-01',
    processOrderId: '',
    deliveryId: '',
    purchaseOrderId: '',
    reason: 'Mismatch',
    recommendedReviewAction: 'Count',
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(200, fakeOverview))
  })

  it('getWarehouseOverview calls GET and returns source=databricks-api', async () => {
    const result = await adapter.getWarehouseOverview(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.warehouseId).toBe('WH-IE10-MAIN')
    expect(result.data.inboundDueCount).toBe(3)

    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/warehouse360/overview?warehouse_id=WH-IE10-MAIN')
    expect(opts?.method).toBe('GET')
  })

  it('getWarehouseInbound calls GET and returns source=databricks-api', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [fakeInboundItem]))
    const result = await adapter.getWarehouseInbound(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.length).toBe(1)
    expect(result.data[0].purchaseOrderId).toBe('PO-001')

    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/warehouse360/inbound?warehouse_id=WH-IE10-MAIN')
    expect(opts?.method).toBe('GET')
  })

  it('getWarehouseOutbound calls GET and returns source=databricks-api', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [fakeOutboundItem]))
    const result = await adapter.getWarehouseOutbound(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.length).toBe(1)
    expect(result.data[0].deliveryId).toBe('DEL-01')

    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/warehouse360/outbound?warehouse_id=WH-IE10-MAIN')
    expect(opts?.method).toBe('GET')
  })

  it('getWarehouseStaging calls GET and returns source=databricks-api', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [fakeStagingItem]))
    const result = await adapter.getWarehouseStaging(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.length).toBe(1)
    expect(result.data[0].processOrderId).toBe('PO-001')

    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/warehouse360/staging?warehouse_id=WH-IE10-MAIN')
    expect(opts?.method).toBe('GET')
  })

  it('getWarehouseExceptionItems calls GET and returns source=databricks-api', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [fakeExceptionItem]))
    const result = await adapter.getWarehouseExceptionItems(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.source).toBe('databricks-api')
    expect(result.data.length).toBe(1)
    expect(result.data[0].documentId).toBe('DOC-01')

    const fetchMock = vi.mocked(global.fetch)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/warehouse360/exceptions?warehouse_id=WH-IE10-MAIN')
    expect(opts?.method).toBe('GET')
  })

  it('handles 401 unauthorized errors correctly in native mode', async () => {
    vi.stubGlobal('fetch', mockFetch(401, {}, false))
    const methods = [
      () => adapter.getWarehouseOverview(fullRequest),
      () => adapter.getWarehouseInbound(fullRequest),
      () => adapter.getWarehouseOutbound(fullRequest),
      () => adapter.getWarehouseStaging(fullRequest),
      () => adapter.getWarehouseExceptionItems(fullRequest),
    ]

    for (const fn of methods) {
      const result = await fn()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.code).toBe('unauthorized')
      expect(result.displayState).toBe('unauthorized')
      expect(result.source).toBe('databricks-api')
    }
  })

  it('handles 404 not-found errors correctly in native mode', async () => {
    vi.stubGlobal('fetch', mockFetch(404, {}, false))
    const methods = [
      () => adapter.getWarehouseOverview(fullRequest),
      () => adapter.getWarehouseInbound(fullRequest),
      () => adapter.getWarehouseOutbound(fullRequest),
      () => adapter.getWarehouseStaging(fullRequest),
      () => adapter.getWarehouseExceptionItems(fullRequest),
    ]

    for (const fn of methods) {
      const result = await fn()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.code).toBe('network')
      expect(result.displayState).toBe('error')
      expect(result.source).toBe('databricks-api')
    }
  })

  it('handles 500 server errors correctly and asserts retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetch(500, {}, false))
    const methods = [
      () => adapter.getWarehouseOverview(fullRequest),
      () => adapter.getWarehouseInbound(fullRequest),
      () => adapter.getWarehouseOutbound(fullRequest),
      () => adapter.getWarehouseStaging(fullRequest),
      () => adapter.getWarehouseExceptionItems(fullRequest),
    ]

    for (const fn of methods) {
      const result = await fn()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.retryable).toBe(true)
      expect(result.displayState).toBe('error')
      expect(result.source).toBe('databricks-api')
    }
  })

  it('handles network failure correctly and asserts retryable=true', async () => {
    vi.stubGlobal('fetch', mockFetchError('Connection failed'))
    const methods = [
      () => adapter.getWarehouseOverview(fullRequest),
      () => adapter.getWarehouseInbound(fullRequest),
      () => adapter.getWarehouseOutbound(fullRequest),
      () => adapter.getWarehouseStaging(fullRequest),
      () => adapter.getWarehouseExceptionItems(fullRequest),
    ]

    for (const fn of methods) {
      const result = await fn()
      expect(result.ok).toBe(false)
      if (result.ok) continue
      expect(result.error.code).toBe('unknown')
      expect(result.error.retryable).toBe(true)
      expect(result.source).toBe('databricks-api')
    }
  })

  it('falls back to mock implementation when warehouseId is missing or falsy', async () => {
    const methods = [
      () => adapter.getWarehouseOverview(emptyRequest),
      () => adapter.getWarehouseInbound(emptyRequest),
      () => adapter.getWarehouseOutbound(emptyRequest),
      () => adapter.getWarehouseStaging(emptyRequest),
      () => adapter.getWarehouseExceptionItems(emptyRequest),
    ]

    for (const fn of methods) {
      const result = await fn()
      expect(result.ok).toBe(true)
      expect(result.source).toBe('mock') // Mock adapter explicitly sets source to 'mock'
    }
  })

  it('appends optional query parameters when provided in request', async () => {
    const filterRequest: Warehouse360AdapterRequest = {
      warehouseId: 'WH-IE10-MAIN',
      plantId: 'IE10',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      limit: 150,
    }

    vi.stubGlobal('fetch', mockFetch(200, [fakeInboundItem]))
    const result = await adapter.getWarehouseInbound(filterRequest)
    expect(result.ok).toBe(true)

    const fetchMock = vi.mocked(global.fetch)
    const [url] = fetchMock.mock.calls[0]
    const urlObj = new URL(String(url))
    expect(urlObj.searchParams.get('warehouse_id')).toBe('WH-IE10-MAIN')
    expect(urlObj.searchParams.get('plant_id')).toBe('IE10')
    expect(urlObj.searchParams.get('date_from')).toBe('2026-05-01')
    expect(urlObj.searchParams.get('date_to')).toBe('2026-05-31')
    expect(urlObj.searchParams.get('limit')).toBe('150')
  })
})

// ---------------------------------------------------------------------------
// Source-truthful null preservation (PR #110)
// ---------------------------------------------------------------------------

describe('Warehouse360LegacyApiAdapter source-truthful null preservation', () => {
  it('inbound mapper preserves null for every nullable string/number field', async () => {
    // Only documentType + materialId are required on the contract.
    const sparseInbound = {
      documentType: 'PO',
      materialId: 'MAT-NULL',
      purchaseOrderId: null,
      stockTransportOrderId: null,
      itemId: null,
      vendorId: null,
      supplyingPlantId: null,
      materialDescription: null,
      batchId: null,
      plantId: null,
      storageLocation: null,
      warehouseNumber: null,
      expectedDate: null,
      receivedDate: null,
      quantity: null,
      unitOfMeasure: null,
      status: null,
      exceptionReason: null,
    }
    vi.stubGlobal('fetch', mockFetch(200, [sparseInbound]))
    const result = await adapter.getWarehouseInbound(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const r = result.data[0]
    expect(r.materialId).toBe('MAT-NULL')
    expect(r.documentType).toBe('PO')
    expect(r.purchaseOrderId).toBeNull()
    expect(r.stockTransportOrderId).toBeNull()
    expect(r.itemId).toBeNull()
    expect(r.vendorId).toBeNull()
    expect(r.supplyingPlantId).toBeNull()
    expect(r.materialDescription).toBeNull()
    expect(r.batchId).toBeNull()
    expect(r.plantId).toBeNull()
    expect(r.storageLocation).toBeNull()
    expect(r.warehouseNumber).toBeNull()
    expect(r.expectedDate).toBeNull()
    expect(r.receivedDate).toBeNull()
    expect(r.quantity).toBeNull()
    expect(r.unitOfMeasure).toBeNull()
    expect(r.status).toBeNull()
    expect(r.exceptionReason).toBeNull()
  })

  it('inbound mapper falls back to documentType="unknown" when source value is unrecognised', async () => {
    vi.stubGlobal('fetch', mockFetch(200, [{ documentType: null, materialId: 'MAT-A' }]))
    const result = await adapter.getWarehouseInbound(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[0].documentType).toBe('unknown')
  })

  it('inbound mapper does NOT collapse null strings to "" or null numbers to 0', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, [
        {
          documentType: 'PO',
          materialId: 'MAT-X',
          batchId: null,
          quantity: null,
          unitOfMeasure: null,
        },
      ]),
    )
    const result = await adapter.getWarehouseInbound(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const r = result.data[0]
    expect(r.batchId).not.toBe('')
    expect(r.unitOfMeasure).not.toBe('')
    expect(r.quantity).not.toBe(0)
    expect(r.batchId).toBeNull()
    expect(r.unitOfMeasure).toBeNull()
    expect(r.quantity).toBeNull()
  })

  it('outbound mapper preserves null for every nullable field', async () => {
    const sparseOutbound = {
      materialId: 'MAT-OUT',
      deliveryId: null,
      deliveryItemId: null,
      customerId: null,
      salesOrderId: null,
      materialDescription: null,
      batchId: null,
      plantId: null,
      storageLocation: null,
      warehouseNumber: null,
      plannedGoodsIssueDate: null,
      actualGoodsIssueDate: null,
      quantity: null,
      unitOfMeasure: null,
      status: null,
      exceptionReason: null,
    }
    vi.stubGlobal('fetch', mockFetch(200, [sparseOutbound]))
    const result = await adapter.getWarehouseOutbound(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const r = result.data[0]
    expect(r.materialId).toBe('MAT-OUT')
    expect(r.deliveryId).toBeNull()
    expect(r.customerId).toBeNull()
    expect(r.batchId).toBeNull()
    expect(r.unitOfMeasure).toBeNull()
    expect(r.quantity).toBeNull()
    expect(r.status).toBeNull()
  })

  it('staging mapper preserves null for stagingStatus and every nullable field', async () => {
    const sparseStaging = {
      materialId: 'MAT-STG',
      processOrderId: null,
      reservationId: null,
      reservationItemId: null,
      materialDescription: null,
      batchId: null,
      plantId: null,
      storageLocation: null,
      warehouseNumber: null,
      requirementDate: null,
      requiredQuantity: null,
      stagedQuantity: null,
      openQuantity: null,
      unitOfMeasure: null,
      stagingStatus: null,
      exceptionReason: null,
    }
    vi.stubGlobal('fetch', mockFetch(200, [sparseStaging]))
    const result = await adapter.getWarehouseStaging(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const r = result.data[0]
    expect(r.materialId).toBe('MAT-STG')
    expect(r.stagingStatus).toBeNull()
    expect(r.requiredQuantity).toBeNull()
    expect(r.stagedQuantity).toBeNull()
    expect(r.openQuantity).toBeNull()
    expect(r.unitOfMeasure).toBeNull()
  })

  it('exceptions mapper falls back severity to null (NOT "low") when source value is missing', async () => {
    const sparseException = {
      materialId: 'MAT-EXC',
      exceptionType: null,
      severity: null,
      batchId: null,
      plantId: null,
      storageLocation: null,
      warehouseNumber: null,
      quantity: null,
      unitOfMeasure: null,
      expiryDate: null,
      daysToExpiry: null,
      documentId: null,
      processOrderId: null,
      deliveryId: null,
      purchaseOrderId: null,
      reason: null,
      recommendedReviewAction: null,
    }
    vi.stubGlobal('fetch', mockFetch(200, [sparseException]))
    const result = await adapter.getWarehouseExceptionItems(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const r = result.data[0]
    expect(r.severity).not.toBe('low')
    expect(r.severity).toBeNull()
    expect(r.exceptionType).toBeNull()
    expect(r.reason).toBeNull()
    expect(r.recommendedReviewAction).toBeNull()
    expect(r.quantity).toBeNull()
    expect(r.daysToExpiry).toBeNull()
  })

  it('exceptions mapper falls back severity to null for unrecognised non-enum values', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(200, [{ materialId: 'MAT-EXC-2', severity: 'whatever-the-source-said' }]),
    )
    const result = await adapter.getWarehouseExceptionItems(fullRequest)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data[0].severity).toBeNull()
  })

  it('exceptions mapper still propagates the four valid severity enum values verbatim', async () => {
    for (const sev of ['critical', 'high', 'medium', 'low'] as const) {
      vi.stubGlobal('fetch', mockFetch(200, [{ materialId: 'MAT-EXC', severity: sev }]))
      const result = await adapter.getWarehouseExceptionItems(fullRequest)
      expect(result.ok).toBe(true)
      if (!result.ok) continue
      expect(result.data[0].severity).toBe(sev)
    }
  })
})
