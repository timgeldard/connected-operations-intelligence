import type { AdapterResult, AdapterError } from '@connectio/source-adapters'

/** Work-area classification of a WM job (derived from storage-type zones in gold). */
export type WmWorkArea =
  | 'PRODUCTION_STAGING'
  | 'DISPENSARY_REPLENISHMENT'
  | 'DISPENSARY_PICKING'
  | 'WAREHOUSE_OTHER'

/** Operational job status from the site RF pick-status fields. */
export type WmWorklistStatus = 'OPEN' | 'IN_PROGRESS' | 'PARKED' | 'NO_STOCK' | 'COMPLETE'

export type WmStorageZone =
  | 'DISPENSARY'
  | 'PRODUCTION_SUPPLY'
  | 'PALLETISING'
  | 'INTERIM'
  | 'WAREHOUSE'

export interface WmWorklistItem {
  readonly plantId: string
  readonly warehouseId: string
  readonly trId: string
  readonly workArea: WmWorkArea
  readonly worklistStatus: WmWorklistStatus
  readonly referenceType: string | null
  readonly referenceId: string | null
  readonly orderMaterialId: string | null
  readonly orderScheduledStartDate: string | null
  readonly sourceStorageType: string | null
  readonly sourceZone: string | null
  readonly destinationStorageType: string | null
  readonly destinationZone: string | null
  readonly destinationBin: string | null
  readonly queue: string | null
  readonly campaignId: string | null
  readonly assignedOperator: string | null
  readonly jobSequence: string | null
  readonly transferPriority: string | null
  readonly createdTs: string | null
  readonly plannedExecutionTs: string | null
  readonly itemCount: number | null
  readonly openItemCount: number | null
  readonly materialCount: number | null
  readonly materialId: string | null
  readonly materialName: string | null
  readonly requiredQty: number | null
  readonly openQty: number | null
  readonly uom: string | null
  readonly hasMixedBaseUom: boolean | null
  readonly toItemCount: number | null
  readonly toItemsConfirmed: number | null
  readonly toConfirmedQty: number | null
  readonly pickProgressFraction: number | null
  readonly ageHours: number | null
  readonly isOverdue: boolean | null
}

export interface WmWorklistSummaryItem {
  readonly plantId: string
  readonly warehouseId: string
  readonly workArea: WmWorkArea
  readonly worklistStatus: WmWorklistStatus
  readonly trCount: number | null
  readonly totalOpenQty: number | null
  readonly totalRequiredQty: number | null
  readonly operatorCount: number | null
  readonly earliestPlannedTs: string | null
  readonly earliestCreatedTs: string | null
}

export interface WmOrderReadinessItem {
  readonly plantId: string
  readonly orderId: string
  readonly warehouseId: string | null
  readonly materialId: string | null
  readonly materialName: string | null
  readonly orderQty: number | null
  readonly uom: string | null
  readonly scheduledStartDate: string | null
  readonly scheduledFinishDate: string | null
  readonly productionSupplyArea: string | null
  readonly componentCount: number | null
  readonly wmComponentCount: number | null
  readonly wmComponentRequiredQty: number | null
  readonly componentOpenQty: number | null
  readonly trCount: number | null
  readonly trRequiredQty: number | null
  readonly trOpenQty: number | null
  readonly trCoverageStatus: 'NONE' | 'PARTIAL' | 'FULL'
  readonly psaSuppliedQty: number | null
  readonly supplyStatus: 'NOT_SUPPLIED' | 'PARTIAL' | 'SUPPLIED'
  readonly readinessStatus:
    | 'SUPPLIED'
    | 'STAGING_PLANNED'
    | 'PARTIALLY_PLANNED'
    | 'NOT_STARTED'
    | 'NO_WM_DEMAND'
  readonly daysToStart: number | null
  readonly readinessBand: 'red' | 'amber' | 'green' | 'grey' | null
}

export interface WmBinStockItem {
  readonly plantId: string
  readonly warehouseId: string
  readonly storageType: string | null
  readonly storageZone: WmStorageZone | null
  readonly binId: string | null
  readonly pickingArea: string | null
  readonly quantId: string
  readonly materialId: string | null
  readonly materialName: string | null
  readonly batchId: string | null
  readonly stockCategory: string | null
  readonly totalQty: number | null
  readonly availableQty: number | null
  readonly putawayQty: number | null
  readonly pickQty: number | null
  readonly openTransferQty: number | null
  readonly uom: string | null
  readonly goodsReceiptDate: string | null
  readonly expiryDate: string | null
  readonly isBlockedForStockRemoval: boolean | null
  readonly isBlockedForPutaway: boolean | null
  readonly isBinBlocked: boolean | null
  readonly blockingReasonCode: string | null
  readonly daysToExpiry: number | null
  readonly isExpired: boolean | null
}

export interface WmOperationsAdapterRequest {
  readonly plantId?: string
  readonly warehouseId?: string
  readonly workArea?: WmWorkArea
  readonly status?: WmWorklistStatus
  readonly includeComplete?: boolean
  readonly storageZone?: WmStorageZone
  readonly storageType?: string
  readonly materialId?: string
  readonly binId?: string
  readonly expiringWithinDays?: number
  readonly limit?: number
}

type NowFn = () => string
const defaultNow: NowFn = () => new Date().toISOString()

export interface WmOperationsAdapterOptions {
  readonly baseUrl?: string
  readonly now?: NowFn
}

function errorFromStatus(status: number): AdapterError {
  if (status === 401) {
    return { code: 'unauthorized', message: 'Sign-in required for Databricks access', retryable: false }
  }
  if (status === 403) {
    return { code: 'unauthorized', message: 'No plant entitlement for this data', retryable: false }
  }
  if (status === 404) {
    return { code: 'not-found', message: 'Endpoint not found', retryable: false }
  }
  if (status === 504) {
    return { code: 'timeout', message: 'Databricks query timed out', retryable: true }
  }
  return { code: 'network', message: `Request failed (HTTP ${status})`, retryable: status >= 500 }
}

export class WmOperationsAdapter {
  private readonly baseUrl: string
  private readonly now: NowFn

  constructor(options: WmOperationsAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? (import.meta.env?.VITE_API_BASE_URL as string) ?? '').replace(/\/$/, '')
    this.now = options.now ?? defaultNow
  }

  private buildUrl(path: string, params: Record<string, string | number | boolean | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') search.set(key, String(value))
    }
    const query = search.toString()
    const pathWithQuery = query ? `${path}?${query}` : path
    return this.baseUrl ? `${this.baseUrl}${pathWithQuery}` : pathWithQuery
  }

  private async fetchList<T>(url: string): Promise<AdapterResult<T[]>> {
    let response: Response
    try {
      response = await fetch(url, { method: 'GET', credentials: 'include' })
    } catch {
      return {
        ok: false,
        error: { code: 'network', message: 'Network request failed', retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        error: errorFromStatus(response.status),
        displayState: 'error',
        source: 'databricks-api',
      }
    }
    try {
      const data = (await response.json()) as T[]
      return { ok: true, data, fetchedAt: this.now(), source: 'databricks-api' }
    } catch {
      return {
        ok: false,
        error: { code: 'invalid-data', message: 'Response was not valid JSON', retryable: false },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }

  async getWorklist(request: WmOperationsAdapterRequest): Promise<AdapterResult<WmWorklistItem[]>> {
    const url = this.buildUrl('/api/wm-operations/worklist', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
      work_area: request.workArea,
      status: request.status,
      include_complete: request.includeComplete,
      limit: request.limit,
    })
    return this.fetchList<WmWorklistItem>(url)
  }

  async getWorklistSummary(
    request: WmOperationsAdapterRequest
  ): Promise<AdapterResult<WmWorklistSummaryItem[]>> {
    const url = this.buildUrl('/api/wm-operations/worklist-summary', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
    })
    return this.fetchList<WmWorklistSummaryItem>(url)
  }

  async getOrderReadiness(
    request: WmOperationsAdapterRequest
  ): Promise<AdapterResult<WmOrderReadinessItem[]>> {
    const url = this.buildUrl('/api/wm-operations/order-readiness', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
      limit: request.limit,
    })
    return this.fetchList<WmOrderReadinessItem>(url)
  }

  async getBinStock(request: WmOperationsAdapterRequest): Promise<AdapterResult<WmBinStockItem[]>> {
    const url = this.buildUrl('/api/wm-operations/bin-stock', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
      storage_zone: request.storageZone,
      storage_type: request.storageType,
      material_id: request.materialId,
      bin_id: request.binId,
      expiring_within_days: request.expiringWithinDays,
      limit: request.limit,
    })
    return this.fetchList<WmBinStockItem>(url)
  }
}

export const wmOperationsAdapter = new WmOperationsAdapter()
