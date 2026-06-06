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
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockPlanRiskContext,
  mockPlanRiskSummary,
  mockLateOrders,
  mockMaterialShortages,
  mockLineStatus,
  mockScheduleAdherence,
  mockYieldVariance,
  mockShiftHandover,
  mockOperationsActionQueue,
} from './operations-plan-risk-mock-data.js'

export interface OperationsPlanRiskAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly shiftId?: string
  readonly lineIds?: readonly string[]
}

export type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface OperationsPlanRiskAdapterOptions {
  readonly now?: NowFn
}

export class OperationsPlanRiskAdapter {
  private readonly now: NowFn

  constructor(options: OperationsPlanRiskAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getOperationsPlanRiskContext(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<OperationsPlanRiskContext>> {
    return ok(mockPlanRiskContext, this.now)
  }

  async getPlanRiskSummary(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<PlanRiskSummary>> {
    return ok(mockPlanRiskSummary, this.now)
  }

  async getLateOrders(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<LateOrder[]>> {
    return ok(mockLateOrders, this.now)
  }

  async getMaterialShortages(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<MaterialShortage[]>> {
    return ok(mockMaterialShortages, this.now)
  }

  async getLineStatus(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<LineStatus[]>> {
    return ok(mockLineStatus, this.now)
  }

  async getScheduleAdherenceSummary(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<ScheduleAdherenceSummary>> {
    return ok(mockScheduleAdherence, this.now)
  }

  async getYieldVarianceSummary(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<YieldVarianceSummary[]>> {
    return ok(mockYieldVariance, this.now)
  }

  async getShiftHandoverItems(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<ShiftHandoverItem[]>> {
    return ok(mockShiftHandover, this.now)
  }

  async getOperationsActionQueue(
    _request: OperationsPlanRiskAdapterRequest
  ): Promise<AdapterResult<OperationsActionQueueItem[]>> {
    return ok(mockOperationsActionQueue, this.now)
  }
}

export const operationsPlanRiskAdapter = new OperationsPlanRiskAdapter()

export function toAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
