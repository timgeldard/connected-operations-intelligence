import type {
  MonitoredSPCCharacteristic,
  SPCMonitoringContext,
  SPCSummary,
  SPCSignal,
  ControlChartSeries,
  CharacteristicCapability,
  SPCAlarmHistoryItem,
  SPCRelatedBatch,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import {
  mockMonitoredCharacteristics,
  mockSPCMonitoringContext,
  mockSPCSummary,
  mockActiveSPCSignals,
  mockControlChartSeries,
  mockMoistureChartSeries,
  mockFatChartSeries,
  mockSaltChartSeries,
  mockTextureChartSeries,
  mockCharacteristicCapability,
  mockSPCAlarmHistory,
  mockSPCRelatedBatches,
} from './spc-monitoring-mock-data.js'

export interface SPCMonitoringAdapterRequest {
  readonly materialId: string
  readonly plantId?: string
  readonly workCentreId?: string
  readonly operationId?: string
  readonly batchId?: string
  readonly characteristicId?: string
  readonly chartType?: string
  readonly dateFrom?: string
  readonly dateTo?: string
  readonly limit?: number
}

type NowFn = () => string

const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(code: AdapterError['code'], message: string, retryable = false): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface SPCMonitoringAdapterOptions {
  readonly now?: NowFn
}

export class SPCMonitoringAdapter {
  private readonly now: NowFn

  constructor(options: SPCMonitoringAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
  }

  async getSPCMonitoringContext(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCMonitoringContext>> {
    return ok(mockSPCMonitoringContext, this.now)
  }

  async getSPCSummary(_request: SPCMonitoringAdapterRequest): Promise<AdapterResult<SPCSummary>> {
    return ok(mockSPCSummary, this.now)
  }

  async getActiveSPCSignals(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCSignal[]>> {
    return ok(mockActiveSPCSignals, this.now)
  }

  async getMonitoredCharacteristics(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<MonitoredSPCCharacteristic[]>> {
    return ok(mockMonitoredCharacteristics, this.now)
  }

  async getControlChartSeries(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<ControlChartSeries>> {
    if (request.characteristicId === 'CHAR-MOISTURE-001')
      return ok(mockMoistureChartSeries, this.now)
    if (request.characteristicId === 'CHAR-FAT-001') return ok(mockFatChartSeries, this.now)
    if (request.characteristicId === 'CHAR-SALT-001') return ok(mockSaltChartSeries, this.now)
    if (request.characteristicId === 'CHAR-TEXTURE-001') return ok(mockTextureChartSeries, this.now)
    return ok(mockControlChartSeries, this.now)
  }

  async getCharacteristicCapability(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<CharacteristicCapability>> {
    return ok(mockCharacteristicCapability, this.now)
  }

  async getSPCAlarmHistory(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCAlarmHistoryItem[]>> {
    return ok(mockSPCAlarmHistory, this.now)
  }

  async getSPCRelatedBatches(
    _request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCRelatedBatch[]>> {
    return ok(mockSPCRelatedBatches, this.now)
  }
}

export const spcMonitoringAdapter = new SPCMonitoringAdapter()

export function toSPCMonitoringAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
