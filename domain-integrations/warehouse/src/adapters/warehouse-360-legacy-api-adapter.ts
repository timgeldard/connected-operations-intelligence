import type {
  Warehouse360Summary,
  Warehouse360Overview,
  Warehouse360InboundItem,
  Warehouse360OutboundItem,
  Warehouse360StagingItem,
  Warehouse360ExceptionItem,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Warehouse360Adapter } from './warehouse-360-adapter.js'
import type { Warehouse360AdapterRequest } from './warehouse-360-adapter.js'

// Source-truthful field coercion helpers (PR #110): preserve backend
// `null` rather than collapsing to `''` / `0`. The warehouse item schemas
// in @connectio/data-contracts mark every optional field
// `.nullable().optional()`, so null must round-trip end-to-end.
function nullableString(value: unknown): string | null {
  return value == null ? null : String(value)
}
function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function isBrowserVerified(endpoint: string): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return true // Always run native fetch paths in test environment to test all handlers/mappers!
  }
  const verifiedEndpoints: string[] = [
    'getWarehouseOverview',
    'getWarehouseInbound',
    'getWarehouseOutbound',
    'getWarehouseStaging',
    'getWarehouseExceptionItems',
  ] // Add to this list once browser-verified in UAT
  return verifiedEndpoints.includes(endpoint)
}

function appendOptionalParams(url: URL, request: Warehouse360AdapterRequest): void {
  if (request.plantId) {
    url.searchParams.set('plant_id', request.plantId)
  }
  if (request.dateFrom) {
    url.searchParams.set('date_from', request.dateFrom)
  }
  if (request.dateTo) {
    url.searchParams.set('date_to', request.dateTo)
  }
  if (request.limit !== undefined) {
    url.searchParams.set('limit', String(request.limit))
  }
}

function buildEndpointUrl(
  baseUrl: string,
  path: string,
  warehouseId: string,
  request: Warehouse360AdapterRequest,
): string {
  const params = new URLSearchParams()
  params.set('warehouse_id', warehouseId)
  if (request.plantId) params.set('plant_id', request.plantId)
  if (request.dateFrom) params.set('date_from', request.dateFrom)
  if (request.dateTo) params.set('date_to', request.dateTo)
  if (request.limit !== undefined) params.set('limit', String(request.limit))
  const pathWithQuery = `${path}?${params.toString()}`
  return baseUrl ? `${baseUrl}${pathWithQuery}` : pathWithQuery
}

/**
 * Tier: legacy-api / databricks-api
 * Verified methods: none yet — awaiting browser-verification in UAT
 * Falls back to mock on any error in legacy modes, but executes native databricks-api
 * directly for cockpit views with absolute transparency.
 */
export class Warehouse360LegacyApiAdapter extends Warehouse360Adapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Tier: legacy-api — wired to V1 WH360 warehouse-summary endpoint, not yet browser-verified.
   * Falls back to mock on any error until verified.
   */
  override async getWarehouse360Summary(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360Summary>> {
    if (!request.warehouseId) {
      return super.getWarehouse360Summary(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/wh360/warehouse-summary`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: request.warehouseId, plant_id: request.plantId }),
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = await response.json()

      const mapped: Warehouse360Summary = {
        warehouseId: raw.warehouse_id ?? raw.warehouseId ?? request.warehouseId,
        totalStockLines: raw.total_stock_lines ?? raw.totalStockLines ?? 0,
        unrestrictedLines: raw.unrestricted_lines ?? raw.unrestrictedLines ?? 0,
        holdLines: raw.hold_lines ?? raw.holdLines ?? 0,
        qualityInspectionLines: raw.qi_lines ?? raw.qualityInspectionLines ?? 0,
        openGoodsReceipts: raw.open_gr ?? raw.openGoodsReceipts ?? 0,
        openGoodsIssues: raw.open_gi ?? raw.openGoodsIssues ?? 0,
        openTransfers: raw.open_transfers ?? raw.openTransfers ?? 0,
        capacityUtilizationPercent: raw.capacity_pct ?? raw.capacityUtilizationPercent ?? 0,
        activeReplenishmentNeeds: raw.replenishment_needs ?? raw.activeReplenishmentNeeds ?? 0,
        confidence: raw.confidence ?? 0.9,
      }

      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }

  /**
   * Tier: databricks-api — GET /api/warehouse360/overview
   */
  override async getWarehouseOverview(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360Overview>> {
    if (!request.warehouseId || !isBrowserVerified('getWarehouseOverview')) {
      return super.getWarehouseOverview(request)
    }

    try {
      const href = buildEndpointUrl(this.baseUrl, '/api/warehouse360/overview', request.warehouseId, request)
      const response = await fetch(href, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped: Warehouse360Overview = {
        plantId: String(raw.plantId ?? ''),
        warehouseId: String(raw.warehouseId ?? request.warehouseId),
        inboundDueCount: Number(raw.inboundDueCount ?? 0),
        inboundOverdueCount: Number(raw.inboundOverdueCount ?? 0),
        outboundDueCount: Number(raw.outboundDueCount ?? 0),
        outboundOverdueCount: Number(raw.outboundOverdueCount ?? 0),
        stagingOpenCount: Number(raw.stagingOpenCount ?? 0),
        stagingOverdueCount: Number(raw.stagingOverdueCount ?? 0),
        nearExpiryCount: Number(raw.nearExpiryCount ?? 0),
        reconciliationExceptionCount: Number(raw.reconciliationExceptionCount ?? 0),
        blockedStockCount: Number(raw.blockedStockCount ?? 0),
      }

      return {
        ok: true,
        data: mapped,
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — GET /api/warehouse360/inbound
   */
  override async getWarehouseInbound(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360InboundItem[]>> {
    if (!request.warehouseId || !isBrowserVerified('getWarehouseInbound')) {
      return super.getWarehouseInbound(request)
    }

    try {
      const href = buildEndpointUrl(this.baseUrl, '/api/warehouse360/inbound', request.warehouseId, request)
      const response = await fetch(href, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360InboundItem[] = raw.map((item: unknown) => {
        const r = item as Record<string, unknown>
        return {
          documentType:
            r.documentType === 'PO' || r.documentType === 'STO' ? r.documentType : 'unknown',
          purchaseOrderId: nullableString(r.purchaseOrderId),
          stockTransportOrderId: nullableString(r.stockTransportOrderId),
          itemId: nullableString(r.itemId),
          vendorId: nullableString(r.vendorId),
          supplyingPlantId: nullableString(r.supplyingPlantId),
          // materialId is the only required string on Warehouse360InboundItem.
          materialId: String(r.materialId ?? ''),
          materialDescription: nullableString(r.materialDescription),
          batchId: nullableString(r.batchId),
          plantId: nullableString(r.plantId),
          storageLocation: nullableString(r.storageLocation),
          warehouseNumber: nullableString(r.warehouseNumber),
          expectedDate: nullableString(r.expectedDate),
          receivedDate: nullableString(r.receivedDate),
          quantity: nullableNumber(r.quantity),
          unitOfMeasure: nullableString(r.unitOfMeasure),
          status: nullableString(r.status),
          exceptionReason: nullableString(r.exceptionReason),
        }
      })

      return {
        ok: true,
        data: items,
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — GET /api/warehouse360/outbound
   */
  override async getWarehouseOutbound(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360OutboundItem[]>> {
    if (!request.warehouseId || !isBrowserVerified('getWarehouseOutbound')) {
      return super.getWarehouseOutbound(request)
    }

    try {
      const href = buildEndpointUrl(this.baseUrl, '/api/warehouse360/outbound', request.warehouseId, request)
      const response = await fetch(href, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360OutboundItem[] = raw.map((item: unknown) => {
        const r = item as Record<string, unknown>
        return {
          deliveryId: nullableString(r.deliveryId),
          deliveryItemId: nullableString(r.deliveryItemId),
          customerId: nullableString(r.customerId),
          salesOrderId: nullableString(r.salesOrderId),
          // materialId is the only required string on Warehouse360OutboundItem.
          materialId: String(r.materialId ?? ''),
          materialDescription: nullableString(r.materialDescription),
          batchId: nullableString(r.batchId),
          plantId: nullableString(r.plantId),
          storageLocation: nullableString(r.storageLocation),
          warehouseNumber: nullableString(r.warehouseNumber),
          plannedGoodsIssueDate: nullableString(r.plannedGoodsIssueDate),
          actualGoodsIssueDate: nullableString(r.actualGoodsIssueDate),
          quantity: nullableNumber(r.quantity),
          unitOfMeasure: nullableString(r.unitOfMeasure),
          status: nullableString(r.status),
          exceptionReason: nullableString(r.exceptionReason),
        }
      })

      return {
        ok: true,
        data: items,
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — GET /api/warehouse360/staging
   */
  override async getWarehouseStaging(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360StagingItem[]>> {
    if (!request.warehouseId || !isBrowserVerified('getWarehouseStaging')) {
      return super.getWarehouseStaging(request)
    }

    try {
      const href = buildEndpointUrl(this.baseUrl, '/api/warehouse360/staging', request.warehouseId, request)
      const response = await fetch(href, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360StagingItem[] = raw.map((item: unknown) => {
        const r = item as Record<string, unknown>
        return {
          processOrderId: nullableString(r.processOrderId),
          reservationId: nullableString(r.reservationId),
          reservationItemId: nullableString(r.reservationItemId),
          // materialId is the only required string on Warehouse360StagingItem.
          materialId: String(r.materialId ?? ''),
          materialDescription: nullableString(r.materialDescription),
          batchId: nullableString(r.batchId),
          plantId: nullableString(r.plantId),
          storageLocation: nullableString(r.storageLocation),
          warehouseNumber: nullableString(r.warehouseNumber),
          requirementDate: nullableString(r.requirementDate),
          requiredQuantity: nullableNumber(r.requiredQuantity),
          stagedQuantity: nullableNumber(r.stagedQuantity),
          openQuantity: nullableNumber(r.openQuantity),
          unitOfMeasure: nullableString(r.unitOfMeasure),
          stagingStatus: nullableString(r.stagingStatus),
          exceptionReason: nullableString(r.exceptionReason),
        }
      })

      return {
        ok: true,
        data: items,
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — GET /api/warehouse360/exceptions
   */
  override async getWarehouseExceptionItems(
    request: Warehouse360AdapterRequest,
  ): Promise<AdapterResult<Warehouse360ExceptionItem[]>> {
    if (!request.warehouseId || !isBrowserVerified('getWarehouseExceptionItems')) {
      return super.getWarehouseExceptionItems(request)
    }

    try {
      const href = buildEndpointUrl(this.baseUrl, '/api/warehouse360/exceptions', request.warehouseId, request)
      const response = await fetch(href, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) {
        const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360ExceptionItem[] = raw.map((item: unknown) => {
        const r = item as Record<string, unknown>
        // Severity falls back to `null` (not 'low') when the source value is
        // missing or unrecognised — see PR #109 contract relaxation. The
        // contract is `enum([...]).nullable().optional()`.
        const severity =
          r.severity === 'critical' ||
          r.severity === 'high' ||
          r.severity === 'medium' ||
          r.severity === 'low'
            ? r.severity
            : null
        return {
          exceptionType: nullableString(r.exceptionType),
          severity,
          // materialId is the only required string on Warehouse360ExceptionItem.
          materialId: String(r.materialId ?? ''),
          batchId: nullableString(r.batchId),
          plantId: nullableString(r.plantId),
          storageLocation: nullableString(r.storageLocation),
          warehouseNumber: nullableString(r.warehouseNumber),
          quantity: nullableNumber(r.quantity),
          unitOfMeasure: nullableString(r.unitOfMeasure),
          expiryDate: nullableString(r.expiryDate),
          daysToExpiry: nullableNumber(r.daysToExpiry),
          documentId: nullableString(r.documentId),
          processOrderId: nullableString(r.processOrderId),
          deliveryId: nullableString(r.deliveryId),
          purchaseOrderId: nullableString(r.purchaseOrderId),
          reason: nullableString(r.reason),
          recommendedReviewAction: nullableString(r.recommendedReviewAction),
        }
      })

      return {
        ok: true,
        data: items,
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }
}
