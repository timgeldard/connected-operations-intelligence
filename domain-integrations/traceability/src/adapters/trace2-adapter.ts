import { z } from 'zod'
import type {
  TraceInvestigationContext,
  BatchHeaderSummary,
  TraceGraph,
  MassBalanceSummary,
  CustomerExposureSummary,
  SupplierExposureSummary,
  ProductionHistorySummary,
  TraceEvent,
  CoAReleaseStatus,
  TraceRiskSignal,
  RelatedInvestigation,
  TraceExposureForRelease,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockInvestigationContext,
  mockBatchHeader,
  mockTraceGraph,
  mockMassBalance,
  mockCustomerExposure,
  mockSupplierExposure,
  mockProductionHistory,
  mockTraceEvents,
  mockCoAReleaseStatus,
  mockRiskSignals,
  mockRelatedInvestigations,
  mockTraceExposureForRelease,
} from './trace2-mock-data.js'

/**
 * Request context passed to all Trace2 adapter methods.
 *
 * @remarks
 * In Phase 1 all methods use the mock data file; `investigationId` and
 * `batchId` are accepted for type-safety and future API wiring.
 */
export interface Trace2AdapterRequest {
  readonly investigationId?: string
  readonly batchId?: string
  readonly plantId?: string
  readonly materialId?: string
  readonly direction?: 'both' | 'upstream' | 'downstream'
  readonly maxDepth?: number
  readonly maxEdges?: number
}

export const Trace2BatchSearchMatchTypeSchema = z.enum([
  'material-id',
  'description',
  'batch-id',
  'process-order-id',
])

export type Trace2BatchSearchMatchType = z.infer<typeof Trace2BatchSearchMatchTypeSchema>

export const Trace2BatchSearchItemSchema = z.object({
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  processOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  latestPostingDate: z.string().nullable().optional().describe('[classification: source-field]'),
  quantity: z.number().nullable().optional().describe('[classification: source-field]'),
  uom: z.string().nullable().optional().describe('[classification: source-field]'),
  matchTypes: z.array(Trace2BatchSearchMatchTypeSchema).describe('[classification: application-derived]'),
})

export type Trace2BatchSearchItem = z.infer<typeof Trace2BatchSearchItemSchema>

export const Trace2BatchSearchResponseSchema = z.object({
  query: z.string().describe('[classification: application-derived]'),
  total: z.number().int().min(0).describe('[classification: application-derived]'),
  truncated: z.boolean().describe('[classification: application-derived]'),
  wildcardApplied: z.boolean().describe('[classification: application-derived]'),
  items: z.array(Trace2BatchSearchItemSchema).describe('[classification: source-derived]'),
})

export type Trace2BatchSearchResponse = z.infer<typeof Trace2BatchSearchResponseSchema>

export interface Trace2BatchSearchRequest {
  readonly query: string
  readonly materialId?: string
  readonly batchId?: string
  readonly maxRows?: number
}

/**
 * Resolves to an ISO 8601 timestamp representing "now".
 * Extracted so tests can override it without mocking `Date`.
 */
export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

const MOCK_TRACE_BATCH_SEARCH_ITEMS: readonly Omit<Trace2BatchSearchItem, 'matchTypes'>[] = [
  {
    materialId: '20035129',
    materialDescription: 'CHEESE POWDER BLEND 25KG',
    batchId: '8000049668',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
    processOrderId: '007006964801',
    quantity: 1000,
    uom: 'KG',
  },
  {
    materialId: '20035129',
    materialDescription: 'CHEESE POWDER BLEND 25KG',
    batchId: '8000049669',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
    processOrderId: '007006964802',
    quantity: 925,
    uom: 'KG',
  },
  {
    materialId: '20035130',
    materialDescription: 'WHEY POWDER BLEND 25KG',
    batchId: '8000049668',
    plantId: 'C061',
    plantName: 'Kerry Cork (C061)',
    processOrderId: '007006964803',
    quantity: 775,
    uom: 'KG',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    processOrderId: 'PO-240308-1189',
    quantity: 2400,
    uom: 'KG',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE11',
    plantName: 'Kerry Charleville (IE11)',
    processOrderId: 'PO-240308-1189',
    quantity: 2400,
    uom: 'KG',
  },
  {
    materialId: '100023847',
    materialDescription: 'EMMENTAL BLOCK NATURAL 100KG',
    batchId: 'CH-240308-0048',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    processOrderId: 'PO-240308-1190',
    quantity: 2350,
    uom: 'KG',
  },
  {
    materialId: '100023848',
    materialDescription: 'CHEDDAR CHEESE NATURAL 100KG',
    batchId: 'CH-240308-0047',
    plantId: 'IE10',
    plantName: 'Kerry Listowel (IE10)',
    processOrderId: 'PO-240308-1191',
    quantity: 1800,
    uom: 'KG',
  },
]

/**
 * Creates a successful {@link AdapterResult} wrapping the given data.
 *
 * @param data - The payload to wrap.
 * @param now - ISO 8601 timestamp for `fetchedAt`. Defaults to current time.
 * @returns A successful AdapterResult.
 */
function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now() }
}

/**
 * Creates a failed {@link AdapterResult} wrapping an {@link AdapterError}.
 *
 * @param code - Machine-readable error category.
 * @param message - Human-readable error description.
 * @returns A failed AdapterResult.
 */
function err<T>(code: AdapterError['code'], message: string): AdapterResult<T> {
  return {
    ok: false,
    error: { code, message, retryable: code !== 'unauthorized' && code !== 'not-found' },
    displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
  }
}

function hasWildcard(query: string): boolean {
  return query.includes('*') || query.includes('%')
}

function matchesSearch(value: string | null | undefined, rawQuery: string): boolean {
  const query = rawQuery.trim()
  if (!value || !query) return false

  if (!hasWildcard(query)) {
    return value.toLowerCase().includes(query.toLowerCase())
  }

  const regex = new RegExp(
    `^${query.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`,
    'i',
  )
  return regex.test(value)
}

function getSearchMatchTypes(
  item: Omit<Trace2BatchSearchItem, 'matchTypes'>,
  query: string,
): Trace2BatchSearchMatchType[] {
  const matchTypes: Trace2BatchSearchMatchType[] = []
  if (matchesSearch(item.materialId, query)) matchTypes.push('material-id')
  if (matchesSearch(item.materialDescription, query)) matchTypes.push('description')
  if (matchesSearch(item.batchId, query)) matchTypes.push('batch-id')
  if (matchesSearch(item.processOrderId, query)) matchTypes.push('process-order-id')
  return matchTypes
}

function identifiersMatch(value: string, expected: string): boolean {
  return value.trim().toLowerCase() === expected.trim().toLowerCase()
}

function compareBatchSearchItems(a: Trace2BatchSearchItem, b: Trace2BatchSearchItem): number {
  return (
    compareDatesDesc(a.latestPostingDate, b.latestPostingDate) ||
    compareNumbersDesc(a.quantity, b.quantity) ||
    a.batchId.localeCompare(b.batchId) ||
    a.materialId.localeCompare(b.materialId) ||
    a.plantId.localeCompare(b.plantId)
  )
}

function compareDatesDesc(a: string | null | undefined, b: string | null | undefined): number {
  const aTime = toTime(a)
  const bTime = toTime(b)
  if (aTime === null && bTime === null) return 0
  if (aTime === null) return 1
  if (bTime === null) return -1
  return bTime - aTime
}

function compareNumbersDesc(a: number | null | undefined, b: number | null | undefined): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

function toTime(value: string | null | undefined): number | null {
  if (!value) return null
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : time
}

/**
 * Trace2 source adapter.
 *
 * @remarks
 * Phase 1 implementation returns realistic mock data matching the
 * `@connectio/data-contracts` trace-investigation schemas. All methods are
 * async so the API surface is identical to the eventual live implementation
 * (which will call the FastAPI `/api/trace2/…` endpoints).
 *
 * Do not add business logic here — this adapter maps raw source responses into
 * typed data-contract shapes. Business rules belong in the domain service layer.
 */
export class Trace2Adapter {
  /** Simulated network delay in milliseconds (0 disables simulation). */
  private readonly simulatedDelayMs: number

  /** Override for the "now" clock — useful in tests. */
  private readonly now: NowFn

  constructor(opts: { simulatedDelayMs?: number; now?: NowFn } = {}) {
    this.simulatedDelayMs = opts.simulatedDelayMs ?? 0
    this.now = opts.now ?? defaultNow
  }

  /**
   * Simulate async I/O latency when `simulatedDelayMs > 0`.
   * Resolved immediately in production builds.
   */
  private async delay(): Promise<void> {
    if (this.simulatedDelayMs > 0) {
      await new Promise<void>(resolve => setTimeout(resolve, this.simulatedDelayMs))
    }
  }

  /**
   * Searches known trace batches by material, description, batch, or process order.
   *
   * @remarks
   * The mock tier uses the same designed consumer-search candidates as the
   * Trace Consumer workspace. The legacy/databricks tiers override this method
   * with a live Databricks-backed search.
   */
  async searchBatches(
    request: Trace2BatchSearchRequest,
  ): Promise<AdapterResult<Trace2BatchSearchResponse>> {
    await this.delay()
    const query = request.query.trim()
    if (!query) return err('not-found', 'Enter a material, description, batch, or process order.')

    const maxRows = Math.min(Math.max(request.maxRows ?? 25, 1), 50)
    const materialId = request.materialId?.trim()
    const batchId = request.batchId?.trim()
    const matched = MOCK_TRACE_BATCH_SEARCH_ITEMS
      .map(item => {
        if (materialId && batchId) {
          return {
            ...item,
            matchTypes:
              identifiersMatch(item.materialId, materialId) && identifiersMatch(item.batchId, batchId)
                ? (['material-id', 'batch-id'] satisfies Trace2BatchSearchMatchType[])
                : [],
          }
        }

        return { ...item, matchTypes: getSearchMatchTypes(item, query) }
      })
      .filter(item => item.matchTypes.length > 0)
      .sort(compareBatchSearchItems)
    const items = Trace2BatchSearchItemSchema.array().parse(matched.slice(0, maxRows))

    return {
      ok: true,
      data: {
        query,
        total: items.length,
        truncated: matched.length > maxRows,
        wildcardApplied: hasWildcard(query),
        items,
      },
      fetchedAt: this.now(),
      source: 'mock',
    }
  }

  /**
   * Fetches the investigation context record.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The investigation context, or an error result.
   */
  async getInvestigationContext(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceInvestigationContext>> {
    await this.delay()
    return ok(mockInvestigationContext, this.now)
  }

  /**
   * Fetches the batch header summary for the investigation's root batch.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The batch header summary, or an error result.
   */
  async getBatchHeaderSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<BatchHeaderSummary>> {
    await this.delay()
    return ok(mockBatchHeader, this.now)
  }

  /**
   * Fetches the full trace graph (upstream + downstream nodes and edges).
   *
   * @param request - Investigation and batch identifiers.
   * @returns The trace graph, or an error result.
   */
  async getTraceGraph(_request: Trace2AdapterRequest): Promise<AdapterResult<TraceGraph>> {
    await this.delay()
    return ok(mockTraceGraph, this.now)
  }

  /**
   * Fetches the mass balance summary for the root batch.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The mass balance summary, or an error result.
   */
  async getMassBalanceSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<MassBalanceSummary>> {
    await this.delay()
    return ok(mockMassBalance, this.now)
  }

  /**
   * Fetches the downstream customer exposure summary.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The customer exposure summary, or an error result.
   */
  async getCustomerExposureSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CustomerExposureSummary>> {
    await this.delay()
    return ok(mockCustomerExposure, this.now)
  }

  /**
   * Fetches the upstream supplier exposure summary.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The supplier exposure summary, or an error result.
   */
  async getSupplierExposureSummary(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<SupplierExposureSummary>> {
    await this.delay()
    return ok(mockSupplierExposure, this.now)
  }

  /**
   * Fetches the production history for a material — recent batches.
   *
   * @param request - Investigation and material identifier.
   * @returns The production history summary, or an error result.
   */
  async getProductionHistory(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<ProductionHistorySummary>> {
    await this.delay()
    return ok(mockProductionHistory, this.now)
  }

  /**
   * Fetches the ordered event timeline for the investigation.
   *
   * @param request - Investigation and batch identifiers.
   * @returns An array of trace events, or an error result.
   */
  async getEventTimeline(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly TraceEvent[]>> {
    await this.delay()
    return ok(mockTraceEvents, this.now)
  }

  /**
   * Fetches the CoA / release status for the root batch.
   *
   * @param request - Investigation and batch identifiers.
   * @returns The CoA release status, or an error result.
   */
  async getCoAReleaseStatus(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CoAReleaseStatus>> {
    await this.delay()
    return ok(mockCoAReleaseStatus, this.now)
  }

  /**
   * Fetches active risk signals associated with the investigation.
   *
   * @param request - Investigation and batch identifiers.
   * @returns An array of risk signals, or an error result.
   */
  async getRiskSignals(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly TraceRiskSignal[]>> {
    await this.delay()
    return ok(mockRiskSignals, this.now)
  }

  /**
   * Fetches related investigations (same batch, material, supplier, or customer).
   *
   * @param request - Investigation and batch identifiers.
   * @returns An array of related investigation records, or an error result.
   */
  async getRelatedInvestigations(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<readonly RelatedInvestigation[]>> {
    await this.delay()
    return ok(mockRelatedInvestigations, this.now)
  }

  /**
   * Fetches a trace exposure summary oriented for a batch release decision.
   *
   * @remarks
   * This method provides a release-decision view of the trace data — upstream/
   * downstream risk levels, affected parties, and open investigation links.
   * Consumed by the Quality Batch Release workspace's Trace Evidence panel.
   *
   * @param _request - Investigation and batch identifiers.
   * @returns The trace exposure for release summary, or an error result.
   */
  async getTraceExposureForRelease(
    _request: Trace2AdapterRequest,
  ): Promise<AdapterResult<TraceExposureForRelease>> {
    await this.delay()
    return ok(mockTraceExposureForRelease, this.now)
  }
}

/** Shared singleton adapter instance used across all Phase 1 panels and hooks. */
export const trace2Adapter = new Trace2Adapter()

/**
 * Extracts a plain {@link AdapterError}-shaped message from any thrown value.
 *
 * @param thrown - Value caught from a try/catch block.
 * @returns A normalised error result.
 */
export function toAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : String(thrown)
  return err<T>('unknown', message)
}
