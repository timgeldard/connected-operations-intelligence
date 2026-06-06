import type {
  ConnectedQualityLabFailure,
  ConnectedQualityLabFailuresResponse,
  ConnectedQualityLabPlantsResponse,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'
import { ConnectedQualityLabAdapter } from './connected-quality-lab-adapter.js'
import type { ConnectedQualityLabAdapterRequest } from './connected-quality-lab-adapter.js'

/**
 * Tier: legacy-api — wired to V1 CQ backend at /api/cq/lab/fails and /api/cq/lab/plants.
 * Not yet browser-verified.
 */
export class ConnectedQualityLabLegacyApiAdapter extends ConnectedQualityLabAdapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  override async getLabFailures(
    request: ConnectedQualityLabAdapterRequest,
  ): Promise<AdapterResult<ConnectedQualityLabFailuresResponse>> {
    if (!request.plantId) {
      return super.getLabFailures(request)
    }

    const params = new URLSearchParams()
    if (request.plantId) params.set('plant_id', request.plantId)
    if (request.lotType) params.set('lot_type', request.lotType)

    try {
      const response = await fetch(`${this.baseUrl}/api/cq/lab/fails?${params}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = await response.json()
      const fails: ConnectedQualityLabFailure[] = raw.fails ?? raw.data ?? []

      return {
        ok: true,
        data: {
          fails,
          dataAvailable: raw.data_available ?? raw.dataAvailable ?? true,
          reason: raw.reason,
          plantId: raw.plant_id ?? raw.plantId ?? request.plantId,
          lotType: raw.lot_type ?? raw.lotType ?? request.lotType,
        },
        fetchedAt: new Date().toISOString(),
        source: 'legacy-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }

  override async getLabPlants(): Promise<AdapterResult<ConnectedQualityLabPlantsResponse>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/cq/lab/plants`, {
        credentials: 'include',
      })

      if (!response.ok) {
        const code =
          response.status === 401
            ? ('unauthorized' as const)
            : response.status === 404
              ? ('not-found' as const)
              : ('network' as const)
        return {
          ok: false,
          error: {
            code,
            message: `Proxy returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'legacy-api',
        }
      }

      const raw = await response.json()
      const plants = (raw.plants ?? raw.data ?? []).map(
        (p: {
          plant_id?: string
          plant_name?: string
          plantId?: string
          plantName?: string
        }) => ({
          plantId: p.plant_id ?? p.plantId ?? '',
          plantName: p.plant_name ?? p.plantName ?? '',
        }),
      )

      return {
        ok: true,
        data: { plants },
        fetchedAt: new Date().toISOString(),
        source: 'legacy-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'legacy-api',
      }
    }
  }
}
