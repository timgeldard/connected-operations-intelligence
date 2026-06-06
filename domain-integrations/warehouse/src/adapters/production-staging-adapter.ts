import type {
  ProductionStagingContext,
  StagingReadinessSummary,
  StagingOrderSummary,
  StagingPickTask,
  StagingZoneCapacity,
  StagingShortfall,
  StagingMoveRequest,
  StagingPickingWave,
  StagingAlert,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockProductionStagingContext,
  mockStagingReadiness,
  mockStagingOrders,
  mockPickTasks,
  mockZoneCapacity,
  mockShortfalls,
  mockMoveRequests,
  mockPickingWaves,
  mockStagingAlerts,
} from './production-staging-mock-data.js'

export interface ProductionStagingAdapterRequest {
  readonly plantId?: string
  readonly warehouseId?: string
  readonly planDate?: string
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface ProductionStagingAdapterOptions {
  readonly now?: NowFn
}

export class ProductionStagingAdapter {
  private readonly now: NowFn

  constructor(options: ProductionStagingAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getProductionStagingContext(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<ProductionStagingContext>> {
    return ok(mockProductionStagingContext, this.now)
  }

  async getStagingReadinessSummary(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingReadinessSummary>> {
    return ok(mockStagingReadiness, this.now)
  }

  async getStagingOrderSummaries(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingOrderSummary[]>> {
    return ok(mockStagingOrders, this.now)
  }

  async getStagingPickTasks(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingPickTask[]>> {
    return ok(mockPickTasks, this.now)
  }

  async getStagingZoneCapacity(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingZoneCapacity[]>> {
    return ok(mockZoneCapacity, this.now)
  }

  async getStagingShortfalls(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingShortfall[]>> {
    return ok(mockShortfalls, this.now)
  }

  async getStagingMoveRequests(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingMoveRequest[]>> {
    return ok(mockMoveRequests, this.now)
  }

  async getStagingPickingWaves(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingPickingWave[]>> {
    return ok(mockPickingWaves, this.now)
  }

  async getStagingAlerts(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingAlert[]>> {
    return ok(mockStagingAlerts, this.now)
  }
}

export const productionStagingAdapter = new ProductionStagingAdapter()

export function toProductionStagingAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
