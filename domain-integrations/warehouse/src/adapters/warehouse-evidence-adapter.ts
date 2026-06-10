import type {
  WarehouseHoldStatus,
  WarehouseEvidenceAdapterRequest,
} from '@connectio/data-contracts'
export type { WarehouseHoldStatus, WarehouseEvidenceAdapterRequest }
import type { AdapterResult, AdapterError, AdapterSource } from '@connectio/source-adapters'

export type NowFn = () => string
const defaultNow: NowFn = () => new Date().toISOString()

export interface WarehouseEvidenceAdapterOptions {
  readonly baseUrl?: string
  readonly now?: NowFn
}

export class WarehouseEvidenceAdapter {
  private readonly baseUrl: string
  private readonly now: NowFn

  constructor(options: WarehouseEvidenceAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? (import.meta.env?.VITE_WH360_API_BASE_URL as string) ?? '').replace(/\/$/, '')
    this.now = options.now ?? defaultNow
  }

  async getWarehouseHoldStatus(
    request: WarehouseEvidenceAdapterRequest
  ): Promise<AdapterResult<WarehouseHoldStatus>> {
    const batchId = request.batchId ?? ''
    if (!batchId) {
      return this.handleError('unknown', 'batchId cannot be empty')
    }
    try {
      const params = new URLSearchParams()
      if (request.plantId) params.set('plant_id', request.plantId)
      const pathWithQuery = `/api/warehouse360/batch/${batchId}/hold-status?${params.toString()}`
      const url = this.baseUrl ? `${this.baseUrl}${pathWithQuery}` : pathWithQuery

      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<WarehouseHoldStatus>(res, 'databricks-api')
      }

      const raw = await res.json()
      const activeHolds = Array.isArray(raw.activeHolds) ? raw.activeHolds : []
      const data: WarehouseHoldStatus = {
        batchId: String(raw.batchId ?? ''),
        materialId: String(raw.materialId ?? ''),
        plantId: String(raw.plantId ?? ''),
        storageLocationId: raw.storageLocationId ? String(raw.storageLocationId) : undefined,
        stockType: raw.stockType ?? 'unrestricted',
        totalQuantity: Number(raw.totalQuantity ?? 0),
        blockedQuantity: Number(raw.blockedQuantity ?? 0),
        restrictedQuantity: Number(raw.restrictedQuantity ?? 0),
        unrestrictedQuantity: Number(raw.unrestrictedQuantity ?? 0),
        uom: String(raw.uom ?? ''),
        activeHolds: activeHolds.map((h: any) => ({
          holdId: String(h.holdId ?? ''),
          holdType: h.holdType ?? 'quality',
          reason: String(h.reason ?? ''),
          placedBy: String(h.placedBy ?? ''),
          placedAt: String(h.placedAt ?? ''),
          expiresAt: h.expiresAt ? String(h.expiresAt) : undefined,
          status: h.status ?? 'active',
        })),
        hasBlockingHold: Boolean(raw.hasBlockingHold),
        lastUpdatedAt: String(raw.lastUpdatedAt ?? this.now()),
      }

      return {
        ok: true,
        data,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<WarehouseHoldStatus>(e, 'databricks-api')
    }
  }

  private handleError<T>(code: AdapterError['code'], message: string): AdapterResult<T> {
    return {
      ok: false,
      error: { code, message, retryable: false },
      displayState: 'error',
      source: 'databricks-api',
    }
  }

  private handleHttpError<T>(res: Response, source: AdapterSource): AdapterResult<T> {
    const code =
      res.status === 401
        ? ('unauthorized' as const)
        : res.status === 404
          ? ('not-found' as const)
          : ('network' as const)
    return {
      ok: false,
      error: {
        code,
        message: `HTTP error ${res.status}`,
        retryable: res.status >= 500,
      },
      displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
      source,
    }
  }

  private handleCatchError<T>(e: unknown, source: AdapterSource): AdapterResult<T> {
    const message = e instanceof Error ? e.message : String(e)
    return {
      ok: false,
      error: { code: 'unknown', message, retryable: true },
      displayState: 'error',
      source,
    }
  }
}

export const warehouseEvidenceAdapter = new WarehouseEvidenceAdapter()

export function toAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return {
    ok: false,
    error: { code: 'unknown', message, retryable: true },
    displayState: 'error',
    source: 'databricks-api',
  }
}
