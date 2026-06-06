import { useQuery } from '@tanstack/react-query'
import type {
  OperationsPlanRiskContext,
  PlanRiskSummary,
  LateOrder,
  MaterialShortage,
  LineStatus,
  ScheduleAdherenceSummary,
  YieldVarianceSummary,
  ShiftHandoverItem,
  OperationsActionQueueItem,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import {
  operationsPlanRiskAdapter,
  toAdapterError,
} from './operations-plan-risk-adapter.js'
import type { OperationsPlanRiskAdapterRequest } from './operations-plan-risk-adapter.js'

const STALE_TIME_MS = 5 * 60 * 1000

export function useOperationsPlanRiskContext(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<OperationsPlanRiskContext>>({
    queryKey: ['operations-plan-risk', 'context', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getOperationsPlanRiskContext(request)
      } catch (e) {
        return toAdapterError<OperationsPlanRiskContext>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function usePlanRiskSummary(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<PlanRiskSummary>>({
    queryKey: ['operations-plan-risk', 'summary', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getPlanRiskSummary(request)
      } catch (e) {
        return toAdapterError<PlanRiskSummary>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useLateOrders(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<LateOrder[]>>({
    queryKey: ['operations-plan-risk', 'late-orders', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getLateOrders(request)
      } catch (e) {
        return toAdapterError<LateOrder[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useMaterialShortages(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<MaterialShortage[]>>({
    queryKey: ['operations-plan-risk', 'material-shortages', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getMaterialShortages(request)
      } catch (e) {
        return toAdapterError<MaterialShortage[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useLineStatus(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<LineStatus[]>>({
    queryKey: ['operations-plan-risk', 'line-status', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getLineStatus(request)
      } catch (e) {
        return toAdapterError<LineStatus[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useScheduleAdherenceSummary(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<ScheduleAdherenceSummary>>({
    queryKey: ['operations-plan-risk', 'schedule-adherence', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getScheduleAdherenceSummary(request)
      } catch (e) {
        return toAdapterError<ScheduleAdherenceSummary>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useYieldVarianceSummary(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<YieldVarianceSummary[]>>({
    queryKey: ['operations-plan-risk', 'yield-variance', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getYieldVarianceSummary(request)
      } catch (e) {
        return toAdapterError<YieldVarianceSummary[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useShiftHandoverItems(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<ShiftHandoverItem[]>>({
    queryKey: ['operations-plan-risk', 'shift-handover', request.plantId ?? null, request.planDate ?? null, request.shiftId ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getShiftHandoverItems(request)
      } catch (e) {
        return toAdapterError<ShiftHandoverItem[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}

export function useOperationsActionQueue(request: OperationsPlanRiskAdapterRequest) {
  return useQuery<AdapterResult<OperationsActionQueueItem[]>>({
    queryKey: ['operations-plan-risk', 'action-queue', request.plantId ?? null, request.planDate ?? null],
    queryFn: async () => {
      try {
        return await operationsPlanRiskAdapter.getOperationsActionQueue(request)
      } catch (e) {
        return toAdapterError<OperationsActionQueueItem[]>(e)
      }
    },
    staleTime: STALE_TIME_MS,
  })
}
