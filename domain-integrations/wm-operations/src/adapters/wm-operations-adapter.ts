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
  readonly demandDueTs: string | null
  readonly priorityScore: number | null
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
  readonly latestToConfirmedTs: string | null
  readonly cycleHours: number | null
  readonly ageHours: number | null
  readonly isOverdue: boolean | null
  readonly shortPickQty: number | null
  readonly shortPickItemCount: number | null
  readonly orderProductionLine: string | null
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
  readonly qtyUnrestricted: number | null
  readonly qualityHoldQty: number | null
  readonly openLotCount: number | null
  readonly qualityReleaseStatus: 'RELEASED' | 'PARTIAL_HOLD' | 'QUALITY_BLOCKED' | 'NO_QM_DATA' | null
  readonly readinessReason: string | null
  readonly productionLine: string | null
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
  readonly queue?: string
  readonly campaign?: string
  readonly reference?: string
  readonly startFromDaysAgo?: number
  readonly startToDaysAhead?: number
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
      queue: request.queue,
      campaign: request.campaign,
      reference: request.reference,
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
      start_from_days_ago: request.startFromDaysAgo,
      start_to_days_ahead: request.startToDaysAhead,
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

  async getOrderComponents(request: WmDrillRequest): Promise<AdapterResult<WmOrderComponentItem[]>> {
    const url = this.buildUrl('/api/wm-operations/order-components', {
      plant_id: request.plantId,
      order_id: request.orderId,
    })
    return this.fetchList<WmOrderComponentItem>(url)
  }

  async getOrderOperations(request: WmDrillRequest): Promise<AdapterResult<WmOrderOperationItem[]>> {
    const url = this.buildUrl('/api/wm-operations/order-operations', {
      plant_id: request.plantId,
      order_id: request.orderId,
    })
    return this.fetchList<WmOrderOperationItem>(url)
  }

  async getOperatorActivity(request: WmDrillRequest): Promise<AdapterResult<WmOperatorActivityItem[]>> {
    const url = this.buildUrl('/api/wm-operations/operator-activity', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
      days: request.days,
    })
    return this.fetchList<WmOperatorActivityItem>(url)
  }

  async getQueueWorkload(request: WmDrillRequest): Promise<AdapterResult<WmQueueWorkloadItem[]>> {
    const url = this.buildUrl('/api/wm-operations/queue-workload', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
    })
    return this.fetchList<WmQueueWorkloadItem>(url)
  }

  async getOutbound(request: WmDrillRequest): Promise<AdapterResult<WmOutboundItem[]>> {
    const url = this.buildUrl('/api/wm-operations/outbound', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
      include_shipped: request.includeShipped,
      limit: request.limit,
    })
    return this.fetchList<WmOutboundItem>(url)
  }

  async getReconAlerts(request: WmDrillRequest): Promise<AdapterResult<WmReconAlertItem[]>> {
    const url = this.buildUrl('/api/wm-operations/recon-alerts', {
      plant_id: request.plantId,
      warehouse_id: request.warehouseId,
      limit: request.limit,
    })
    return this.fetchList<WmReconAlertItem>(url)
  }

  /** Generic list fetch for the declarative second-wave datasets. */
  async getList<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined>,
  ): Promise<AdapterResult<T[]>> {
    return this.fetchList<T>(this.buildUrl(path, params))
  }

  async getBatchMovements(request: WmDrillRequest): Promise<AdapterResult<WmBatchMovementItem[]>> {
    const url = this.buildUrl('/api/wm-operations/batch-movements', {
      plant_id: request.plantId,
      material_id: request.materialId,
      batch_id: request.batchId,
      days: request.days,
      limit: request.limit,
    })
    return this.fetchList<WmBatchMovementItem>(url)
  }

  async getOrderJourney(request: WmDrillRequest): Promise<AdapterResult<WmOrderJourneySummaryItem[]>> {
    const url = this.buildUrl('/api/wm-operations/order-journey', {
      plant_id: request.plantId,
      limit: request.limit,
    })
    return this.fetchList<WmOrderJourneySummaryItem>(url)
  }

  async getOrderJourneyEvents(request: WmDrillRequest): Promise<AdapterResult<WmOrderJourneyEventItem[]>> {
    const url = this.buildUrl('/api/wm-operations/order-journey-events', {
      plant_id: request.plantId,
      order_id: request.orderId,
    })
    return this.fetchList<WmOrderJourneyEventItem>(url)
  }
}

export interface WmOrderComponentItem {
  readonly plantId: string
  readonly orderId: string
  readonly reservationId: string | null
  readonly reservationItem: string | null
  readonly operationNumber: string | null
  readonly warehouseId: string | null
  readonly materialId: string | null
  readonly materialName: string | null
  readonly batchId: string | null
  readonly requiredQty: number | null
  readonly openQty: number | null
  readonly uom: string | null
  readonly productionSupplyArea: string | null
  readonly requirementDate: string | null
  readonly materialComponentCount: number | null
  readonly trCount: number | null
  readonly trRequiredQty: number | null
  readonly trOpenQty: number | null
  readonly trCoverageStatus: 'NONE' | 'PARTIAL' | 'FULL' | null
  readonly toItemCount: number | null
  readonly toItemsConfirmed: number | null
  readonly toConfirmedQty: number | null
  readonly pickProgressFraction: number | null
  readonly psaSuppliedQty: number | null
  readonly isSupplied: boolean | null
}

export interface WmOperatorActivityItem {
  readonly plantId: string
  readonly warehouseId: string
  readonly operator: string
  readonly activityDate: string
  readonly itemsConfirmed: number | null
  readonly transferOrders: number | null
  readonly materials: number | null
  readonly transferRequirements: number | null
  readonly confirmedQty: number | null
}

export interface WmQueueWorkloadItem {
  readonly plantId: string
  readonly warehouseId: string
  readonly queue: string
  readonly workArea: WmWorkArea
  readonly openJobs: number | null
  readonly inProgressJobs: number | null
  readonly parkedJobs: number | null
  readonly noStockJobs: number | null
  readonly operatorCount: number | null
  readonly earliestPlannedTs: string | null
  readonly earliestCreatedTs: string | null
}

export interface WmOutboundItem {
  readonly plantId: string
  readonly warehouseId: string | null
  readonly deliveryId: string
  readonly deliveryType: string | null
  readonly shipToCustomerId: string | null
  readonly shipToCustomerName: string | null
  readonly lineCount: number | null
  readonly deliveryQty: number | null
  readonly pickedQty: number | null
  readonly pickFraction: number | null
  readonly hasMixedBaseUom: boolean | null
  readonly plannedGoodsIssueDate: string | null
  readonly actualGoodsIssueDate: string | null
  readonly isShipped: boolean | null
  readonly daysToGoodsIssue: number | null
  readonly riskBand: 'red' | 'amber' | 'green' | 'grey' | null
}

export interface WmReconAlertItem {
  readonly plantId: string
  readonly warehouseId: string | null
  readonly alertKey: string
  readonly alertType: string
  readonly alertPriority: string | null
  readonly materialId: string | null
  readonly batchId: string | null
  readonly reasonCode: string | null
  readonly deltaQty: number | null
  readonly deltaValue: number | null
}

export interface WmBatchMovementItem {
  readonly plantId: string
  readonly documentId: string | null
  readonly documentYear: string | null
  readonly documentItem: string | null
  readonly materialId: string | null
  readonly batchId: string | null
  readonly movementType: string | null
  readonly movementLabel: string | null
  readonly eventCategory: string | null
  readonly quantity: number | null
  readonly uom: string | null
  readonly postingDate: string | null
  readonly orderId: string | null
  readonly deliveryId: string | null
  readonly postedBy: string | null
}

export interface WmOrderOperationItem {
  readonly plantId: string
  readonly orderNumber: string
  readonly routingNumber: string | null
  readonly operationCounter: string | null
  readonly operationNumber: string | null
  readonly operationDescription: string | null
  readonly controlKey: string | null
  readonly workCentreCode: string | null
  readonly workCentreDescription: string | null
  readonly scheduledStartDatetime: string | null
  readonly scheduledFinishDatetime: string | null
  readonly actualStartDatetime: string | null
  readonly actualFinishDate: string | null
  readonly operationQty: number | null
  readonly confirmedYieldQty: number | null
  readonly confirmedScrapQty: number | null
  readonly isConfirmed: boolean | null
}

export interface WmDowntimePareto {
  readonly plantId: string
  readonly weekStart: string
  readonly downtimeReasonCode: string | null
  readonly subReasonCode: string | null
  readonly workCentreCode: string | null
  readonly downtimeReasonDescription: string | null
  readonly subReasonDescription: string | null
  readonly productionLineDescription: string | null
  readonly eventCount: number | null
  readonly totalDurationMinutes: number | null
  readonly avgDurationMinutes: number | null
  readonly distinctOrderCount: number | null
}

export interface WmDowntimeEvent {
  readonly plantId: string
  readonly workCentreCode: string | null
  readonly machineCode: string | null
  readonly machineDescription: string | null
  readonly productionLineDescription: string | null
  readonly orderNumber: string | null
  readonly materialCode: string | null
  readonly operationNumber: string | null
  readonly itemNumber: string | null
  readonly downtimeReasonCode: string | null
  readonly downtimeReasonDescription: string | null
  readonly subReasonCode: string | null
  readonly subReasonDescription: string | null
  readonly startDatetime: string | null
  readonly endDatetime: string | null
  readonly durationMinutes: number | null
  readonly reportedByUser: string | null
  readonly comment: string | null
}

export interface WmOrderJourneySummaryItem {
  readonly plantId: string
  readonly orderId: string
  readonly materialCode: string | null
  readonly materialName: string | null
  readonly orderQty: number | null
  readonly uom: string | null
  readonly productionLine: string | null
  readonly orderCreatedTs: string | null
  readonly releaseDate: string | null
  readonly scheduledStartDate: string | null
  readonly scheduledFinishDate: string | null
  readonly firstTrCreatedTs: string | null
  readonly stagingTrCount: number | null
  readonly stagingFirstConfirmedTs: string | null
  readonly stagingLastConfirmedTs: string | null
  readonly stagedItemCount: number | null
  readonly stagedItemTotal: number | null
  readonly productionFirstActualStart: string | null
  readonly productionLastActualFinish: string | null
  readonly confirmedYieldQty: number | null
  readonly confirmedScrapQty: number | null
  readonly piFirstStart: string | null
  readonly piLastEnd: string | null
  readonly firstGrPostingDate: string | null
  readonly lastGrPostingDate: string | null
  readonly grQty: number | null
  readonly issueQty: number | null
  readonly deliveryCount: number | null
  readonly qmLotCount: number | null
  readonly qmOpenLotCount: number | null
  readonly releaseToFirstTrHours: number | null
  readonly trToStagedHours: number | null
  readonly stagedToProductionHours: number | null
  readonly productionToGrHours: number | null
}

export interface WmOrderJourneyEventItem {
  readonly plantId: string
  readonly orderId: string
  readonly eventSeq: number | null
  readonly eventTs: string | null
  readonly eventType: string
  readonly qty: number | null
  readonly uom: string | null
  readonly referenceId: string | null
  readonly detail: string | null
}

export interface WmWipStageItem {
  readonly plantId: string
  readonly orderId: string
  readonly materialCode: string | null
  readonly materialName: string | null
  readonly orderQty: number | null
  readonly uom: string | null
  readonly scheduledStartDate: string | null
  readonly scheduledFinishDate: string | null
  readonly stage: string
  readonly firstTrCreatedTs: string | null
  readonly stagingLastConfirmedTs: string | null
  readonly productionFirstActualStart: string | null
  readonly firstGrPostingDate: string | null
  readonly grQty: number | null
}

export interface WmScheduleAdherenceDailyItem {
  readonly plantId: string
  readonly scheduledDate: string
  readonly plannedCount: number
  readonly completedCount: number
  readonly onTimeCount: number
  readonly maxActualDate: string | null
}

export type WmAdherenceRootCauseClass = 'LATE_RELEASE' | 'MATERIAL_SHORT' | 'CAPACITY' | 'UNCLASSIFIED'

export interface WmAdherenceRootCauseItem {
  readonly plantId: string
  readonly orderId: string
  readonly materialId: string | null
  readonly materialName: string | null
  readonly orderQty: number | null
  readonly uom: string | null
  readonly productionLine: string | null
  readonly scheduledStartDate: string | null
  readonly scheduledFinishDate: string | null
  readonly actualReleaseDate: string | null
  readonly actualFinishDate: string | null
  readonly rootCauseClass: WmAdherenceRootCauseClass
  readonly isLateRelease: boolean | null
  readonly hasMaterialShort: boolean | null
  readonly shortfallComponentCount: number | null
  readonly minVarianceQty: number | null
  readonly releaseToProductionHours: number | null
  readonly productionFirstActualStart: string | null
  readonly isFinishLate: boolean | null
  readonly isOpenLate: boolean | null
}

export interface WmOrderYieldItem {
  readonly plantId: string
  readonly orderId: string
  readonly materialId: string | null
  readonly materialName: string | null
  readonly productionLine: string | null
  readonly plannedQty: number | null
  readonly deliveredQty: number | null
  readonly uom: string | null
  readonly yieldPct: number | null
  readonly hasGoodsReceipt: boolean | null
  readonly isComplete: boolean | null
  readonly isReleased: boolean | null
  readonly isCompleted: boolean | null
  readonly isClosed: boolean | null
  readonly scheduledStartDate: string | null
  readonly scheduledFinishDate: string | null
  readonly actualFinishDate: string | null
  readonly firstGrDate: string | null
  readonly lastGrDate: string | null
}

export interface WmRecipeBenchmarkItem {
  readonly plantId: string
  readonly materialId: string
  readonly productionLine: string
  readonly runCount: number | null
  readonly medianYieldPct: number | null
  readonly p10YieldPct: number | null
  readonly p90YieldPct: number | null
  readonly medianDurationHours: number | null
  readonly p10DurationHours: number | null
  readonly p90DurationHours: number | null
  readonly lastRunFinishDate: string | null
}

export interface WmComponentVarianceItem {
  readonly plantId: string
  readonly orderId: string
  readonly materialId: string | null
  readonly materialName: string | null
  readonly uom: string | null
  readonly movementTypeCode: string | null
  readonly requiredQty: number | null
  readonly withdrawnQty: number | null
  readonly issuedQty: number | null
  readonly varianceQty: number | null
  readonly variancePct: number | null
  readonly estLossValue: number | null
  readonly standardPrice: number | null
  readonly isFinalIssue: boolean | null
}

export interface WmSupplyDemandLedgerItem {
  readonly plantId: string
  readonly materialId: string
  readonly materialName: string | null
  readonly eventType: string
  readonly eventSubtype: string
  readonly eventDate: string | null
  readonly quantity: number
  readonly signedQty: number
  readonly balanceBefore: number
  readonly runningBalance: number
  readonly sourceDocumentId: string
  readonly orderId: string | null
  readonly sortSeq: number
  readonly uom: string | null
}

export interface WmShortageProjectionItem {
  readonly plantId: string
  readonly orderId: string
  readonly materialId: string
  readonly materialName: string | null
  readonly openQty: number
  readonly uom: string | null
  readonly requirementDate: string | null
  readonly reservationRef: string
  readonly projectedBalanceAtDemand: number | null
  readonly isProjectedShort: boolean
  readonly firstShortDate: string | null
  readonly scheduledStartDate: string | null
  readonly scheduledFinishDate: string | null
  readonly productionLine: string | null
}

/** PI accuracy aggregate — plant × storage_location × ABC × currency × month grain. */
export interface WmPiAccuracyItem {
  readonly plantId: string
  readonly storageLocationId: string
  readonly abcIndicator: string
  readonly currency: string | null
  readonly countMonth: string | null
  readonly dueLines: number
  readonly countedLines: number
  readonly matchedLines: number
  readonly recountRequiredLines: number
  readonly linesWithDifference: number
  readonly countAccuracyPct: number | null
  readonly coveragePct: number | null
  readonly recountRatePct: number | null
  readonly totalAdjustmentValue: number | null
  readonly absAdjustmentValue: number | null
  readonly netAdjustmentQty: number | null
}

export interface WmDrillRequest {
  readonly plantId?: string
  readonly warehouseId?: string
  readonly orderId?: string
  readonly materialId?: string
  readonly batchId?: string
  readonly days?: number
  readonly includeShipped?: boolean
  readonly startFromDaysAgo?: number
  readonly startToDaysAhead?: number
  readonly queue?: string
  readonly limit?: number
}

export const wmOperationsAdapter = new WmOperationsAdapter()
