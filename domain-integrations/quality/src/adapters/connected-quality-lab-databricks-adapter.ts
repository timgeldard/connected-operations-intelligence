/**
 * Connected Quality Lab Board — governed Databricks API adapter.
 *
 * Replaces the V1 mock adapter and legacy-api adapter. Sources from the governed
 * gold_qm_lab_result_signal table via the vw_consumption_quality_lab_fails consumption
 * view (apps/api/routes/quality_lab.py → GET /api/cq/lab/fails).
 *
 * Source label: 'SAP QM via governed gold' — replaces 'Mock SAP QM lab failures' and
 * 'SAP QM via legacy API'.
 *
 * No mock mode, no legacy-api fallback. If the endpoint is unavailable the adapter
 * returns an AdapterResult error. This is the production-ready path.
 */
import type {
  ConnectedQualityLabFailure,
  ConnectedQualityLabFailuresResponse,
} from '@connectio/data-contracts'
import type { AdapterResult } from '@connectio/source-adapters'

/** Allowed values for the UI day filter (absent = ALL). */
export type LabBoardDays = 30 | 180 | 360

/** Request parameters for the Lab Board fails query. */
export interface ConnectedQualityLabAdapterRequest {
  readonly plantId?: string
  readonly lotType?: string
  /** Rolling window on result recording date. Absent = ALL. */
  readonly days?: LabBoardDays
}

export class ConnectedQualityLabDatabricksAdapter {
  private readonly baseUrl: string

  /**
   * @param baseUrl - API base URL. Empty string = same origin (Databricks Apps deployment).
   */
  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  async getLabFailures(
    request: ConnectedQualityLabAdapterRequest,
  ): Promise<AdapterResult<ConnectedQualityLabFailuresResponse>> {
    const params = new URLSearchParams()
    if (request.plantId) params.set('plant_id', request.plantId)
    if (request.lotType) params.set('lot_type', request.lotType)
    if (request.days != null) params.set('days', String(request.days))

    const qs = params.toString()
    const url = `${this.baseUrl}/api/cq/lab/fails${qs ? `?${qs}` : ''}`

    try {
      const response = await fetch(url, { credentials: 'include' })

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
            message: `Quality Lab API returned ${response.status}`,
            retryable: response.status >= 500,
          },
          displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
          source: 'databricks-api',
        }
      }

      const raw = await response.json()
      const fails: ConnectedQualityLabFailure[] = raw.fails ?? raw.data ?? []

      return {
        ok: true,
        data: {
          fails,
          dataAvailable: raw.dataAvailable ?? raw.data_available ?? true,
          reason: raw.reason,
          plantId: raw.plantId ?? raw.plant_id ?? request.plantId,
          lotType: raw.lotType ?? raw.lot_type ?? request.lotType,
        },
        fetchedAt: new Date().toISOString(),
        source: 'databricks-api',
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return {
        ok: false,
        error: { code: 'unknown', message, retryable: true },
        displayState: 'error',
        source: 'databricks-api',
      }
    }
  }
}

export function toConnectedQualityLabAdapterError<T>(thrown: unknown): AdapterResult<T> {
  const message = thrown instanceof Error ? thrown.message : 'Unknown error'
  return {
    ok: false,
    error: { code: 'unknown', message, retryable: true },
    displayState: 'error',
    source: 'databricks-api',
  }
}

/** Singleton adapter instance (same-origin base URL for Databricks Apps deployment). */
export const connectedQualityLabAdapterInstance = new ConnectedQualityLabDatabricksAdapter(
  import.meta.env.VITE_API_BASE_URL ?? '',
)
