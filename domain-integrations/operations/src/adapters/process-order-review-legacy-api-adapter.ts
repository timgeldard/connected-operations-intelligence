import { ProcessOrderSearchResponseSchema } from '@connectio/data-contracts'
import type { ProcessOrderHeader, ProcessOrderSearchRequest, ProcessOrderSearchResponse } from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { ProcessOrderReviewAdapter } from './process-order-review-adapter.js'
import type { ProcessOrderReviewAdapterRequest } from './process-order-review-adapter.js'

/**
 * Tier: legacy-api / databricks-api
 * Verified methods (databricks-api, 2026-05-17): getOrderOperations, getOrderConfirmations, getOrderGoodsMovements
 * Verified methods (legacy-api): none — getProcessOrderHeader wired but not browser-verified against V1
 * Fallback: ProcessOrderReviewAdapter (mock) — unimplemented methods return mock data
 */
export class ProcessOrderReviewLegacyApiAdapter extends ProcessOrderReviewAdapter {
  protected readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Tier: legacy-api — wired to V1 POH order-header endpoint.
   * Returns an error AdapterResult on network or proxy failure.
   */
  override async getProcessOrderHeader(
    request: ProcessOrderReviewAdapterRequest,
  ): Promise<AdapterResult<ProcessOrderHeader>> {
    if (!request.processOrderId) {
      return super.getProcessOrderHeader(request)
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/por/order-header`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process_order_id: request.processOrderId,
          plant_id: request.plantId,
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
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = await response.json()

      const mapped: ProcessOrderHeader = {
        processOrderId: raw.process_order_id ?? raw.processOrderId ?? request.processOrderId,
        orderType: raw.order_type ?? raw.orderType ?? 'process-order',
        materialId: raw.material_id ?? raw.materialId ?? '',
        materialDescription: raw.material_description ?? raw.materialDescription ?? '',
        batchId: raw.batch_id ?? raw.batchId,
        plantId: raw.plant_id ?? raw.plantId ?? request.plantId ?? '',
        plannedQuantity: raw.planned_qty ?? raw.planned_quantity ?? raw.plannedQuantity ?? 0,
        confirmedQuantity:
          raw.confirmed_qty ?? raw.confirmed_quantity ?? raw.confirmedQuantity ?? 0,
        uom: raw.uom ?? raw.base_uom ?? '',
        // plannedStart / plannedFinish are .nullable().optional() — preserve
        // source `null` instead of inventing a current-timestamp default. A
        // synthetic "now" value would be indistinguishable from a real plan.
        plannedStart: raw.planned_start ?? raw.plannedStart ?? null,
        plannedFinish: raw.planned_finish ?? raw.plannedFinish ?? null,
        actualStart: raw.actual_start ?? raw.actualStart ?? null,
        actualFinish: raw.actual_finish ?? raw.actualFinish ?? null,
        // orderStatus enum now includes 'unknown' (PR #102). Falling back to
        // 'released' was source-untruthful — the order is not actually known
        // to be released. 'unknown' is the source-truthful no-info value.
        orderStatus: raw.order_status ?? raw.orderStatus ?? 'unknown',
      }

      return { ok: true, data: mapped, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }

  override async searchOrders(
    request: ProcessOrderSearchRequest,
  ): Promise<AdapterResult<ProcessOrderSearchResponse>> {
    if (!request.query || !request.query.trim()) {
      return {
        ok: true,
        data: { items: [], total: 0, truncated: false, wildcardApplied: false },
        fetchedAt: new Date().toISOString(),
        source: 'legacy-api',
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/por/order-search`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: request.query,
          maxRows: request.maxRows ?? 50,
          materialId: request.materialId,
          batchId: request.batchId,
        }),
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : response.status === 503
                ? ('unknown' as const)
                : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = await response.json()
      const data = ProcessOrderSearchResponseSchema.parse(raw)
      return { ok: true, data, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }
}
