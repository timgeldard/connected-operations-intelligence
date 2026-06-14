import { useQuery } from '@tanstack/react-query'
import { wmOperationsAdapter } from './wm-operations-adapter.js'
import type { WmDrillRequest, WmOperationsAdapterRequest, WmWipStageItem, WmScheduleAdherenceDailyItem, WmAdherenceRootCauseItem, WmOrderYieldItem, WmRecipeBenchmarkItem, WmComponentVarianceItem, WmSupplyDemandLedgerItem, WmShortageProjectionItem, WmPiAccuracyItem, WmLinesideRequest, WmPlanBoardRequest, WmPlanBoardBlock, WmPlanBoardKpis, WmPlanBoardBacklogItem, WmPlanBoardWmOverlayItem, WmPushDespatchDeliveryItem, WmPushDespatchDailyItem } from './wm-operations-adapter.js'

export function useWmOrderComponents(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-components', request.plantId ?? null, request.orderId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderComponents(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmOrderOperations(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-operations', request.plantId ?? null, request.orderId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderOperations(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmOperatorActivity(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-operator-activity', request.plantId ?? null, request.warehouseId ?? null, request.days ?? 14, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOperatorActivity(request),
    staleTime: 60 * 1000,
  })
}

export function useWmQueueWorkload(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-queue-workload', request.plantId ?? null, request.warehouseId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getQueueWorkload(request),
    staleTime: 60 * 1000,
  })
}

export function useWmOutbound(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-outbound', request.plantId ?? null, request.warehouseId ?? null, request.includeShipped ?? false, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOutbound(request),
    staleTime: 60 * 1000,
  })
}

export function useWmReconAlerts(request: WmDrillRequest) {
  return useQuery({
    queryKey: ['wm-ops-recon-alerts', request.plantId ?? null, request.warehouseId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getReconAlerts(request),
    staleTime: 60 * 1000,
  })
}

/** Generic hook for the declarative second-wave list endpoints. */
export function useWmList<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  enabled = true,
) {
  return useQuery({
    queryKey: ['wm-ops-list', path, JSON.stringify(params)],
    queryFn: () => wmOperationsAdapter.getList<T>(path, params),
    staleTime: 60 * 1000,
    enabled,
  })
}

export function useWmBatchMovements(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-batch-movements', request.plantId ?? null, request.materialId ?? null, request.batchId ?? null, request.days ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getBatchMovements(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.materialId),
  })
}

const STALE = 60 * 1000 // worklists move fast — 1-minute stale time (PER_USER_60S server cache)

export function useWmWorklist(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: [
      'wm-ops-worklist',
      request.plantId ?? null,
      request.warehouseId ?? null,
      request.workArea ?? null,
      request.status ?? null,
      request.queue ?? null,
      request.campaign ?? null,
      request.reference ?? null,
      request.includeComplete ?? false,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getWorklist(request),
    staleTime: STALE,
  })
}

export function useWmWorklistSummary(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: ['wm-ops-worklist-summary', request.plantId ?? null, request.warehouseId ?? null],
    queryFn: () => wmOperationsAdapter.getWorklistSummary(request),
    staleTime: STALE,
  })
}

export function useWmOrderReadiness(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: ['wm-ops-order-readiness', request.plantId ?? null, request.warehouseId ?? null, request.startFromDaysAgo ?? null, request.startToDaysAhead ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderReadiness(request),
    staleTime: STALE,
  })
}

export function useWmOrderJourney(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-journey', request.plantId ?? null, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getOrderJourney(request),
    staleTime: 60 * 1000,
    enabled,
  })
}

export function useWmOrderJourneyEvents(request: WmDrillRequest, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-journey-events', request.plantId ?? null, request.orderId ?? null],
    queryFn: () => wmOperationsAdapter.getOrderJourneyEvents(request),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(request.plantId && request.orderId),
  })
}

export function useWmWipStages(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-wip-stages', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmWipStageItem>(
      '/api/wm-operations/wip-stages',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmScheduleAdherenceDaily(plantId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-schedule-adherence-daily', plantId ?? null],
    queryFn: () => wmOperationsAdapter.getList<WmScheduleAdherenceDailyItem>(
      '/api/wm-operations/schedule-adherence-daily',
      { plant_id: plantId ?? undefined, limit: 200 },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmAdherenceRootCause(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-adherence-root-cause', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmAdherenceRootCauseItem>(
      '/api/wm-operations/adherence-root-cause',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmOrderYield(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-order-yield', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmOrderYieldItem>(
      '/api/wm-operations/order-yield',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmRecipeBenchmark(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-recipe-benchmark', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmRecipeBenchmarkItem>(
      '/api/wm-operations/recipe-benchmark',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmComponentVariance(
  plantId: string | null | undefined,
  orderId?: string,
  limit = 500,
  enabled = true,
) {
  return useQuery({
    queryKey: ['wm-ops-component-variance', plantId ?? null, orderId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmComponentVarianceItem>(
      '/api/wm-operations/component-variance',
      { plant_id: plantId ?? undefined, order_id: orderId, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmShortageProjection(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-shortage-projection', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmShortageProjectionItem>(
      '/api/wm-operations/shortage-projection',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmSupplyDemandLedger(plantId: string | null | undefined, limit = 1000, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-supply-demand-ledger', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmSupplyDemandLedgerItem>(
      '/api/wm-operations/supply-demand-ledger',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmPiAccuracy(
  plantId: string | null | undefined,
  days?: number,
  limit = 500,
  enabled = true,
) {
  return useQuery({
    queryKey: ['wm-ops-pi-accuracy', plantId ?? null, days ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmPiAccuracyItem>(
      '/api/wm-operations/pi-accuracy',
      { plant_id: plantId ?? undefined, days, limit },
    ),
    staleTime: 60 * 1000,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmBinStock(request: WmOperationsAdapterRequest) {
  return useQuery({
    queryKey: [
      'wm-ops-bin-stock',
      request.plantId ?? null,
      request.warehouseId ?? null,
      request.storageZone ?? null,
      request.storageType ?? null,
      request.materialId ?? null,
      request.binId ?? null,
      request.expiringWithinDays ?? null,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getBinStock(request),
    staleTime: STALE,
  })
}

// ── Lineside Monitor (PEX-E-35) ──────────────────────────────────────────────
// NOTE: live value of these hooks depends on the ADR-017 pilot cadence decision
// (15-min triggered silver+gold, ideally sub-cadence for fast-silver tables that
// carry operation confirmations / TR-TO).  Until that cadence is live the data
// is refreshed at the standard daily gold cadence; the UI displays a STALE banner
// when last_refresh_ts is > 2× the configured refreshInterval.

export function useWmLinesideNow(request: WmLinesideRequest, refreshInterval?: number, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-lineside-now', request.plantId, request.lineId, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getLinesideNow(request),
    staleTime: refreshInterval ?? 60 * 1000,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId && request.lineId),
  })
}

export function useWmLinesideNext(request: WmLinesideRequest, refreshInterval?: number, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-lineside-next', request.plantId, request.lineId, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getLinesideNext(request),
    staleTime: refreshInterval ?? 60 * 1000,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId && request.lineId),
  })
}

export function useWmLinesideBlocked(request: WmLinesideRequest, refreshInterval?: number, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-lineside-blocked', request.plantId, request.lineId, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getLinesideBlocked(request),
    staleTime: refreshInterval ?? 60 * 1000,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId && request.lineId),
  })
}

export function useWmLinesideStaging(request: WmLinesideRequest, refreshInterval?: number, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-lineside-staging', request.plantId, request.lineId, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getLinesideStaging(request),
    staleTime: refreshInterval ?? 60 * 1000,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId && request.lineId),
  })
}

export function useWmLinesidePlanActual(request: WmLinesideRequest, refreshInterval?: number, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-lineside-plan-actual', request.plantId, request.lineId, request.limit ?? null],
    queryFn: () => wmOperationsAdapter.getLinesidePlanActual(request),
    staleTime: refreshInterval ?? 60 * 1000,
    refetchInterval: refreshInterval,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId && request.lineId),
  })
}

export function useWmLinesideLines(plantId?: string, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-lineside-lines', plantId ?? null],
    queryFn: () => wmOperationsAdapter.getLinesideLines(plantId),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}

// ── Production Planning Board (PEX-E-36) ──────────────────────────────────
// READ-ONLY hooks — no schedule/mutate/POST. Date window drives refetch.
// Query-cadence policy: load once, serve cache across page/panel navigation, and
// re-query only on a configurable interval — NOT on every page change. Tune here.
const PLAN_BOARD_REFRESH_MS = 5 * 60 * 1000

export function useWmPlanBoard(request: WmPlanBoardRequest, enabled = true) {
  return useQuery({
    queryKey: [
      'wm-ops-plan-board',
      request.plantId,
      request.lineId ?? null,
      request.fromDate ?? null,
      request.toDate ?? null,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getPlanBoard(request),
    staleTime: PLAN_BOARD_REFRESH_MS,
    refetchInterval: PLAN_BOARD_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId),
  })
}

export function useWmPlanBoardKpis(request: WmPlanBoardRequest, enabled = true) {
  return useQuery({
    queryKey: [
      'wm-ops-plan-board-kpis',
      request.plantId,
      request.lineId ?? null,
      request.fromDate ?? null,
      request.toDate ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getPlanBoardKpis(request),
    staleTime: PLAN_BOARD_REFRESH_MS,
    refetchInterval: PLAN_BOARD_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId),
  })
}

export function useWmPlanBoardBacklog(request: WmPlanBoardRequest, enabled = true) {
  return useQuery({
    queryKey: [
      'wm-ops-plan-board-backlog',
      request.plantId,
      request.lineId ?? null,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getPlanBoardBacklog(request),
    staleTime: PLAN_BOARD_REFRESH_MS,
    refetchInterval: PLAN_BOARD_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId),
  })
}

export function useWmPlanBoardWmOverlay(request: WmPlanBoardRequest, enabled = true) {
  return useQuery({
    queryKey: [
      'wm-ops-plan-board-wm-overlay',
      request.plantId,
      request.lineId ?? null,
      request.fromDate ?? null,
      request.toDate ?? null,
      request.limit ?? null,
    ],
    queryFn: () => wmOperationsAdapter.getPlanBoardWmOverlay(request),
    staleTime: PLAN_BOARD_REFRESH_MS,
    refetchInterval: PLAN_BOARD_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(request.plantId),
  })
}

// Re-export plan board types for consumers of this module.
export type { WmPlanBoardBlock, WmPlanBoardKpis, WmPlanBoardBacklogItem, WmPlanBoardWmOverlayItem }

// ── Push Despatch (Spec 14 — WMA-E-23) ───────────────────────────────────────
// Wall-display query cadence: load once, serve from cache, auto-refresh on interval.
// Data scope in UAT bronze <= 2023-12-05 (UAT snapshot artefact; prod data is current).
const PUSH_DESPATCH_REFRESH_MS = 5 * 60 * 1000

export function useWmPushDespatchDelivery(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-push-despatch-delivery', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmPushDespatchDeliveryItem>(
      '/api/wm-operations/push-despatch-delivery',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: PUSH_DESPATCH_REFRESH_MS,
    refetchInterval: PUSH_DESPATCH_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(plantId),
  })
}

export function useWmPushDespatchDaily(plantId: string | null | undefined, limit = 500, enabled = true) {
  return useQuery({
    queryKey: ['wm-ops-push-despatch-daily', plantId ?? null, limit],
    queryFn: () => wmOperationsAdapter.getList<WmPushDespatchDailyItem>(
      '/api/wm-operations/push-despatch-daily',
      { plant_id: plantId ?? undefined, limit },
    ),
    staleTime: PUSH_DESPATCH_REFRESH_MS,
    refetchInterval: PUSH_DESPATCH_REFRESH_MS,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(plantId),
  })
}

// Re-export push despatch types for consumers of this module.
export type { WmPushDespatchDeliveryItem, WmPushDespatchDailyItem }
