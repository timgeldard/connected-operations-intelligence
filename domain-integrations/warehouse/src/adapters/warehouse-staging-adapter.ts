import type { WarehouseStagingStatus, MaterialShortage } from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockWarehouseStagingStatus,
  mockMaterialShortagesForPlan,
} from './warehouse-staging-mock-data.js'

export interface WarehouseStagingAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly processOrderIds?: readonly string[]
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface WarehouseStagingAdapterOptions {
  readonly now?: NowFn
}

export class WarehouseStagingAdapter {
  private readonly now: NowFn

  constructor(options: WarehouseStagingAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getWarehouseStagingStatus(
    _request: WarehouseStagingAdapterRequest,
  ): Promise<AdapterResult<WarehouseStagingStatus[]>> {
    return ok(mockWarehouseStagingStatus, this.now)
  }

  async getMaterialShortagesForPlan(
    _request: WarehouseStagingAdapterRequest,
  ): Promise<AdapterResult<MaterialShortage[]>> {
    return ok(mockMaterialShortagesForPlan, this.now)
  }
}

export const warehouseStagingAdapter = new WarehouseStagingAdapter()

export function toStagingAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
