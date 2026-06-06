import { useQuery } from '@tanstack/react-query'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  BatchQualityPassportSchema,
  HoldsLedgerSchema,
  InvestigationTimelineSchema,
  MassBalanceLedgerSchema,
  RecallReadinessSchema,
  SupplierBatchViewSchema,
  type BatchQualityPassport,
  type HoldsLedger,
  type InvestigationTimeline,
  type MassBalanceLedger,
  type RecallReadiness,
  type SupplierBatchView,
} from '@connectio/data-contracts'
import {
  MOCK_BATCH_QUALITY_PASSPORT,
  MOCK_HOLDS_LEDGER,
  MOCK_INVESTIGATION_TIMELINE,
  MOCK_MASS_BALANCE_LEDGER,
  MOCK_RECALL_READINESS,
  MOCK_SUPPLIER_BATCH_VIEW,
} from './trace-app-mock-data.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

interface QueryHookOptions {
  readonly enabled?: boolean
}

const TRACE_APP_STALE_TIME_MS = 5 * 60 * 1000

const ADAPTER_MODE = (import.meta.env.VITE_ADAPTER_MODE ?? 'mock') as
  | 'mock'
  | 'legacy-api'
  | 'databricks-api'
const TRACE_BASE_URL = (import.meta.env.VITE_TRACE_API_BASE_URL ?? '') as string

function appKey(method: string, request: Trace2AdapterRequest) {
  return [
    'trace-app',
    method,
    request.materialId ?? null,
    request.batchId ?? null,
    request.plantId ?? null,
  ] as const
}

/**
 * Hook for the Quality Passport tab.
 *
 * In non-mock mode, calls the full backend at
 * `POST /api/trace2/batch-quality-passport` (which fans out across 5 source
 * queries server-side). In mock mode returns the design's fixture data.
 */
export function useBatchQualityPassport(
  request: Trace2AdapterRequest,
  options: QueryHookOptions = {},
) {
  return useQuery<AdapterResult<BatchQualityPassport>>({
    queryKey: appKey('getBatchQualityPassport', request),
    queryFn: async () => {
      if (ADAPTER_MODE === 'mock' || !request.materialId || !request.batchId) {
        await new Promise((resolve) => setTimeout(resolve, 280))
        const data = BatchQualityPassportSchema.parse(MOCK_BATCH_QUALITY_PASSPORT)
        return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'mock' }
      }
      return fetchTraceAppEndpoint(
        '/api/trace2/batch-quality-passport',
        {
          material_id: request.materialId,
          batch_id: request.batchId,
          plant_id: request.plantId ?? '',
        },
        BatchQualityPassportSchema,
        'Quality passport',
      )
    },
    staleTime: TRACE_APP_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

/**
 * Hook for the Mass Balance tab.
 *
 * In non-mock mode, calls `POST /api/trace2/mass-balance-ledger` against
 * `gold_batch_mass_balance_v`. Returns full MSEG-style ledger with computed
 * KPIs and running balance.
 */
export function useMassBalance(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<MassBalanceLedger>>({
    queryKey: appKey('getMassBalance', request),
    queryFn: async () => {
      if (ADAPTER_MODE === 'mock' || !request.materialId || !request.batchId) {
        await new Promise((resolve) => setTimeout(resolve, 320))
        const data = MassBalanceLedgerSchema.parse(MOCK_MASS_BALANCE_LEDGER)
        return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'mock' }
      }
      return fetchTraceAppEndpoint(
        '/api/trace2/mass-balance-ledger',
        {
          material_id: request.materialId,
          batch_id: request.batchId,
          plant_id: request.plantId ?? '',
        },
        MassBalanceLedgerSchema,
        'Mass balance ledger',
      )
    },
    staleTime: TRACE_APP_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

/**
 * Hook for the Investigation Timeline tab.
 *
 * In non-mock mode, calls `POST /api/trace2/investigation-timeline` which
 * UNIONs mass-balance, quality-lot, and delivery sources. An empty events
 * array is a valid 200 response.
 */
export function useInvestigationTimeline(
  request: Trace2AdapterRequest,
  options: QueryHookOptions = {},
) {
  return useQuery<AdapterResult<InvestigationTimeline>>({
    queryKey: appKey('getInvestigationTimeline', request),
    queryFn: async () => {
      if (ADAPTER_MODE === 'mock' || !request.materialId || !request.batchId) {
        await new Promise((resolve) => setTimeout(resolve, 240))
        const data = InvestigationTimelineSchema.parse(MOCK_INVESTIGATION_TIMELINE)
        return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'mock' }
      }
      return fetchTraceAppEndpoint(
        '/api/trace2/investigation-timeline',
        {
          material_id: request.materialId,
          batch_id: request.batchId,
          plant_id: request.plantId ?? '',
        },
        InvestigationTimelineSchema,
        'Investigation timeline',
      )
    },
    staleTime: TRACE_APP_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

/**
 * Hook for the Recall & Exposure tab.
 *
 * @remarks
 * In `databricks-api` mode (or any non-mock mode) calls
 * `POST /api/trace2/recall-readiness` and validates the response against the
 * Zod schema. Falls back to mock data in `mock` mode or when the backend
 * returns a 404 with `do not interpret as zero exposure` semantics — the
 * mock fallback only applies in `mock` mode; in non-mock mode a 404 surfaces
 * as `ok: false` so the UI can render the empty-evidence message.
 *
 * Cross-plant — `plantId` is intentionally NOT forwarded to the backend.
 */
export function useRecallReadiness(
  request: Trace2AdapterRequest,
  options: QueryHookOptions = {},
) {
  return useQuery<AdapterResult<RecallReadiness>>({
    queryKey: appKey('getRecallReadiness', request),
    queryFn: async () => {
      if (ADAPTER_MODE === 'mock' || !request.materialId || !request.batchId) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        const data = RecallReadinessSchema.parse(MOCK_RECALL_READINESS)
        return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'mock' }
      }
      return fetchTraceAppEndpoint(
        '/api/trace2/recall-readiness',
        { material_id: request.materialId, batch_id: request.batchId },
        RecallReadinessSchema,
        'Recall readiness',
      )
    },
    staleTime: TRACE_APP_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

/**
 * Hook for the Holds & Releases tab.
 *
 * In non-mock mode, calls `POST /api/trace2/holds-ledger` which derives the
 * view from gold_batch_stock_v (qty-by-reason) and gold_batch_quality_lot_v
 * (active/resolved inspections). READ-ONLY — no mutations.
 */
export function useHoldsReleases(request: Trace2AdapterRequest, options: QueryHookOptions = {}) {
  return useQuery<AdapterResult<HoldsLedger>>({
    queryKey: appKey('getHoldsReleases', request),
    queryFn: async () => {
      if (ADAPTER_MODE === 'mock' || !request.materialId || !request.batchId) {
        await new Promise((resolve) => setTimeout(resolve, 260))
        const data = HoldsLedgerSchema.parse(MOCK_HOLDS_LEDGER)
        return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'mock' }
      }
      return fetchTraceAppEndpoint(
        '/api/trace2/holds-ledger',
        {
          material_id: request.materialId,
          batch_id: request.batchId,
          plant_id: request.plantId ?? '',
        },
        HoldsLedgerSchema,
        'Holds ledger',
      )
    },
    staleTime: TRACE_APP_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

/**
 * Hook for the Supplier Batches tab.
 *
 * @remarks
 * In non-mock mode, calls `POST /api/trace2/supplier-batches` which fans out
 * to two `gold_batch_lineage` queries (consumed lots + cross-plant siblings).
 * Sibling discovery is intentionally NOT plant-filtered — the whole point is
 * cross-plant ripple risk.
 */
export function useSupplierBatches(
  request: Trace2AdapterRequest,
  options: QueryHookOptions = {},
) {
  return useQuery<AdapterResult<SupplierBatchView>>({
    queryKey: appKey('getSupplierBatches', request),
    queryFn: async () => {
      if (ADAPTER_MODE === 'mock' || !request.materialId || !request.batchId) {
        await new Promise((resolve) => setTimeout(resolve, 280))
        const data = SupplierBatchViewSchema.parse(MOCK_SUPPLIER_BATCH_VIEW)
        return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'mock' }
      }
      return fetchTraceAppEndpoint(
        '/api/trace2/supplier-batches',
        { material_id: request.materialId, batch_id: request.batchId },
        SupplierBatchViewSchema,
        'Supplier batches',
      )
    },
    staleTime: TRACE_APP_STALE_TIME_MS,
    enabled: options.enabled ?? true,
  })
}

// ---------------------------------------------------------------------------
// Shared HTTP fetcher for the trace-app tabs.
// ---------------------------------------------------------------------------

async function fetchTraceAppEndpoint<T>(
  path: string,
  body: Record<string, unknown>,
  schema: { parse: (input: unknown) => T },
  label: string,
): Promise<AdapterResult<T>> {
  try {
    const response = await fetch(`${TRACE_BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      if (response.status === 404) {
        let detail = `${label} unavailable — do not interpret as zero exposure until source coverage is validated.`
        try {
          const json = (await response.json()) as Record<string, unknown>
          if (typeof json.detail === 'string') detail = json.detail
        } catch {
          /* ignore parse errors */
        }
        return {
          ok: false,
          error: { code: 'not-found', message: detail, retryable: false },
          displayState: 'error',
          source: 'databricks-api',
        }
      }
      const code = response.status === 401 ? ('unauthorized' as const) : ('network' as const)
      return {
        ok: false,
        error: {
          code,
          message: `${label} unavailable (HTTP ${response.status})`,
          retryable: response.status >= 500 && response.status !== 503,
        },
        displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
        source: 'databricks-api',
      }
    }

    const raw = await response.json()
    const data = schema.parse(raw)
    return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: {
        code: 'unknown',
        message: `${label} unavailable (${message})`,
        retryable: true,
      },
      displayState: 'error',
      source: 'databricks-api',
    }
  }
}
