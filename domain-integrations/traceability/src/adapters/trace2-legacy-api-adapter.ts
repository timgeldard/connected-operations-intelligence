import {
  BatchHeaderSummarySchema,
  CustomerExposureSummarySchema,
  MassBalanceSummarySchema,
  SupplierExposureSummarySchema,
  ProductionHistorySummarySchema,
  ApiError,
} from '@connectio/data-contracts'
import type {
  BatchHeaderSummary,
  CustomerExposureSummary,
  MassBalanceSummary,
  SupplierExposureSummary,
  ProductionHistorySummary,
  TraceGraph,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { Trace2Adapter } from './trace2-adapter.js'
import {
  Trace2BatchSearchResponseSchema,
  type Trace2AdapterRequest,
  type Trace2BatchSearchRequest,
  type Trace2BatchSearchResponse,
} from './trace2-adapter.js'
import { mapBackendTraceGraph } from './trace2-graph-mapper.js'

interface V1BatchHeaderResponse {
  material_id: string
  batch_id: string
  material_name: string
  process_order: string | null
  plant_id: string
  manufacture_date: string | null
  expiry_date: string | null
  uom: string
  qty_produced: number
  unrestricted: number
  blocked: number
  qi: number
  restricted: number
  transit: number
  batch_status: string
  [key: string]: unknown
}

function toIsoDatetime(dateStr: string | null | undefined): string | undefined {
  if (!dateStr) return undefined
  return dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00.000Z`
}

function mapBatchStatus(status: string): 'active' | 'archived' | 'blocked' | 'deleted' {
  const s = status.toLowerCase()
  if (s === 'blocked' || s === '2') return 'blocked'
  if (s === 'archived' || s === '3') return 'archived'
  if (s === 'deleted' || s === '4') return 'deleted'
  return 'active'
}

function mapStockStatus(r: V1BatchHeaderResponse): BatchHeaderSummary['stockStatus'] {
  if (r.blocked > 0) return 'blocked'
  if (r.qi > 0) return 'quality-inspection'
  if (r.transit > 0) return 'transit'
  if (r.restricted > 0) return 'restricted'
  return 'unrestricted'
}

function mapQualityStatus(r: V1BatchHeaderResponse): BatchHeaderSummary['qualityStatus'] {
  if (r.qi > 0) return 'pending'
  if (r.blocked > 0) return 'rejected'
  return 'not-applicable'
}

function mapReleaseStatus(r: V1BatchHeaderResponse): BatchHeaderSummary['releaseStatus'] {
  if (r.blocked > 0) return 'blocked'
  if (r.qi > 0) return 'not-released'
  if (r.unrestricted > 0) return 'released'
  return 'unknown'
}

/**
 * Tier: legacy-api (HTTP calls to FastAPI backend)
 * getBatchHeaderSummary: proxies to V1 Trace2 (browser-verified)
 * getTraceGraph: calls native Databricks route POST /api/trace2/trace-graph (browser-verified 2026-05-18)
 * All other methods: fall through to Trace2Adapter mock
 */
export class Trace2LegacyApiAdapter extends Trace2Adapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Tier: databricks-api — searches verified trace gold views for complete
   * batch context before launching the consumer investigation canvas.
   */
  override async searchBatches(
    request: Trace2BatchSearchRequest,
  ): Promise<AdapterResult<Trace2BatchSearchResponse>> {
    const query = request.query.trim()
    if (!query) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'Enter a material, description, batch, or process order.',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/batch-search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          max_rows: request.maxRows ?? 25,
          ...(request.materialId ? { material_id: request.materialId } : {}),
          ...(request.batchId ? { batch_id: request.batchId } : {}),
        }),
      })

      if (!response.ok) {
        let detail = `Batch search unavailable (HTTP ${response.status})`
        try {
          const json = (await response.json()) as Record<string, unknown>
          if (typeof json.detail === 'string') detail = json.detail
        } catch {
          /* ignore parse errors */
        }

        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: detail,
            retryable: response.status >= 500 && response.status !== 503,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const data = Trace2BatchSearchResponseSchema.parse(raw)
      return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const code = message.includes('parse') || message.includes('schema') ? 'invalid-data' : 'unknown'
      return {
        ok: false,
        error: { code, message: `Batch search unavailable (${message})`, retryable: code === 'unknown' },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: legacy-api — browser-verified against V1 Trace2 batch-header endpoint.
   * Next tier: databricks-api (pending V1 Trace2 retirement).
   */
  override async getBatchHeaderSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<BatchHeaderSummary>> {
    if (!request.batchId || !request.materialId) {
      return super.getBatchHeaderSummary(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/batch-header`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: request.materialId,
          batch_id: request.batchId,
          ...(request.plantId ? { plant_id: request.plantId } : {}),
        }),
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: { code, message: `Proxy returned ${response.status}`, retryable: response.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = await response.json()

      // X-Adapter-Mode is set by FastAPI when the backend ran the databricks-api path.
      // That path returns a BatchHeaderSummary-shaped camelCase object directly.
      // The legacy-api path proxies to V1 which returns snake_case V1BatchHeaderResponse.
      const adapterMode = response.headers?.get('X-Adapter-Mode')

      let mapped: import('@connectio/data-contracts').BatchHeaderSummary
      let source: 'databricks-api' | 'legacy-api'

      if (adapterMode === 'databricks-api') {
        const r = raw as Record<string, unknown>
        mapped = BatchHeaderSummarySchema.parse({
          ...r,
          manufactureDate: toIsoDatetime(r['manufactureDate'] as string | null | undefined),
          expiryDate: toIsoDatetime(r['expiryDate'] as string | null | undefined),
        })
        source = 'databricks-api'
      } else {
        const v1 = raw as V1BatchHeaderResponse
        mapped = BatchHeaderSummarySchema.parse({
          materialId: v1.material_id,
          materialDescription: v1.material_name,
          batchId: v1.batch_id,
          plantId: v1.plant_id,
          plantName: v1.plant_id,
          batchStatus: mapBatchStatus(v1.batch_status),
          quantity: v1.qty_produced,
          uom: v1.uom,
          manufactureDate: toIsoDatetime(v1.manufacture_date),
          expiryDate: toIsoDatetime(v1.expiry_date),
          processOrderId: v1.process_order ?? undefined,
          unrestricted: v1.unrestricted,
          blocked: v1.blocked,
          qualityInspection: v1.qi,
          restricted: v1.restricted,
          transit: v1.transit,
          stockStatus: mapStockStatus(v1),
          qualityStatus: mapQualityStatus(v1),
          releaseStatus: mapReleaseStatus(v1),
        })
        source = 'legacy-api'
      }

      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source }
    } catch (e) {
      if (e instanceof ApiError) {
        const code: 'unauthorized' | 'not-found' | 'network' =
          e.status === 401 ? 'unauthorized' : e.status === 404 ? 'not-found' : 'network'
        return {
          ok: false,
          error: { code, message: e.message, retryable: e.status >= 500 },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }

  /**
   * Tier: databricks-api — calls POST /api/trace2/customer-deliveries (V1-parity delivery view slice).
   * Source: gold_batch_delivery_v direct delivery records (no plant filter — recall coverage).
   * No mock fallback. No legacy-api fallback.
   * Zero rows → route returns 404 → adapter returns error with "do not interpret as zero exposure" message.
   * deliveryEvidenceSource='inventory-movements' on successful responses.
   */
  override async getCustomerExposureSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<CustomerExposureSummary>> {
    if (!request.batchId || !request.materialId) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'Material and batch are required to evaluate customer exposure.',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/customer-deliveries`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: request.materialId,
          batch_id: request.batchId,
        }),
      })

      if (!response.ok) {
        if (response.status === 404) {
          let detail =
            'No customer delivery records returned from current source — do not interpret as zero exposure until source coverage is validated.'
          try {
            const json = await response.json() as Record<string, unknown>
            if (typeof json.detail === 'string') detail = json.detail
          } catch { /* ignore parse errors */ }
          return {
            ok: false,
            error: { code: 'not-found', message: detail, retryable: false },
            displayState: 'error',
            source: 'databricks-api',
          }
        }
        const code =
          response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Customer exposure unavailable — do not interpret as zero exposure. (HTTP ${response.status})`,
            retryable: response.status >= 500 && response.status !== 503,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped = CustomerExposureSummarySchema.parse(raw)
      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: {
          code: 'unknown',
          message: `Customer exposure unavailable — do not interpret as zero exposure. (${message})`,
          retryable: true,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — calls POST /api/trace2/mass-balance (live gold_batch_mass_balance_v slice).
   * No mock fallback. No legacy-api fallback. Returns error if required params are missing.
   * Zero rows → route returns 404 → adapter returns error with "do not interpret as balanced" message.
   * Known gaps documented in panel disclaimer (TRACE-P1-010 category mapping, TRACE-P1-011 balance_qty).
   */
  override async getMassBalanceSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<MassBalanceSummary>> {
    if (!request.batchId || !request.materialId) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'Material and batch are required to evaluate mass balance.',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/mass-balance`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: request.materialId,
          batch_id: request.batchId,
        }),
      })

      if (!response.ok) {
        if (response.status === 404) {
          let detail =
            'No mass balance movements returned for this material + batch — do not interpret as a balanced mass balance until source coverage is validated.'
          try {
            const json = await response.json() as Record<string, unknown>
            if (typeof json.detail === 'string') detail = json.detail
          } catch { /* ignore parse errors */ }
          return {
            ok: false,
            error: { code: 'not-found', message: detail, retryable: false },
            displayState: 'error',
            source: 'databricks-api',
          }
        }
        const code =
          response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Mass balance unavailable — do not interpret as balanced. (HTTP ${response.status})`,
            retryable: response.status >= 500 && response.status !== 503,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped = MassBalanceSummarySchema.parse(raw)
      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: {
          code: 'unknown',
          message: `Mass balance unavailable — do not interpret as balanced. (${message})`,
          retryable: true,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — calls POST /api/trace2/supplier-exposure (live VENDOR_RECEIPT + gold_supplier slice).
   * No mock fallback. No legacy-api fallback. Returns error if required params are missing.
   * Zero suppliers is a valid 200 response with empty suppliers[].
   */
  override async getSupplierExposureSummary(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<SupplierExposureSummary>> {
    if (!request.batchId || !request.materialId) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'Material and batch are required to evaluate supplier exposure.',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/supplier-exposure`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: request.materialId,
          batch_id: request.batchId,
        }),
      })

      if (!response.ok) {
        const code =
          response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Supplier exposure unavailable. (HTTP ${response.status})`,
            retryable: response.status >= 500 && response.status !== 503,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped = SupplierExposureSummarySchema.parse(raw)
      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message: `Supplier exposure unavailable. (${message})`, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — calls POST /api/trace2/production-history (live gold_batch_production_history_v slice).
   * No mock fallback. No legacy-api fallback. Returns error if required params are missing.
   * Zero rows is a valid 200 response with empty rows[].
   */
  override async getProductionHistory(
    request: Trace2AdapterRequest,
  ): Promise<AdapterResult<ProductionHistorySummary>> {
    if (!request.materialId) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'Material is required to evaluate production history.',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/production-history`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ material_id: request.materialId }),
      })

      if (!response.ok) {
        const code =
          response.status === 401 ? ('unauthorized' as const) : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Production history unavailable. (HTTP ${response.status})`,
            retryable: response.status >= 500 && response.status !== 503,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped = ProductionHistorySummarySchema.parse(raw)
      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message: `Production history unavailable. (${message})`, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  /**
   * Tier: databricks-api — calls native POST /api/trace2/trace-graph (browser-verified 2026-05-18).
   * No mock fallback. No legacy-api fallback. Returns error if required params are missing.
   */
  override async getTraceGraph(request: Trace2AdapterRequest): Promise<AdapterResult<TraceGraph>> {
    if (!request.batchId || !request.materialId || !request.plantId) {
      return {
        ok: false,
        error: {
          code: 'not-found',
          message: 'material_id, batch_id, and plant_id are required for trace graph',
          retryable: false,
        },
        displayState: 'error',
        source: 'databricks-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/trace2/trace-graph`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          material_id: request.materialId,
          batch_id: request.batchId,
          plant_id: request.plantId,
          direction: request.direction ?? 'both',
          max_depth: request.maxDepth ?? 3,
          max_edges: request.maxEdges ?? 1000,
        }),
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Trace graph request failed: ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const mapped = mapBackendTraceGraph(raw)
      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'databricks-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      const code = message.includes('parse') || message.includes('schema') ? 'invalid-data' as const : 'unknown' as const
      return {
        ok: false,
        error: { code, message, retryable: code === 'unknown' },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }
}
