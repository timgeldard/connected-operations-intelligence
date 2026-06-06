import type { SPCSignalSummary } from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import { mockSPCSignalSummary } from './spc-signals-mock-data.js'

/**
 * Request context for the SPC signals adapter.
 *
 * @remarks
 * Phase 1 uses mock data. Phase 2 will query the SPC backend
 * using `processOrderId` and `batchId`.
 */
export interface SPCSignalsAdapterRequest {
  readonly processOrderId?: string
  readonly batchId?: string
  readonly releaseCaseId?: string
}

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

/** Options for constructing a {@link SPCSignalsAdapter}. */
export interface SPCSignalsAdapterOptions {
  /** Override the clock used for `fetchedAt` timestamps (useful in tests). */
  readonly now?: NowFn
}

/**
 * Adapter for SPC signal data consumed by the Quality Batch Release workspace.
 *
 * @remarks
 * Phase 1: returns mock data. Phase 2: calls `GET /api/spc/batch/{batchId}/signals`.
 */
export class SPCSignalsAdapter {
  private readonly now: NowFn

  constructor(options: SPCSignalsAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  /**
   * Fetches the SPC alarm summary for a batch / process order.
   *
   * @param _request - Request context containing batch and process order IDs.
   * @returns SPC signal summary or an error result.
   */
  async getSPCSignals(
    _request: SPCSignalsAdapterRequest
  ): Promise<AdapterResult<SPCSignalSummary>> {
    return ok(mockSPCSignalSummary, this.now)
  }
}

/** Singleton {@link SPCSignalsAdapter} instance. */
export const spcSignalsAdapter = new SPCSignalsAdapter()

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
