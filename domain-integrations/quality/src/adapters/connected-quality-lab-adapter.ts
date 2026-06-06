import type {
  ConnectedQualityLabFailuresResponse,
  ConnectedQualityLabPlantsResponse,
} from '@connectio/data-contracts'
import type { AdapterResult, AdapterError } from '@connectio/source-adapters'
import { mockLabFailures, mockLabPlants } from './connected-quality-lab-mock-data.js'

export interface ConnectedQualityLabAdapterRequest {
  readonly plantId?: string
  readonly lotType?: string
}

export type NowFn = () => string
const defaultNow: NowFn = () => new Date().toISOString()

function ok<T>(data: T, now: NowFn = defaultNow): AdapterResult<T> {
  return { ok: true, data, fetchedAt: now(), source: 'mock' }
}

function err<T>(
  code: AdapterError['code'],
  message: string,
  retryable = false,
): AdapterResult<T> {
  return { ok: false, error: { code, message, retryable }, displayState: 'error', source: 'mock' }
}

export interface ConnectedQualityLabAdapterOptions {
  readonly now?: NowFn
  readonly simulatedDelayMs?: number
}

export class ConnectedQualityLabAdapter {
  private readonly now: NowFn
  private readonly simulatedDelayMs: number

  constructor(options: ConnectedQualityLabAdapterOptions = {}) {
    this.now = options.now ?? defaultNow
    this.simulatedDelayMs = options.simulatedDelayMs ?? 0
  }

  private async delay(): Promise<void> {
    if (this.simulatedDelayMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, this.simulatedDelayMs))
    }
  }

  async getLabFailures(
    request: ConnectedQualityLabAdapterRequest,
  ): Promise<AdapterResult<ConnectedQualityLabFailuresResponse>> {
    await this.delay()
    const fails = request.lotType
      ? mockLabFailures.filter((f) => f.lotType === request.lotType)
      : mockLabFailures
    return ok(
      {
        fails,
        dataAvailable: true,
        plantId: request.plantId,
        lotType: request.lotType,
      },
      this.now,
    )
  }

  async getLabPlants(): Promise<AdapterResult<ConnectedQualityLabPlantsResponse>> {
    await this.delay()
    return ok({ plants: mockLabPlants }, this.now)
  }
}

export function toConnectedQualityLabAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return err<T>('unknown', message, true)
}
