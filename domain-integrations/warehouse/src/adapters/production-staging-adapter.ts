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
  mockStagingReadiness,
  mockStagingOrders,
  mockPickTasks,
  mockZoneCapacity,
  mockShortfalls,
  mockMoveRequests,
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

  async getStagingPickTasks(
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingPickTask[]>> {
    return ok(mockPickTasks, this.now)
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
    _request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingMoveRequest[]>> {
    return ok(mockMoveRequests, this.now)
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
