import type {
  QualityBlocker,
  ReleaseHoldImpact,
  QualityBlockersAdapterRequest,
} from '@connectio/data-contracts'
export type { QualityBlocker, ReleaseHoldImpact, QualityBlockersAdapterRequest }
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import { mockQualityBlockers, mockReleaseHoldImpacts } from './quality-blockers-mock-data.js'

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface QualityBlockersAdapterOptions {
  readonly now?: NowFn
}

export class QualityBlockersAdapter {
  private readonly now: NowFn

  constructor(options: QualityBlockersAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getQualityBlockersForPlan(
    _request: QualityBlockersAdapterRequest
  ): Promise<AdapterResult<QualityBlocker[]>> {
    return ok(mockQualityBlockers, this.now)
  }

  async getReleaseHoldImpacts(
    _request: QualityBlockersAdapterRequest
  ): Promise<AdapterResult<ReleaseHoldImpact[]>> {
    return ok(mockReleaseHoldImpacts, this.now)
  }
}

export const qualityBlockersAdapter = new QualityBlockersAdapter()

export function toQualityBlockersAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
