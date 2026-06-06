import { SPCMonitoringAdapter } from './spc-monitoring-adapter.js'
import type { AdapterResult } from '@connectio/source-adapters'
import type {
  SPCMonitoringContext,
  SPCSummary,
  SPCSignal,
  MonitoredSPCCharacteristic,
  ControlChartSeries,
  CharacteristicCapability,
  SPCAlarmHistoryItem,
  SPCRelatedBatch,
} from '@connectio/data-contracts'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

// ---------------------------------------------------------------------------
// V1 response types (snake_case from V1 SPC FastAPI backend)
// ---------------------------------------------------------------------------

interface V1Characteristic {
  mic_id: string
  mic_name: string
  plant_id?: string
  material_id?: string
  operation_id?: string
  chart_type?: string
  batch_count?: number
  sample_count?: number
  has_active_signal?: boolean
  [key: string]: unknown
}

interface V1ChartDataPoint {
  sample_id?: string
  batch_id?: string
  sample_timestamp?: string
  result_value?: number
  subgroup_mean?: number
  subgroup_range?: number
  subgroup_sd?: number
  unit_of_measure?: string
  usl_spec?: number
  lsl_spec?: number
  [key: string]: unknown
}

interface V1ChartDataResponse {
  mic_id?: string
  mic_name?: string
  chart_type?: string
  material_id?: string
  plant_id?: string
  data?: V1ChartDataPoint[]
  [key: string]: unknown
}


interface V1CapabilityResponse {
  mic_id?: string
  mic_name?: string
  cp?: number
  cpk?: number
  pp?: number
  ppk?: number
  sample_count?: number
  process_mean?: number
  process_std_dev?: number
  confidence?: number
  interpretation?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// V1 → V2 enum rename (chart type)
// ---------------------------------------------------------------------------

/** Maps V1 chart_type identifiers to V2 ChartTypeSchema values. */
function mapChartType(v1Type: string | undefined): ControlChartSeries['chartType'] {
  switch (v1Type) {
    case 'imr': return 'individuals'
    case 'xbar_r': return 'xbar-r'
    case 'xbar_s': return 'xbar-s'
    case 'p_chart': return 'p-chart'
    case 'np_chart': return 'np-chart'
    case 'c_chart': return 'c-chart'
    case 'u_chart': return 'u-chart'
    default: return 'individuals'
  }
}

function mapInterpretation(val: string | undefined): CharacteristicCapability['interpretation'] {
  switch (val?.toLowerCase()) {
    case 'capable': return 'capable'
    case 'marginal': return 'marginal'
    case 'not-capable':
    case 'not_capable': return 'not-capable'
    case 'insufficient-data':
    case 'insufficient_data': return 'insufficient-data'
    default: return 'insufficient-data'
  }
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function proxyGet<T>(baseUrl: string, path: string, params: Record<string, string>): Promise<AdapterResult<T>> {
  let href: string
  if (baseUrl) {
    const url = new URL(`${baseUrl}${path}`)
    for (const [key, val] of Object.entries(params)) {
      if (val) url.searchParams.set(key, val)
    }
    href = url.toString()
  } else {
    const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)))
    href = qs.toString() ? `${path}?${qs}` : path
  }
  try {
    const response = await fetch(href, { method: 'GET', credentials: 'include' })
    if (!response.ok) {
      return {
        ok: false,
        error: {
          code: response.status === 401 ? 'unauthorized' : 'network',
          message: `HTTP ${response.status}`,
          retryable: response.status >= 500,
        },
        displayState: response.status === 401 ? 'unauthorized' : 'error',
        source: 'legacy-api',
      }
    }
    const data = await response.json()
    return { ok: true, data: data as T, fetchedAt: new Date().toISOString(), source: 'legacy-api' }
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'network',
        message: err instanceof Error ? err.message : String(err),
        retryable: true,
      },
      displayState: 'error',
      source: 'legacy-api',
    }
  }
}

async function proxyPost(baseUrl: string, path: string, body: object): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw { status: response.status }
  return response.json()
}

function toErrorResult<T>(err: unknown, source: 'legacy-api' = 'legacy-api'): AdapterResult<T> {
  const status = (err as { status?: number })?.status
  const code =
    status === 401 ? ('unauthorized' as const)
      : status === 404 ? ('not-found' as const)
        : ('network' as const)
  return {
    ok: false,
    error: { code, message: `Proxy returned ${status ?? 'unknown'}`, retryable: (status ?? 0) >= 500 },
    displayState: code === 'unauthorized' ? 'unauthorized' : 'error',
    source,
  }
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * SPC Monitoring Legacy API Adapter.
 *
 * @remarks
 * Proxies to the V1 SPC FastAPI backend via V2's FastAPI proxy gateway.
 *
 * **Verification state (per AGENTS.md trim principle):**
 * - getMonitoredCharacteristics — wired, NOT YET browser-verified
 * - getControlChartSeries — wired, NOT YET browser-verified
 * - getCharacteristicCapability — wired, NOT YET browser-verified
 * - All other methods — fall through to mock adapter (no V1 equivalent)
 *
 * Methods fall through to the base mock adapter when:
 *   (a) materialId is absent in the request, or
 *   (b) the corresponding V1 endpoint has no live equivalent in V2 proxy.
 *
 * Do NOT mark any method as "browser-verified" until end-to-end testing
 * against a live V1 SPC UAT deployment is complete.
 */
export class SPCMonitoringLegacyApiAdapter extends SPCMonitoringAdapter {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    super()
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Returns monitored characteristics (MICs) for the given material.
   *
   * Maps V1 GET /api/spc/characteristics → V2 MonitoredSPCCharacteristic[].
   * Wired but NOT YET browser-verified against live V1 UAT.
   */
  override async getMonitoredCharacteristics(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<MonitoredSPCCharacteristic[]>> {
    if (!request.materialId) return super.getMonitoredCharacteristics(request)
    try {
      const params: Record<string, string> = { material_id: request.materialId }
      if (request.plantId) params['plant_id'] = request.plantId

      const result = await proxyGet<V1Characteristic[]>(this.baseUrl, '/api/spc/characteristics', params)
      if (!result.ok) {
        return result
      }
      const raw = result.data
      const items: MonitoredSPCCharacteristic[] = (Array.isArray(raw) ? raw : []).map((c) => ({
        characteristicId: c.mic_id,
        characteristicName: c.mic_name,
        micId: c.mic_id,
        chartType: mapChartType(c.chart_type),
        batchCount: typeof c.batch_count === 'number' ? c.batch_count : 0,
        avgSamplesPerBatch: typeof c.sample_count === 'number' && typeof c.batch_count === 'number' && c.batch_count > 0
          ? c.sample_count / c.batch_count
          : undefined,
        hasActiveSignal: c.has_active_signal ?? false,
        operationId: typeof c.operation_id === 'string' ? c.operation_id : undefined,
        chartTypeSource: 'heuristic',
      }))

      return {
        ok: true,
        data: items,
        fetchedAt: result.fetchedAt,
        source: 'legacy-api',
      }
    } catch (err) {
      return toErrorResult(err)
    }
  }

  /**
   * Returns control chart series data for a material/MIC combination.
   *
   * Maps V1 POST /api/spc/chart-data → V2 ControlChartSeries.
   * Control limits are NOT computed here — they are computed client-side by
   * the V2 panel following V1's calculations.runtime.ts strategy.
   * Wired but NOT YET browser-verified against live V1 UAT.
   */
  override async getControlChartSeries(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<ControlChartSeries>> {
    if (!request.materialId || !request.characteristicId || !request.operationId || !request.plantId) {
      return super.getControlChartSeries(request)
    }

    try {
      const today = new Date().toISOString().slice(0, 10)
      const twoYearsAgo = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      const body: Record<string, string> = {
        materialId: request.materialId,
        micId: request.characteristicId,
        plantId: request.plantId,
        operationId: request.operationId,
        dateFrom: request.dateFrom ?? twoYearsAgo,
        dateTo: request.dateTo ?? today,
      }

      const raw = await proxyPost(this.baseUrl, '/api/spc/chart-data', body) as V1ChartDataResponse
      const chartType = mapChartType(raw.chart_type)

      const points = (Array.isArray(raw.data) ? raw.data : []).map((p, idx) => ({
        pointId: p.sample_id ?? `pt-${idx}`,
        timestamp: p.sample_timestamp ?? new Date().toISOString(),
        value: chartType === 'individuals'
          ? (p.result_value ?? p.subgroup_mean ?? 0)
          : (p.subgroup_mean ?? p.result_value ?? 0),
        batchId: p.batch_id ?? '',
        sampleId: p.sample_id ?? `s-${idx}`,
        status: 'in-control' as const,
        signalIds: [],
      }))

      // Spec limits from first data point (V1 includes these on each row)
      const firstPoint = Array.isArray(raw.data) && raw.data.length > 0 ? raw.data[0] : undefined

      const series: ControlChartSeries = {
        chartId: `${request.materialId}-${request.characteristicId}`,
        chartType,
        characteristicId: raw.mic_id ?? request.characteristicId,
        characteristicName: raw.mic_name ?? request.characteristicId,
        points,
        // Limits are null here — client-side computation will fill them in
        // following V1's calculations.runtime.ts approach
        centerLine: null as unknown as number,
        upperControlLimit: null as unknown as number,
        lowerControlLimit: null as unknown as number,
        upperSpecLimit: firstPoint?.usl_spec ?? undefined,
        lowerSpecLimit: firstPoint?.lsl_spec ?? undefined,
        unitOfMeasure: firstPoint?.unit_of_measure ?? '',
        limitProvenance: 'calculated-from-sample',
        approvalState: 'not-approved',
        confidence: 1.0,
      }

      return {
        ok: true,
        data: series,
        fetchedAt: new Date().toISOString(),
        source: 'legacy-api',
      }
    } catch (err) {
      return toErrorResult(err)
    }
  }

  /**
   * Returns capability indices (Cp/Cpk/Pp/Ppk) for a material/MIC.
   *
   * Maps V1 GET /api/spc/capability → V2 CharacteristicCapability.
   * Wired but NOT YET browser-verified against live V1 UAT.
   */
  override async getCharacteristicCapability(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<CharacteristicCapability>> {
    if (!request.materialId || !request.characteristicId) {
      return super.getCharacteristicCapability(request)
    }

    try {
      const params: Record<string, string> = { 
        material_id: request.materialId,
        characteristic_id: request.characteristicId,
      }
      if (request.plantId) params['plant_id'] = request.plantId

      const result = await proxyGet<V1CapabilityResponse>(this.baseUrl, '/api/spc/capability', params)
      if (!result.ok) {
        return result
      }
      const raw = result.data

      const data: CharacteristicCapability = {
        characteristicId: raw.mic_id ?? request.characteristicId,
        characteristicName: raw.mic_name ?? request.characteristicId,
        cp: typeof raw.cp === 'number' ? raw.cp : 0,
        cpk: typeof raw.cpk === 'number' ? raw.cpk : 0,
        pp: typeof raw.pp === 'number' ? raw.pp : 0,
        ppk: typeof raw.ppk === 'number' ? raw.ppk : 0,
        sampleCount: typeof raw.sample_count === 'number' ? raw.sample_count : 0,
        mean: typeof raw.process_mean === 'number' ? raw.process_mean : 0,
        standardDeviation: typeof raw.process_std_dev === 'number' ? raw.process_std_dev : 0,
        confidence: typeof raw.confidence === 'number' ? raw.confidence : 1.0,
        interpretation: mapInterpretation(raw.interpretation),
        limitProvenance: 'calculated-from-sample',
      }

      return {
        ok: true,
        data,
        fetchedAt: new Date().toISOString(),
        source: 'legacy-api',
      }
    } catch (err) {
      return toErrorResult(err)
    }
  }

  // The following methods fall through to the mock adapter as there is no
  // direct V1 equivalent suitable for proxying at this stage.
  // See spc-v1-source-discovery.md §6.6 (AlarmHistoryItem) and §6.8 (SPCSummary)
  // for gap analysis.

  override async getSPCMonitoringContext(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCMonitoringContext>> {
    return super.getSPCMonitoringContext(request)
  }

  override async getSPCSummary(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCSummary>> {
    return super.getSPCSummary(request)
  }

  override async getActiveSPCSignals(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCSignal[]>> {
    return super.getActiveSPCSignals(request)
  }

  override async getSPCAlarmHistory(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCAlarmHistoryItem[]>> {
    return super.getSPCAlarmHistory(request)
  }

  override async getSPCRelatedBatches(
    request: SPCMonitoringAdapterRequest,
  ): Promise<AdapterResult<SPCRelatedBatch[]>> {
    return super.getSPCRelatedBatches(request)
  }
}
