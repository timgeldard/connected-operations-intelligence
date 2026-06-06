import type {
  WarehouseHoldStatus,
  WarehouseEvidenceAdapterRequest,
} from '@connectio/data-contracts'
export type { WarehouseHoldStatus, WarehouseEvidenceAdapterRequest }
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import { mockWarehouseHoldStatus } from './warehouse-evidence-mock-data.js'

/** Resolves to an ISO 8601 timestamp representing "now". */
export type NowFn = () => string

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

/** Options for constructing a {@link WarehouseEvidenceAdapter}. */
export interface WarehouseEvidenceAdapterOptions {
  /** Override the clock used for `fetchedAt` timestamps (useful in tests). */
  readonly now?: NowFn
}

/**
 * Adapter for warehouse stock and hold evidence consumed by the Quality Batch Release workspace.
 *
 * @remarks
 * Phase 1: returns mock data. Phase 2: calls `GET /api/warehouse360/batch/{batchId}/hold-status`.
 */
export class WarehouseEvidenceAdapter {
  private readonly now: NowFn

  constructor(options: WarehouseEvidenceAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  /**
   * Fetches the warehouse hold and stock status for a batch.
   *
   * @param _request - Request context containing batch and plant IDs.
   * @returns Warehouse hold status or an error result.
   */
  async getWarehouseHoldStatus(
    _request: WarehouseEvidenceAdapterRequest
  ): Promise<AdapterResult<WarehouseHoldStatus>> {
    return ok(mockWarehouseHoldStatus, this.now)
  }
}

/** Singleton {@link WarehouseEvidenceAdapter} instance. */
export const warehouseEvidenceAdapter = new WarehouseEvidenceAdapter()

/**
 * Converts an unknown thrown value to a failed {@link AdapterResult}.
 *
 * @param thrown - The caught value from a try/catch block.
 * @returns A typed failed AdapterResult.
 */
export function toAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
