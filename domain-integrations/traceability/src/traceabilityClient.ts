import { createApiClient } from '@connectio/data-contracts'
import type { ApiClientOptions } from '@connectio/data-contracts'
import type { TraceExposureSummary } from '@connectio/data-contracts'

/**
 * Batch lineage node returned by the traceability backend.
 *
 * @remarks
 * `parentBatches` and `childBatches` are the immediate predecessors and
 * successors of `batchId` in the production graph. `depth` is the maximum
 * number of hops to the root/leaf in either direction.
 */
export interface BatchLineage {
  /** The batch at the centre of the lineage query. */
  readonly batchId: string
  /** Material code for the central batch. */
  readonly materialId: string
  /** Immediate predecessor batches (raw materials / semi-finished inputs). */
  readonly parentBatches: readonly string[]
  /** Immediate successor batches (finished goods / consuming orders). */
  readonly childBatches: readonly string[]
  /** Maximum hop-depth reachable in the full lineage graph. */
  readonly depth: number
}

/**
 * Creates a typed API client scoped to the traceability backend.
 *
 * @param options - Optional base URL, credentials, and default headers.
 *   Pass `{ baseUrl: '/api/traceability' }` when the backend is mounted at a
 *   sub-path. Defaults to same-origin with cookie credentials.
 * @returns An object with typed methods for each traceability endpoint.
 */
export function createTraceabilityClient(options: ApiClientOptions = {}) {
  const client = createApiClient(options)

  return {
    /**
     * Fetches the exposure summary for a given batch.
     *
     * @param batchId - SAP batch number to query.
     * @returns `TraceExposureSummary` for the batch.
     */
    getExposureSummary(batchId: string): Promise<TraceExposureSummary> {
      return client.get<TraceExposureSummary>('/exposure-summary', {
        query: { batchId },
      })
    },

    /**
     * Fetches the immediate lineage graph for a given batch.
     *
     * @param batchId - SAP batch number to query.
     * @returns `BatchLineage` describing parent/child relationships.
     */
    getBatchLineage(batchId: string): Promise<BatchLineage> {
      return client.get<BatchLineage>('/batch-lineage', {
        query: { batchId },
      })
    },
  }
}
