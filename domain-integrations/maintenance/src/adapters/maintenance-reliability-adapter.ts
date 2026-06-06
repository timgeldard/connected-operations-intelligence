import type {
  MaintenanceReliabilityContext,
  MaintenanceKpiSummary,
  WorkOrder,
  PreventiveMaintenanceTask,
  EquipmentAvailability,
  ReliabilityMetric,
  MaintenanceBacklogItem,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockMaintenanceReliabilityContext,
  mockMaintenanceKpiSummary,
  mockWorkOrders,
  mockPreventiveMaintenanceTasks,
  mockEquipmentAvailability,
  mockReliabilityMetrics,
  mockMaintenanceBacklog,
} from './maintenance-reliability-mock-data.js'

export interface MaintenanceReliabilityAdapterRequest {
  readonly plantId?: string
  readonly lineId?: string
  readonly equipmentId?: string
}

type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now() }
}

function err<T>(
  code: AdapterError['code'],
  message: string,
  retryable = false
): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error' }
}

export interface MaintenanceReliabilityAdapterOptions {
  readonly now?: NowFn
}

export class MaintenanceReliabilityAdapter {
  private readonly now: NowFn

  constructor(options: MaintenanceReliabilityAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getMaintenanceReliabilityContext(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<MaintenanceReliabilityContext>> {
    return ok(mockMaintenanceReliabilityContext, this.now)
  }

  async getMaintenanceKpiSummary(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<MaintenanceKpiSummary>> {
    return ok(mockMaintenanceKpiSummary, this.now)
  }

  async getWorkOrders(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<WorkOrder[]>> {
    return ok(mockWorkOrders, this.now)
  }

  async getPreventiveMaintenanceTasks(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<PreventiveMaintenanceTask[]>> {
    return ok(mockPreventiveMaintenanceTasks, this.now)
  }

  async getEquipmentAvailability(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<EquipmentAvailability[]>> {
    return ok(mockEquipmentAvailability, this.now)
  }

  async getReliabilityMetrics(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<ReliabilityMetric[]>> {
    return ok(mockReliabilityMetrics, this.now)
  }

  async getMaintenanceBacklog(
    _request: MaintenanceReliabilityAdapterRequest
  ): Promise<AdapterResult<MaintenanceBacklogItem[]>> {
    return ok(mockMaintenanceBacklog, this.now)
  }
}

export const maintenanceReliabilityAdapter = new MaintenanceReliabilityAdapter()

export function toMaintenanceReliabilityAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
