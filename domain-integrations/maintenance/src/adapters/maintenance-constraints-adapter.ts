import type { MaintenanceConstraint } from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import { mockMaintenanceConstraints } from './maintenance-constraints-mock-data.js'

export interface MaintenanceConstraintsAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly lineIds?: readonly string[]
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now() }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error' }
}

export interface MaintenanceConstraintsAdapterOptions {
  readonly now?: NowFn
}

export class MaintenanceConstraintsAdapter {
  private readonly now: NowFn

  constructor(options: MaintenanceConstraintsAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getMaintenanceConstraintsForPlan(
    _request: MaintenanceConstraintsAdapterRequest
  ): Promise<AdapterResult<MaintenanceConstraint[]>> {
    return ok(mockMaintenanceConstraints, this.now)
  }
}

export const maintenanceConstraintsAdapter = new MaintenanceConstraintsAdapter()

export function toMaintenanceAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
