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
import type { AdapterResult, AdapterSource } from '@connectio/source-adapters'

export interface ProductionStagingAdapterRequest {
  readonly plantId?: string
  readonly warehouseId?: string
  readonly planDate?: string
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

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
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<ProductionStagingContext>> {
    const readiness = await this.getStagingReadinessSummary(request)
    if (!readiness.ok) {
      return {
        ok: false,
        error: readiness.error,
        displayState: readiness.displayState,
        source: 'databricks-api',
      }
    }
    const r = readiness.data
    const context: ProductionStagingContext = {
      plantId: request.plantId ?? '',
      warehouseId: r.warehouseId,
      // No warehouse-name source is replicated — documented data gap.
      warehouseName: undefined,
      planDate: r.planDate,
      totalOrders: r.totalOrders,
      stagedOrders: r.fullyStaged,
      partialOrders: r.partiallyStaged,
      blockedOrders: r.blocked,
      openShortfalls: r.openShortfalls,
      openMoveRequests: r.openMoveRequests,
      overallReadinessPercent: r.percentReady,
      riskStatus: r.riskStatus,
      lastUpdatedAt: this.now(),
    }
    return { ok: true, data: context, fetchedAt: this.now(), source: 'databricks-api' }
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

      // Category C open-items endpoints (PR 6) supply the live pick-task / move-request counts.
      let pendingPickTasks = 0
      let openMoveRequests = 0
      try {
        const [pickRes, moveRes] = await Promise.all([
          fetch(this.openItemsUrl('/api/warehouse360/pick-tasks', request), { method: 'GET', credentials: 'include' }),
          fetch(this.openItemsUrl('/api/warehouse360/move-requests', request), { method: 'GET', credentials: 'include' }),
        ])
        if (pickRes.ok) {
          const pickData = await pickRes.json()
          if (Array.isArray(pickData)) pendingPickTasks = pickData.length
        }
        if (moveRes.ok) {
          const moveData = await moveRes.json()
          if (Array.isArray(moveData)) openMoveRequests = moveData.length
        }
      } catch {
        // Counts stay 0 if the open-items endpoints are unavailable; the summary itself still renders.
      }

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
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingOrderSummary[]>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    try {
      const params = new URLSearchParams()
      params.set('warehouse_id', warehouseId)
      if (request.plantId) params.set('plant_id', request.plantId)
      const path = `/api/warehouse360/staging?${params.toString()}`
      const url = this.baseUrl ? `${this.baseUrl}${path}` : path
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<StagingOrderSummary[]>(res, 'databricks-api')
      }
      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }
      const orders: StagingOrderSummary[] = raw.map((item: any) => {
        const requiredQuantity = Number(item.requiredQuantity ?? 0)
        const stagedQuantity = Number(item.stagedQuantity ?? 0)
        const statusStr = String(item.stagingStatus ?? '').toLowerCase()
        const status: StagingOrderSummary['status'] =
          statusStr === 'staged' ? 'staged'
          : statusStr === 'blocked' ? 'blocked'
          : statusStr === 'not-required' ? 'not-required'
          : stagedQuantity > 0 ? 'partial'
          : 'not-staged'
        const urgency: StagingOrderSummary['urgency'] =
          status === 'blocked' ? 'critical'
          : status === 'not-staged' ? 'high'
          : status === 'partial' ? 'medium'
          : 'low'
        return {
          processOrderId: String(item.processOrderId ?? ''),
          materialId: String(item.materialId ?? ''),
          materialDescription: item.materialDescription ?? undefined,
          batchId: undefined,
          plantId: request.plantId ?? '',
          lineOrResource: undefined,
          plannedStart: item.requirementDate ?? undefined,
          requiredQuantity,
          stagedQuantity,
          shortfallQuantity: Math.max(0, Number(item.openQuantity ?? requiredQuantity - stagedQuantity)),
          uom: item.unitOfMeasure ?? undefined,
          stagingArea: undefined,
          status,
          urgency,
          pickTaskIds: undefined,
          blockerReason: item.exceptionReason ?? undefined,
        }
      })
      return { ok: true, data: orders, fetchedAt: this.now(), source: 'databricks-api' }
    } catch (e) {
      return this.handleCatchError<StagingOrderSummary[]>(e, 'databricks-api')
    }
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
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingZoneCapacity[]>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    try {
      const params = new URLSearchParams()
      params.set('warehouse_id', warehouseId)
      if (request.plantId) params.set('plant_id', request.plantId)
      const path = `/api/warehouse360/stock-zones?${params.toString()}`
      const url = this.baseUrl ? `${this.baseUrl}${path}` : path
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<StagingZoneCapacity[]>(res, 'databricks-api')
      }
      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }
      // Aggregate bin_type rows up to storage-type grain (zone = storage type).
      const byType = new Map<string, { total: number; occupied: number; empty: number; blocked: number }>()
      for (const row of raw as any[]) {
        const key = String(row.storageType ?? '')
        const agg = byType.get(key) ?? { total: 0, occupied: 0, empty: 0, blocked: 0 }
        agg.total += Number(row.binRecordCount ?? 0)
        agg.occupied += Number(row.occupiedBinCount ?? 0)
        agg.empty += Number(row.emptyBinCount ?? 0)
        agg.blocked += Number(row.blockedBinCount ?? 0)
        byType.set(key, agg)
      }
      const zones: StagingZoneCapacity[] = [...byType.entries()].map(([storageType, agg]) => {
        const capacityPercent = agg.total > 0 ? Math.min(100, (agg.occupied / agg.total) * 100) : 0
        const status: StagingZoneCapacity['status'] =
          agg.blocked > 0 && agg.blocked >= agg.total ? 'blocked'
          : capacityPercent >= 98 ? 'full'
          : capacityPercent >= 85 ? 'high-utilisation'
          : 'available'
        return {
          zoneId: storageType,
          zoneName: storageType,
          warehouseId,
          capacityPercent,
          occupiedBins: agg.occupied,
          emptyBins: agg.empty,
          blockedBins: agg.blocked,
          status,
          overflowRisk: capacityPercent >= 90,
        }
      })
      return { ok: true, data: zones, fetchedAt: this.now(), source: 'databricks-api' }
    } catch (e) {
      return this.handleCatchError<StagingZoneCapacity[]>(e, 'databricks-api')
    }
  }

  async getStagingShortfalls(
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingShortfall[]>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    try {
      const params = new URLSearchParams()
      params.set('warehouse_id', warehouseId)
      if (request.plantId) params.set('plant_id', request.plantId)
      const path = `/api/warehouse360/shortfalls?${params.toString()}`
      const url = this.baseUrl ? `${this.baseUrl}${path}` : path
      const res = await fetch(url, { method: 'GET', credentials: 'include' })
      if (!res.ok) {
        return this.handleHttpError<StagingShortfall[]>(res, 'databricks-api')
      }
      const raw = await res.json()
      if (!Array.isArray(raw)) {
        throw new Error('Response was not an array')
      }
      const shortfalls: StagingShortfall[] = (raw as any[]).map((r) => ({
        shortfallId: `${r.plantId ?? ''}-${r.materialId ?? ''}`,
        materialId: String(r.materialId ?? ''),
        materialDescription: undefined,
        plantId: String(r.plantId ?? ''),
        warehouseId: undefined,
        requiredQuantity: Number(r.shortfallQty ?? 0),
        availableQuantity: undefined,
        shortfallQuantity: Number(r.shortfallQty ?? 0),
        uom: undefined,
        affectedOrders: undefined,
        urgency: this.trAgeUrgency(r.oldestTrDate),
        procurementStatus: 'unknown',
        expectedArrival: undefined,
        canBeSubstituted: undefined,
      }))
      return { ok: true, data: shortfalls, fetchedAt: this.now(), source: 'databricks-api' }
    } catch (e) {
      return this.handleCatchError<StagingShortfall[]>(e, 'databricks-api')
    }
  }

  // TR-age urgency heuristic shared with the Warehouse360 replenishment mapping.
  private trAgeUrgency(oldestTrDate: unknown): 'low' | 'medium' | 'high' | 'critical' {
    if (!oldestTrDate) return 'low'
    const ageMs = new Date(this.now()).getTime() - new Date(String(oldestTrDate)).getTime()
    const ageHours = ageMs / (1000 * 60 * 60)
    if (ageHours > 48) return 'critical'
    if (ageHours > 24) return 'high'
    if (ageHours > 8) return 'medium'
    return 'low'
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
    request: ProductionStagingAdapterRequest,
  ): Promise<AdapterResult<StagingAlert[]>> {
    const warehouseId = request.warehouseId ?? 'WH01'
    // Synthesized in the adapter from other live governed datasets (plan section 4):
    // shortfalls -> 'shortfall' alerts, blocked staging orders -> 'blocked-order' alerts.
    const [shortfalls, orders] = await Promise.all([
      this.getStagingShortfalls(request),
      this.getStagingOrderSummaries(request),
    ])
    if (!shortfalls.ok) {
      return {
        ok: false,
        error: shortfalls.error,
        displayState: shortfalls.displayState,
        source: 'databricks-api',
      }
    }
    if (!orders.ok) {
      return {
        ok: false,
        error: orders.error,
        displayState: orders.displayState,
        source: 'databricks-api',
      }
    }
    const alerts: StagingAlert[] = []
    for (const sf of shortfalls.data) {
      alerts.push({
        alertId: `shortfall-${sf.shortfallId}`,
        warehouseId,
        alertType: 'shortfall',
        severity: sf.urgency,
        materialId: sf.materialId,
        description: `Open transfer-requirement shortfall of ${sf.shortfallQuantity} for ${sf.materialId}`,
        recommendedAction: 'Review open transfer requirements and replenish the material',
        raisedAt: this.now(),
        status: 'open',
      })
    }
    for (const order of orders.data) {
      if (order.status === 'blocked') {
        alerts.push({
          alertId: `blocked-order-${order.processOrderId}`,
          warehouseId,
          alertType: 'blocked-order',
          severity: 'critical',
          processOrderId: order.processOrderId,
          materialId: order.materialId,
          description: `Staging blocked for process order ${order.processOrderId}`,
          recommendedAction: 'Investigate the staging blocker for this order',
          raisedAt: order.plannedStart ?? this.now(),
          status: 'open',
        })
      }
    }
    return { ok: true, data: alerts, fetchedAt: this.now(), source: 'databricks-api' }
  }
}

export const productionStagingAdapter = new ProductionStagingAdapter()

export function toProductionStagingAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return {
    ok: false,
    error: { code: 'unknown', message, retryable: true },
    displayState: 'error',
    source: 'databricks-api',
  }
}
