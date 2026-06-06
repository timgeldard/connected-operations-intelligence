import type { EvidencePanelDisplayState } from '@connectio/data-contracts'

/** Identifies which data source backed an adapter response. */
export type AdapterSource = 'mock' | 'legacy-api' | 'databricks-api' | 'mixed'

/** Structured error returned from a source adapter. */
export interface AdapterError {
  readonly code: 'network' | 'unauthorized' | 'not-found' | 'timeout' | 'invalid-data' | 'unknown'
  readonly message: string
  readonly retryable: boolean
}

/** The result of a source adapter fetch. */
export type AdapterResult<T> =
  | { readonly ok: true; readonly data: T; readonly fetchedAt: string; readonly source?: AdapterSource }
  | { readonly ok: false; readonly error: AdapterError; readonly displayState: EvidencePanelDisplayState; readonly source?: AdapterSource }

/** Data freshness metadata attached to an adapter response. */
export interface SourceFreshness {
  readonly fetchedAt: string
  readonly dataAsOf: string | null
  readonly isStale: boolean
}

/** Confidence level metadata attached to an adapter response. */
export interface SourceConfidence {
  readonly level: number | null
  readonly reason?: string
}

/** A resolved drill-through target URL. */
export interface DrillThroughTarget {
  readonly url: string
  readonly label: string
  readonly external: boolean
}

/** Contract for a data adapter that powers an evidence panel. */
export interface SourceAdapter<TRequest, TResult> {
  readonly adapterId: string
  /** Fetch data for the given request context. */
  fetch(request: TRequest): Promise<AdapterResult<TResult>>
  /** Optional: resolve a drill-through URL from the fetched data. */
  resolveDrillThrough?(data: TResult): DrillThroughTarget | null
}
