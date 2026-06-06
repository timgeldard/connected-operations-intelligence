import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest'
import { SPCMonitoringDatabricksApiAdapter } from './spc-monitoring-databricks-api-adapter.js'
import { SPCMonitoringLegacyApiAdapter } from './spc-monitoring-legacy-api-adapter.js'
import type { SPCMonitoringAdapterRequest } from './spc-monitoring-adapter.js'

const request: SPCMonitoringAdapterRequest = {
  materialId: 'MAT-12345',
  plantId: 'C113',
  characteristicId: 'CHAR-1',
}

describe('SPC Placeholder Adapters', () => {
  describe('SPCMonitoringDatabricksApiAdapter', () => {
    const adapter = new SPCMonitoringDatabricksApiAdapter()

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))
    })

    afterAll(() => {
      vi.unstubAllGlobals()
    })

    it('returns error for getSPCSummary', async () => {
      const result = await adapter.getSPCSummary(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.error.code).toBe('not-found')
        expect(result.error.message).toContain('Databricks adapter unavailable')
      }
    })

    it('returns unavailable for getSPCMonitoringContext', async () => {
      const result = await adapter.getSPCMonitoringContext(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.error.code).toBe('not-found')
      }
    })

    it('returns unavailable for getActiveSPCSignals', async () => {
      const result = await adapter.getActiveSPCSignals(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.error.code).toBe('not-found')
      }
    })

    it('returns error for getMonitoredCharacteristics on network failure', async () => {
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        // getMonitoredCharacteristics is now wired — a network failure produces 'network',
        // not the 'not-found' sentinel used by hardcoded-unavailable methods.
        expect(result.error.code).toBe('network')
      }
    })

    it('returns unavailable for getSPCAlarmHistory', async () => {
      const result = await adapter.getSPCAlarmHistory(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.error.code).toBe('not-found')
      }
    })

    it('returns unavailable for getSPCRelatedBatches', async () => {
      const result = await adapter.getSPCRelatedBatches(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('databricks-api')
        expect(result.error.code).toBe('not-found')
      }
    })
  })

  describe('SPCMonitoringLegacyApiAdapter', () => {
    // The legacy adapter now proxies real V1 endpoints. Without a live V1 URL it
    // falls back to the mock base-class implementation for methods without proxy
    // coverage, and will throw a network error for wired methods (getMonitoredCharacteristics,
    // getControlChartSeries) when no server is running.

    const adapter = new SPCMonitoringLegacyApiAdapter('http://127.0.0.1:8000')

    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('falls through to mock for getSPCSummary (no V1 proxy for this method)', async () => {
      // getSPCSummary has no V1 proxy — falls through to base mock adapter
      const result = await adapter.getSPCSummary(request)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.data.chartsMonitored).toBeGreaterThanOrEqual(0)
      }
    })

    it('returns error result for getMonitoredCharacteristics on network failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError('fetch failed'))
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.source).toBe('legacy-api')
      }
    })

    it('returns error result for getMonitoredCharacteristics on 401', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('unauthorized')
        expect(result.source).toBe('legacy-api')
      }
    })

    it('returns empty characteristics list on empty V1 response', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(Array.isArray(result.data)).toBe(true)
        expect(result.data.length).toBe(0)
        expect(result.source).toBe('legacy-api')
      }
    })

    it('maps V1 characteristic fields to V2 MonitoredSPCCharacteristic', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              mic_id: 'MIC-PH-001',
              mic_name: 'pH',
              chart_type: 'xbar_r',
              batch_count: 20,
              has_active_signal: true,
              operation_id: 'OP-10',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok).toBe(true)
      if (result.ok) {
        const char = result.data[0]
        expect(char.characteristicId).toBe('MIC-PH-001')
        expect(char.characteristicName).toBe('pH')
        expect(char.chartType).toBe('xbar-r') // V1 'xbar_r' → V2 'xbar-r'
        expect(char.batchCount).toBe(20)
        expect(char.hasActiveSignal).toBe(true)
        expect(char.operationId).toBe('OP-10')
      }
    })

    it('maps V1 capability response to V2 CharacteristicCapability', async () => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({
            mic_id: 'CHAR-1',
            mic_name: 'Length',
            cp: 1.33,
            cpk: 1.25,
            pp: 1.3,
            ppk: 1.2,
            sample_count: 100,
            process_mean: 10.5,
            process_std_dev: 0.2,
            confidence: 0.95,
            interpretation: 'capable',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      const result = await adapter.getCharacteristicCapability(request)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.source).toBe('legacy-api')
        expect(result.data.characteristicId).toBe('CHAR-1')
        expect(result.data.characteristicName).toBe('Length')
        expect(result.data.cp).toBe(1.33)
        expect(result.data.cpk).toBe(1.25)
        expect(result.data.sampleCount).toBe(100)
        expect(result.data.mean).toBe(10.5)
        expect(result.data.standardDeviation).toBe(0.2)
        expect(result.data.interpretation).toBe('capable')
      }
    })
  })
})
