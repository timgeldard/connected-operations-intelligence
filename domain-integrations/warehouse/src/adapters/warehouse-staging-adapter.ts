import type { WarehouseStagingStatus, MaterialShortage } from '@connectio/data-contracts'
import type { AdapterResult, AdapterSource } from '@connectio/source-adapters'

export interface WarehouseStagingAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly processOrderIds?: readonly string[]
  readonly warehouseId?: string
}

export type NowFn = () => string
const defaultNow: NowFn = () => new Date().toISOString()

function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function buildEndpointUrl(
  baseUrl: string,
  path: string,
  warehouseId: string,
  request: WarehouseStagingAdapterRequest,
): string {
  const params = new URLSearchParams()
  params.set('warehouse_id', warehouseId)
  if (request.plantId) params.set('plant_id', request.plantId)
  const pathWithQuery = `${path}?${params.toString()}`
  return baseUrl ? `${baseUrl}${pathWithQuery}` : pathWithQuery
}

export interface WarehouseStagingAdapterOptions {
  readonly baseUrl?: string
  readonly now?: NowFn
}

export class WarehouseStagingAdapter {
  private readonly baseUrl: string
  private readonly now: NowFn

  constructor(options: WarehouseStagingAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? (import.meta.env?.VITE_WH360_API_BASE_URL as string) ?? '').replace(/\/$/, '')
    this.now = options.now ?? defaultNow
  }

  async getWarehouseStagingStatus(
    request: WarehouseStagingAdapterRequest,
  ): Promise<AdapterResult<WarehouseStagingStatus[]>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/staging', warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<WarehouseStagingStatus[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const mapped: WarehouseStagingStatus[] = raw.map((item: any) => {
        const requiredQuantity = nullableNumber(item.requiredQuantity) ?? 0
        const stagedQuantity = nullableNumber(item.stagedQuantity) ?? 0
        const missingQuantity = nullableNumber(item.openQuantity) ?? Math.max(0, requiredQuantity - stagedQuantity)

        let status: 'pending' | 'in-progress' | 'staged' | 'partial' | 'blocked' | 'not-required' = 'pending'
        if (item.exceptionReason) {
          status = 'blocked'
        } else {
          const statusStr = String(item.stagingStatus || '').toLowerCase()
          if (statusStr === 'staged') {
            status = 'staged'
          } else if (statusStr === 'blocked') {
            status = 'blocked'
          } else if (statusStr === 'not-required') {
            status = 'not-required'
          } else if (stagedQuantity >= requiredQuantity && requiredQuantity > 0) {
            status = 'staged'
          } else if (stagedQuantity > 0) {
            status = 'partial'
          } else if (statusStr === 'open') {
            status = 'in-progress'
          }
        }

        return {
          processOrderId: String(item.processOrderId ?? ''),
          materialId: String(item.materialId ?? ''),
          materialDescription: String(item.materialDescription ?? ''),
          batchId: String(item.batchId ?? ''),
          requiredQuantity,
          stagedQuantity,
          missingQuantity,
          uom: String(item.unitOfMeasure ?? ''),
          transferRequirementId: item.reservationId ? String(item.reservationId) : undefined,
          stagingArea: String(item.storageLocation ?? ''),
          status,
          lastMovementAt: item.requirementDate ? new Date(item.requirementDate).toISOString() : undefined,
          blockerReason: item.exceptionReason ? String(item.exceptionReason) : undefined,
        }
      })

      return {
        ok: true,
        data: mapped,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<WarehouseStagingStatus[]>(e, 'databricks-api')
    }
  }

  async getMaterialShortagesForPlan(
    request: WarehouseStagingAdapterRequest,
  ): Promise<AdapterResult<MaterialShortage[]>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    try {
      const url = buildEndpointUrl(this.baseUrl, '/api/warehouse360/shortfalls', warehouseId, request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<MaterialShortage[]>(res, 'databricks-api')
      }

      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }

      const mapped: MaterialShortage[] = raw.map((item: any) => {
        const shortfallQty = nullableNumber(item.shortfallQty) ?? 0
        let severity: 'low' | 'medium' | 'high' | 'critical' = 'low'
        if (item.oldestTrDate) {
          const ageMs = new Date(this.now()).getTime() - new Date(item.oldestTrDate).getTime()
          const ageHours = ageMs / (1000 * 60 * 60)
          if (ageHours > 48) severity = 'critical'
          else if (ageHours > 24) severity = 'high'
          else if (ageHours > 12) severity = 'medium'
        }

        return {
          materialId: String(item.materialId ?? ''),
          materialDescription: String(item.materialId ?? ''),
          plantId: String(item.plantId ?? ''),
          requiredQuantity: shortfallQty,
          availableQuantity: 0,
          shortageQuantity: shortfallQty,
          uom: 'KG',
          requiredBy: item.oldestTrDate ? new Date(item.oldestTrDate).toISOString() : this.now(),
          affectedOrders: [],
          stagingStatus: shortfallQty > 0 ? 'partial' : 'staged',
          procurementStatus: 'unknown',
          severity,
        }
      })

      return {
        ok: true,
        data: mapped,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<MaterialShortage[]>(e, 'databricks-api')
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

export const warehouseStagingAdapter = new WarehouseStagingAdapter()

export function toStagingAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return {
    ok: false,
    error: { code: 'unknown', message, retryable: true },
    displayState: 'error',
    source: 'databricks-api',
  }
}
