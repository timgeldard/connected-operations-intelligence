import type {
  ProcessOrderReleaseEvidence,
  OperationsEvidenceAdapterRequest,
} from '@connectio/data-contracts'
export type { ProcessOrderReleaseEvidence, OperationsEvidenceAdapterRequest }
import type { AdapterError, AdapterResult } from '@connectio/source-adapters'
import { mockProcessOrderEvidence } from './operations-evidence-mock-data.js'

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

/** Options for constructing an {@link OperationsEvidenceAdapter}. */
export interface OperationsEvidenceAdapterOptions {
  /** Override the clock used for `fetchedAt` timestamps (useful in tests). */
  readonly now?: NowFn
}

/**
 * Adapter for manufacturing operations evidence consumed by the Quality Batch Release workspace.
 *
 * @remarks
 * Phase 1: returns mock data. Phase 2: calls `GET /api/poh/batch/{batchId}/release-evidence`.
 */
export class OperationsEvidenceAdapter {
  private readonly now: NowFn

  constructor(options: OperationsEvidenceAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  /**
   * Fetches process order conformance evidence for a batch.
   *
   * @param _request - Request context containing batch and process order IDs.
   * @returns Process order release evidence or an error result.
   */
  async getProcessOrderEvidence(
    _request: OperationsEvidenceAdapterRequest
  ): Promise<AdapterResult<ProcessOrderReleaseEvidence>> {
    return ok(mockProcessOrderEvidence, this.now)
  }
}

/** Singleton {@link OperationsEvidenceAdapter} instance. */
export const operationsEvidenceAdapter = new OperationsEvidenceAdapter()

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
