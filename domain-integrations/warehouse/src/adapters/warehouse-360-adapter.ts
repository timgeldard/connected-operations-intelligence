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
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockWarehouse360Context,
  mockWarehouse360Summary,
  mockStockOverview,
  mockOpenHolds,
  mockGoodsMovements,
  mockReplenishmentNeeds,
  mockLocationCapacities,
  mockNearExpiryBatches,
  mockWarehouseReconciliationExceptions,
  mockWarehouse360Overview,
  mockWarehouse360InboundItems,
  mockWarehouse360OutboundItems,
  mockWarehouse360StagingItems,
  mockWarehouse360ExceptionItems,
} from './warehouse-360-mock-data.js'

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

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(
  code: AdapterError['code'],
  message: string,
  retryable = false
): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface Warehouse360AdapterOptions {
  readonly now?: NowFn
}

export class Warehouse360Adapter {
  private readonly now: NowFn

  constructor(options: Warehouse360AdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getWarehouse360Context(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360OverviewContext>> {
    return ok(mockWarehouse360Context, this.now)
  }

  async getWarehouse360Summary(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360Summary>> {
    return ok(mockWarehouse360Summary, this.now)
  }

  async getStockOverview(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<StockOverview>> {
    return ok(mockStockOverview, this.now)
  }

  async getOpenHolds(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<OpenHoldItem[]>> {
    return ok(mockOpenHolds, this.now)
  }

  async getGoodsMovements(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<GoodsMovementEvent[]>> {
    return ok(mockGoodsMovements, this.now)
  }

  async getReplenishmentNeeds(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<ReplenishmentNeed[]>> {
    return ok(mockReplenishmentNeeds, this.now)
  }

  async getLocationCapacities(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<LocationCapacity[]>> {
    return ok(mockLocationCapacities, this.now)
  }

  async getNearExpiryStock(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<NearExpiryBatch[]>> {
    return ok(mockNearExpiryBatches, this.now)
  }

  async getWarehouseExceptions(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<WarehouseReconciliationException[]>> {
    return ok(mockWarehouseReconciliationExceptions, this.now)
  }

  async getWarehouseOverview(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360Overview>> {
    return ok(mockWarehouse360Overview, this.now)
  }

  async getWarehouseInbound(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360InboundItem[]>> {
    return ok(mockWarehouse360InboundItems, this.now)
  }

  async getWarehouseOutbound(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360OutboundItem[]>> {
    return ok(mockWarehouse360OutboundItems, this.now)
  }

  async getWarehouseStaging(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360StagingItem[]>> {
    return ok(mockWarehouse360StagingItems, this.now)
  }

  async getWarehouseExceptionItems(
    _request: Warehouse360AdapterRequest
  ): Promise<AdapterResult<Warehouse360ExceptionItem[]>> {
    return ok(mockWarehouse360ExceptionItems, this.now)
  }
}

export const warehouse360Adapter = new Warehouse360Adapter()

export function toWarehouse360AdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
