import type {
  Warehouse360OverviewContext,
  Warehouse360Summary,
  StockOverview,
  OpenHoldItem,
  GoodsMovementEvent,
  ReplenishmentNeed,
  LocationCapacity,
  NearExpiryBatch,
  WarehouseReconciliationException,
  Warehouse360Overview,
  Warehouse360InboundItem,
  Warehouse360OutboundItem,
  Warehouse360StagingItem,
  Warehouse360ExceptionItem,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterSource } from '@connectio/source-adapters'

export interface Warehouse360AdapterRequest {
  readonly warehouseId?: string
  readonly plantId?: string
  readonly storageLocationId?: string
  readonly dateFrom?: string
  readonly dateTo?: string
  readonly limit?: number
}

type NowFn = () => string
const defaultNow: NowFn = () => new Date().toISOString()

function nullableString(value: unknown): string | null {
  return value == null ? null : String(value)
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
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

export interface Warehouse360AdapterOptions {
  readonly baseUrl?: string
  readonly now?: NowFn
}

export class Warehouse360Adapter {
  private readonly baseUrl: string
  private readonly now: NowFn

  constructor(options: Warehouse360AdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? (import.meta.env?.VITE_WH360_API_BASE_URL as string) ?? '').replace(/\/$/, '')
    this.now = options.now ?? defaultNow
  }

  async getWarehouse360Context(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360OverviewContext>> {
    return {
      ok: true,
      data: {
        warehouseId: request.warehouseId ?? '',
        plantId: request.plantId ?? '',
        lastUpdatedAt: this.now(),
        warehouseName: 'Kerry Listowel — Main Warehouse',
        totalStockLines: 0,
        holdPercent: 0,
        openTransfers: 0,
        capacityUtilizationPercent: 0,
      },
      fetchedAt: this.now(),
      source: 'databricks-api',
    }
  }

  async getWarehouse360Summary(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360Summary>> {
    if (!request.warehouseId) {
      return {
        ok: false,
        error: { code: 'not-found', message: 'Warehouse ID is required', retryable: false },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
    
    const overviewResult = await this.getWarehouseOverview(request)
    if (!overviewResult.ok) {
      return {
        ok: false,
        error: overviewResult.error,
        displayState: overviewResult.displayState,
        source: 'databricks-api',
      }
    }

    const o = overviewResult.data as any
    const summary: Warehouse360Summary = {
      warehouseId: request.warehouseId,
      totalStockLines: o.blockedStockCount,
      unrestrictedLines: 0,
      holdLines: o.blockedStockCount,
      qualityInspectionLines: 0,
      openGoodsReceipts: o.inboundDueCount,
      openGoodsIssues: o.outboundDueCount,
      openTransfers: o.stagingOpenCount,
      capacityUtilizationPercent: o.binUtilPct ?? 0,
      activeReplenishmentNeeds: o.stagingOverdueCount,
      confidence: 0.95,
    }

    return {
      ok: true,
      data: summary,
      fetchedAt: this.now(),
      source: 'databricks-api',
    }
  }

  async getStockOverview(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<StockOverview>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/stock-zones', warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<StockOverview>(res, 'databricks-api')
      }
      const rawList = await res.json()
      if (!Array.isArray(rawList)) {
        throw new Error('Response was not an array')
      }

      const zoneMap = new Map<string, {
        occupied: number;
        blocked: number;
        total: number;
      }>();
      let totalStorageLocations = 0;
      let occupiedLocations = 0;
      let blockedLocations = 0;

      for (const item of rawList) {
        const binRecord = nullableNumber(item.binRecordCount) ?? 0;
        const occupied = nullableNumber(item.occupiedBinCount) ?? 0;
        const blocked = nullableNumber(item.blockedBinCount) ?? 0;

        totalStorageLocations += binRecord;
        occupiedLocations += occupied;
        blockedLocations += blocked;

        const zoneId = String(item.storageType ?? 'unknown');
        if (!zoneMap.has(zoneId)) {
          zoneMap.set(zoneId, { occupied: 0, blocked: 0, total: 0 });
        }
        const zoneData = zoneMap.get(zoneId)!;
        zoneData.occupied += occupied;
        zoneData.blocked += blocked;
        zoneData.total += binRecord;
      }

      const zones = Array.from(zoneMap.entries()).map(([zoneId, data]) => {
        const capacityPercent = data.total > 0 ? (data.occupied / data.total) * 100 : 0;
        const holdPercent = data.total > 0 ? (data.blocked / data.total) * 100 : 0;
        return {
          zoneId,
          zoneName: zoneId,
          zoneType: mapStorageTypeToZoneType(zoneId),
          stockLines: data.occupied,
          capacityPercent,
          holdPercent,
        };
      });

      return {
        ok: true,
        data: {
          warehouseId,
          totalStorageLocations,
          occupiedLocations,
          blockedLocations,
          zones,
        },
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<StockOverview>(e, 'databricks-api')
    }
  }

  async getOpenHolds(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<OpenHoldItem[]>> {
    try {
      const params = new URLSearchParams()
      if (request.warehouseId) params.set('warehouse_id', request.warehouseId)
      if (request.plantId) params.set('plant_id', request.plantId)
      if (request.limit !== undefined) params.set('limit', String(request.limit))
      const path = `/api/warehouse360/open-holds?${params.toString()}`
      const url = this.baseUrl ? `${this.baseUrl}${path}` : path
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<OpenHoldItem[]>(res, 'databricks-api')
      }
      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }
      const holds: OpenHoldItem[] = raw.map((r: any) => ({
        holdId: `${r.warehouseNumber ?? ''}-${r.quantNumber ?? ''}`,
        batchId: r.batchId ?? undefined,
        materialId: String(r.materialId ?? ''),
        // materialDescription is a documented data gap (no material join in first wave).
        materialDescription: undefined,
        storageLocationId: [r.storageType, r.storageBin].filter(Boolean).join('/') || '',
        holdReason: r.holdType === 'quality' ? 'quality' : r.holdType === 'blocked' ? 'blocked' : 'restricted',
        holdQuantity: Number(r.quantity ?? 0),
        uom: r.uom ?? undefined,
        // Goods-receipt date is the age basis — NOT a hold-placement timestamp.
        raisedAt: r.goodsReceiptDate ?? undefined,
        // Hold provenance is a documented data gap (no QM hold log replicated).
        raisedBy: undefined,
        ageHours: Math.max(0, Number(r.ageHours ?? 0)),
        linkedWorkspaceId: undefined,
      }))
      return { ok: true, data: holds, fetchedAt: this.now(), source: 'databricks-api' }
    } catch (e) {
      return this.handleCatchError<OpenHoldItem[]>(e, 'databricks-api')
    }
  }

  async getGoodsMovements(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<GoodsMovementEvent[]>> {
    return {
      ok: true,
      data: [],
      fetchedAt: this.now(),
      source: 'databricks-api',
    }
  }

  async getReplenishmentNeeds(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<ReplenishmentNeed[]>> {
    if (!request.warehouseId) {
      return {
        ok: true,
        data: [],
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/shortfalls', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<ReplenishmentNeed[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const needs: ReplenishmentNeed[] = raw.map((r: any) => {
        let urgency: 'critical' | 'high' | 'medium' | 'low' = 'low'
        if (r.oldestTrDate) {
          const ageMs = new Date(this.now()).getTime() - new Date(r.oldestTrDate).getTime()
          const ageHours = ageMs / (1000 * 60 * 60)
          if (ageHours > 48) urgency = 'critical'
          else if (ageHours > 24) urgency = 'high'
          else if (ageHours > 12) urgency = 'medium'
        }

        return {
          needId: `${r.plantId || 'IE10'}-${r.materialId}`,
          materialId: String(r.materialId ?? ''),
          materialDescription: String(r.materialId ?? ''),
          storageLocationId: null,
          currentStockQuantity: null,
          reorderPoint: nullableNumber(r.shortfallQty) ?? 0,
          targetQuantity: nullableNumber(r.shortfallQty) ?? 0,
          uom: null,
          urgency,
          openPurchaseOrderId: undefined,
          expectedDelivery: undefined,
        }
      })

      return {
        ok: true,
        data: needs,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<ReplenishmentNeed[]>(e, 'databricks-api')
    }
  }

  async getLocationCapacities(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<LocationCapacity[]>> {
    return {
      ok: true,
      data: [],
      fetchedAt: this.now(),
      source: 'databricks-api',
    }
  }

  async getNearExpiryStock(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<NearExpiryBatch[]>> {
    if (!request.warehouseId) {
      return {
        ok: true,
        data: [],
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/stock-exceptions', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<NearExpiryBatch[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: NearExpiryBatch[] = raw.map((r: any) => {
        const urgency =
          r.exceptionType === 'expired' ||
          r.exceptionType === 'critical' ||
          r.exceptionType === 'warning' ||
          r.exceptionType === 'caution'
            ? r.exceptionType
            : 'caution'
        return {
          batchId: String(r.batchId ?? ''),
          materialId: String(r.materialId ?? ''),
          materialDescription: String(r.materialId ?? ''),
          storageLocationId: null,
          expiryDate: null,
          daysUntilExpiry: nullableNumber(r.minimumDaysToExpiry) ?? 0,
          quantity: nullableNumber(r.qty) ?? 0,
          uom: null,
          urgency,
          holdStatus: null,
        }
      })

      return {
        ok: true,
        data: items,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<NearExpiryBatch[]>(e, 'databricks-api')
    }
  }

  async getWarehouseExceptions(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<WarehouseReconciliationException[]>> {
    return {
      ok: true,
      data: [],
      fetchedAt: this.now(),
      source: 'databricks-api',
    }
  }

  async getWarehouseOverview(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360Overview>> {
    if (!request.warehouseId) {
      return {
        ok: false,
        error: { code: 'not-found', message: 'Warehouse ID is required', retryable: false },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/overview', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<Warehouse360Overview>(res, 'databricks-api')
      }

      const raw = await res.json()
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
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<Warehouse360Overview>(e, 'databricks-api')
    }
  }

  async getWarehouseInbound(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360InboundItem[]>> {
    if (!request.warehouseId) {
      return {
        ok: true,
        data: [],
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/inbound', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<Warehouse360InboundItem[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360InboundItem[] = raw.map((r: any) => ({
        documentType: r.documentType === 'PO' || r.documentType === 'STO' ? r.documentType : 'unknown',
        purchaseOrderId: nullableString(r.purchaseOrderId),
        stockTransportOrderId: nullableString(r.stockTransportOrderId),
        itemId: nullableString(r.itemId),
        vendorId: nullableString(r.vendorId),
        supplyingPlantId: nullableString(r.supplyingPlantId),
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
      }))

      return {
        ok: true,
        data: items,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<Warehouse360InboundItem[]>(e, 'databricks-api')
    }
  }

  async getWarehouseOutbound(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360OutboundItem[]>> {
    if (!request.warehouseId) {
      return {
        ok: true,
        data: [],
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/outbound', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<Warehouse360OutboundItem[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360OutboundItem[] = raw.map((r: any) => ({
        deliveryId: nullableString(r.deliveryId),
        deliveryItemId: nullableString(r.deliveryItemId),
        customerId: nullableString(r.customerId),
        salesOrderId: nullableString(r.salesOrderId),
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
      }))

      return {
        ok: true,
        data: items,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<Warehouse360OutboundItem[]>(e, 'databricks-api')
    }
  }

  async getWarehouseStaging(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360StagingItem[]>> {
    if (!request.warehouseId) {
      return {
        ok: true,
        data: [],
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/staging', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<Warehouse360StagingItem[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360StagingItem[] = raw.map((r: any) => ({
        processOrderId: nullableString(r.processOrderId),
        reservationId: nullableString(r.reservationId),
        reservationItemId: nullableString(r.reservationItemId),
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
      }))

      return {
        ok: true,
        data: items,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<Warehouse360StagingItem[]>(e, 'databricks-api')
    }
  }

  async getWarehouseExceptionItems(
    request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360ExceptionItem[]>> {
    if (!request.warehouseId) {
      return {
        ok: true,
        data: [],
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    }

    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/exceptions', request.warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<Warehouse360ExceptionItem[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const items: Warehouse360ExceptionItem[] = raw.map((r: any) => {
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
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<Warehouse360ExceptionItem[]>(e, 'databricks-api')
    }
  }

  private handleHttpError<T>(res: Response, source: AdapterSource): AdapterResult<T> {
    const code =
      res.status === 401
        ? ('unauthorized' as const)
        : res.status === 404
          ? ('not-found' as const)
          : ('network' as const)
    return {
      ok: false,
      error: {
        code,
        message: `HTTP error ${res.status}`,
        retryable: res.status >= 500,
      },
      displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
      source,
    }
  }

  private handleCatchError<T>(e: unknown, source: AdapterSource): AdapterResult<T> {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: { code: 'unknown', message, retryable: true },
      displayState: 'error',
      source,
    }
  }
}

function mapStorageTypeToZoneType(storageType: string): 'ambient' | 'chilled' | 'frozen' | 'hazardous' | 'bulk' | 'staging' {
  const low = storageType.toLowerCase();
  if (low.includes('cold') || low.includes('chil') || low.includes('ref')) return 'chilled';
  if (low.includes('froz') || low.includes('freez')) return 'frozen';
  if (low.includes('haz') || low.includes('chem')) return 'hazardous';
  if (low.includes('bulk') || low.includes('rack')) return 'bulk';
  if (low.includes('stg') || low.includes('stage') || low.includes('staging')) return 'staging';
  return 'ambient';
}

export const warehouse360Adapter = new Warehouse360Adapter()

export function toWarehouse360AdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return {
    ok: false,
    error: { code: 'unknown', message, retryable: true },
    displayState: 'error',
    source: 'databricks-api',
  }
}
