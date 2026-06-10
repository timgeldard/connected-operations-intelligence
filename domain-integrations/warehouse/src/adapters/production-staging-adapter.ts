import type {
  ProductionStagingContext,
  StagingReadinessSummary,
  StagingOrderSummary,
  StagingPickTask,
  StagingZoneCapacity,
  StagingShortfall,
  StagingMoveRequest,
  StagingPickingWave,
  StagingAlert,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError, AdapterSource } from '@connectio/source-adapters'
import {
  mockProductionStagingContext,
  mockStagingOrders,
  mockZoneCapacity,
  mockShortfalls,
  mockStagingAlerts,
} from './production-staging-mock-data.js'

export interface ProductionStagingAdapterRequest {
  readonly plantId?: string
  readonly warehouseId?: string
  readonly planDate?: string
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface ProductionStagingAdapterOptions {
  readonly baseUrl?: string
  readonly now?: NowFn
}

export class ProductionStagingAdapter {
  private readonly baseUrl: string
  private readonly now: NowFn

  constructor(options: ProductionStagingAdapterOptions = {}) {
    this.baseUrl = (options.baseUrl ?? (import.meta.env?.VITE_WH360_API_BASE_URL as string) ?? '').replace(/\/$/, '')
    this.now = options.now ?? defaultNow
  }

  async getProductionStagingContext(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<ProductionStagingContext>> {
    return ok(mockProductionStagingContext, this.now)
  }

  async getStagingReadinessSummary(
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingReadinessSummary>> {
    const plantId = request.plantId ?? 'PL10'
    const warehouseId = request.warehouseId ?? 'WH01'
    const planDate = request.planDate ?? new Date().toISOString().split('T')[0]

    try {
      const params = new URLSearchParams()
      params.set('plant_id', plantId)
      params.set('plan_date', planDate)
      const readinessUrl = this.baseUrl
        ? `${this.baseUrl}/api/warehouse360/staging-readiness?${params.toString()}`
        : `/api/warehouse360/staging-readiness?${params.toString()}`

      const shortfallParams = new URLSearchParams()
      shortfallParams.set('warehouse_id', warehouseId)
      if (request.plantId) {
        shortfallParams.set('plant_id', plantId)
      }
      const shortfallsUrl = this.baseUrl
        ? `${this.baseUrl}/api/warehouse360/shortfalls?${shortfallParams.toString()}`
        : `/api/warehouse360/shortfalls?${shortfallParams.toString()}`

      const [readinessRes, shortfallsRes] = await Promise.all([
        fetch(readinessUrl, { method: 'GET', credentials: 'include' }),
        fetch(shortfallsUrl, { method: 'GET', credentials: 'include' }),
      ])

      if (!readinessRes.ok) {
        return this.handleHttpError<StagingReadinessSummary>(readinessRes, 'databricks-api')
      }
      if (!shortfallsRes.ok) {
        return this.handleHttpError<StagingReadinessSummary>(shortfallsRes, 'databricks-api')
      }

      const readinessData = await readinessRes.json()
      const shortfallsData = await shortfallsRes.json()

      const openShortfalls = Array.isArray(shortfallsData) ? shortfallsData.length : 0

      const totalOrders = Number(readinessData.totalOrders ?? 0)
      const fullyStaged = Number(readinessData.fullyStaged ?? 0)
      const percentReady = totalOrders > 0 ? (fullyStaged / totalOrders) * 100 : 0.0

      // pendingPickTasks and openMoveRequests are 0 until Category C tables built in PR 6
      const pendingPickTasks = 0
      const openMoveRequests = 0

      // riskStatus heuristic
      let riskStatus: 'ready' | 'at-risk' | 'blocked' | 'unknown' = 'ready'
      if (Number(readinessData.blocked ?? 0) > 0) {
        riskStatus = 'blocked'
      } else if (openShortfalls > 0 || percentReady < 100.0) {
        riskStatus = 'at-risk'
      }

      const summary: StagingReadinessSummary = {
        planDate: String(readinessData.planDate ?? planDate),
        warehouseId,
        totalOrders,
        fullyStaged,
        partiallyStaged: Number(readinessData.partiallyStaged ?? 0),
        notStaged: Number(readinessData.notStaged ?? 0),
        blocked: Number(readinessData.blocked ?? 0),
        percentReady,
        openShortfalls,
        pendingPickTasks,
        openMoveRequests,
        riskStatus,
        confidence: 1.0,
      }

      return {
        ok: true,
        data: summary,
        fetchedAt: this.now(),
        source: 'databricks-api',
      }
    } catch (e) {
      return this.handleCatchError<StagingReadinessSummary>(e, 'databricks-api')
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

  async getStagingOrderSummaries(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingOrderSummary[]>> {
    return ok(mockStagingOrders, this.now)
  }


  private openItemsUrl(path: string, request: ProductionStagingAdapterRequest): string {
    const params = new URLSearchParams()
    if (request.plantId) params.set('plant_id', request.plantId)
    if (request.warehouseId) params.set('warehouse_id', request.warehouseId)
    const withQuery = `${path}?${params.toString()}`
    return this.baseUrl ? `${this.baseUrl}${withQuery}` : withQuery
  }

  // SAP transfer priority is 1 (highest) .. 9; map to the app severity scale (heuristic).
  private static mapPriority(transferPriority: unknown): 'low' | 'medium' | 'high' | 'critical' {
    const p = Number(transferPriority)
    if (!Number.isFinite(p) || p <= 0) return 'medium'
    if (p <= 1) return 'critical'
    if (p <= 3) return 'high'
    if (p <= 6) return 'medium'
    return 'low'
  }

  async getStagingPickTasks(
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingPickTask[]>> {
    try {
      const url = this.openItemsUrl('/api/warehouse360/pick-tasks', request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<StagingPickTask[]>(res, 'databricks-api')
      }
      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }
      const tasks: StagingPickTask[] = raw.map((r: any) => ({
        taskId: `${r.taskId ?? ''}/${r.itemNumber ?? ''}`,
        // BENUM carries the process order only for BETYP='F' references.
        processOrderId: r.orderReferenceType === 'F' ? (r.orderReferenceNumber ?? undefined) : undefined,
        materialId: String(r.materialId ?? ''),
        materialDescription: undefined,
        warehouseId: String(r.warehouseNumber ?? ''),
        storageLocation: [r.sourceStorageType, r.sourceStorageBin].filter(Boolean).join('/') || '',
        destinationLocation: [r.destinationStorageType, r.destinationStorageBin].filter(Boolean).join('/') || '',
        requiredQuantity: Number(r.requestedQuantity ?? 0),
        pickedQuantity: Number(r.confirmedQuantity ?? 0),
        uom: undefined,
        assignee: r.assignee ?? undefined,
        status: r.itemStatus === 'Partially Confirmed' ? 'in-progress' : 'open',
        priority: ProductionStagingAdapter.mapPriority(r.transferPriority),
        createdAt: r.createdDatetime ?? undefined,
        completedAt: undefined,
        batchId: r.batchId ?? undefined,
      }))
      return { ok: true, data: tasks, fetchedAt: this.now(), source: 'databricks-api' }
    } catch (e) {
      return this.handleCatchError<StagingPickTask[]>(e, 'databricks-api')
    }
  }

  async getStagingZoneCapacity(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingZoneCapacity[]>> {
    return ok(mockZoneCapacity, this.now)
  }

  async getStagingShortfalls(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingShortfall[]>> {
    return ok(mockShortfalls, this.now)
  }

  async getStagingMoveRequests(
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingMoveRequest[]>> {
    try {
      const url = this.openItemsUrl('/api/warehouse360/move-requests', request)
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<StagingMoveRequest[]>(res, 'databricks-api')
      }
      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }
      const requests: StagingMoveRequest[] = raw.map((r: any) => ({
        requestId: `${r.requestId ?? ''}/${r.itemNumber ?? ''}`,
        warehouseId: String(r.warehouseNumber ?? ''),
        fromLocation: [r.sourceStorageType, r.sourceStorageBin].filter(Boolean).join('/') || '',
        toLocation: [r.destinationStorageType, r.destinationStorageBin].filter(Boolean).join('/') || '',
        materialId: String(r.materialId ?? ''),
        materialDescription: undefined,
        quantity: Number(r.openQuantity ?? r.requiredQuantity ?? 0),
        uom: undefined,
        processOrderId: r.orderReferenceType === 'F' ? (r.orderReferenceNumber ?? undefined) : undefined,
        // LTBK carries no requester/assignee — documented data gaps.
        requestedBy: undefined,
        assignedTo: undefined,
        status: 'open',
        priority: ProductionStagingAdapter.mapPriority(r.transferPriority),
        createdAt: r.createdDatetime ?? undefined,
        completedAt: undefined,
        // The WM queue is the closest source-truthful "reason" classifier.
        reason: r.queue ?? undefined,
      }))
      return { ok: true, data: requests, fetchedAt: this.now(), source: 'databricks-api' }
    } catch (e) {
      return this.handleCatchError<StagingMoveRequest[]>(e, 'databricks-api')
    }
  }

  async getStagingPickingWaves(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingPickingWave[]>> {
    return {
      ok: true,
      data: [],
      fetchedAt: this.now(),
      source: 'databricks-api',
      gap: {
        source: 'LTAK / REFNR wave groupings (missing from SAP replication)',
        tracking: 'SAP-WAVE-01',
      },
    }
  }

  async getStagingAlerts(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingAlert[]>> {
    return ok(mockStagingAlerts, this.now)
  }
}

export const productionStagingAdapter = new ProductionStagingAdapter()

export function toProductionStagingAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
