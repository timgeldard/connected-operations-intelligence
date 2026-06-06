import type {
  BatchReleaseContext,
  BatchReleaseQueueItem,
  BatchReleaseSummary,
  QualityResultsSummary,
  CoAReadiness,
  DeviationSummary,
  ReleaseDecisionHistoryItem,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockReleaseContext,
  mockReleaseQueue,
  mockReleaseSummary,
  mockQualityResults,
  mockCoAReadiness,
  mockDeviations,
  mockDecisionHistory,
} from './quality-release-mock-data.js'

/**
 * Request context for all QualityRelease adapter methods.
 *
 * @remarks
 * Phase 1 uses mock data; `releaseCaseId` and `batchId` are accepted for
 * type-safety and future API wiring at Phase 2.
 */
export interface QualityReleaseAdapterRequest {
  readonly releaseCaseId: string
  readonly batchId?: string
  readonly plantId?: string
}

/**
 * Resolves to an ISO 8601 timestamp representing "now".
 * Extracted so tests can override it without mocking `Date`.
 */
export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

/**
 * Creates a successful {@link AdapterResult} wrapping the given data.
 *
 * @param data - The payload to wrap.
 * @param now - ISO 8601 timestamp for `fetchedAt`. Defaults to current time.
 * @returns A successful AdapterResult.
 */
function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

/**
 * Creates a failed {@link AdapterResult} wrapping an {@link AdapterError}.
 *
 * @param code - The error classification code.
 * @param message - Human-readable error description.
 * @param retryable - Whether a retry is likely to succeed.
 * @returns A failed AdapterResult.
 */
function err<T>(
  code: AdapterError['code'],
  message: string,
  retryable = false
): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

/**
 * Options for constructing a {@link QualityReleaseAdapter}.
 */
export interface QualityReleaseAdapterOptions {
  /**
   * Override the clock used for `fetchedAt` timestamps.
   * Useful in tests to produce deterministic output.
   */
  readonly now?: NowFn
  /** Artificial delay in milliseconds to simulate network latency (dev only). */
  readonly simulatedDelayMs?: number
}

/**
 * Adapter for the Quality Batch Release domain.
 *
 * @remarks
 * Phase 1 implementation returns typed mock data. Phase 2 will replace each
 * method body with a `fetchJson` call to the FastAPI backend, with no changes
 * required to panels, views, or action flows.
 */
export class QualityReleaseAdapter {
  private readonly now: NowFn
  private readonly simulatedDelayMs: number

  constructor(options: QualityReleaseAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
    this.simulatedDelayMs = options.simulatedDelayMs ?? 0
  }

  private async delay(): Promise<void> {
    if (this.simulatedDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.simulatedDelayMs))
    }
  }

  /**
   * Fetches the top-level context for a batch release case.
   *
   * @param _request - Release case request context.
   * @returns The release case context or an error result.
   */
  async getReleaseContext(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<BatchReleaseContext>> {
    await this.delay()
    return ok(mockReleaseContext, this.now)
  }

  /**
   * Fetches the batch release queue for a plant.
   *
   * @param _request - Release case request context.
   * @returns A readonly list of queue items or an error result.
   */
  async getReleaseQueue(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<readonly BatchReleaseQueueItem[]>> {
    await this.delay()
    return ok(mockReleaseQueue, this.now)
  }

  /**
   * Fetches the consolidated release readiness summary for a batch.
   *
   * @param _request - Release case request context.
   * @returns The release summary or an error result.
   */
  async getReleaseSummary(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<BatchReleaseSummary>> {
    await this.delay()
    return ok(mockReleaseSummary, this.now)
  }

  /**
   * Fetches the quality inspection results (MIC, chemical, sensory, physical).
   *
   * @param _request - Release case request context.
   * @returns Quality results summary or an error result.
   */
  async getQualityResults(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<QualityResultsSummary>> {
    await this.delay()
    return ok(mockQualityResults, this.now)
  }

  /**
   * Fetches the Certificate of Analysis readiness for the batch.
   *
   * @param _request - Release case request context.
   * @returns CoA readiness or an error result.
   */
  async getCoAReadiness(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<CoAReadiness>> {
    await this.delay()
    return ok(mockCoAReadiness, this.now)
  }

  /**
   * Fetches active and recent deviations associated with the batch.
   *
   * @param _request - Release case request context.
   * @returns Deviation summary or an error result.
   */
  async getDeviations(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<DeviationSummary>> {
    await this.delay()
    return ok(mockDeviations, this.now)
  }

  /**
   * Fetches the release decision audit trail for the batch.
   *
   * @param _request - Release case request context.
   * @returns A readonly list of decision history items or an error result.
   */
  async getDecisionHistory(
    _request: QualityReleaseAdapterRequest
  ): Promise<AdapterResult<readonly ReleaseDecisionHistoryItem[]>> {
    await this.delay()
    return ok(mockDecisionHistory, this.now)
  }
}

/**
 * Singleton instance of the {@link QualityReleaseAdapter}.
 *
 * @remarks
 * Phase 1: uses mock data. Phase 2: replace with real API calls.
 */
export const qualityReleaseAdapter = new QualityReleaseAdapter()

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
