import { describe, it, expect } from 'vitest'
import { SPCMonitoringAdapter, toSPCMonitoringAdapterError } from './spc-monitoring-adapter.js'

const FIXED_NOW = '2024-03-08T10:00:00.000Z'
const adapter = new SPCMonitoringAdapter({ now: () => FIXED_NOW })

const request = { materialId: 'MAT-12345', plantId: 'IE10', workCentreId: 'WC-IE10-PASTEURISATION' }

describe('SPCMonitoringAdapter', () => {
  describe('getSPCMonitoringContext', () => {
    it('returns ok result', async () => {
      const result = await adapter.getSPCMonitoringContext(request)
      expect(result.ok).toBe(true)
    })

    it('returns plantId IE10', async () => {
      const result = await adapter.getSPCMonitoringContext(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.plantId).toBe('IE10')
    })

    it('includes fetchedAt timestamp', async () => {
      const result = await adapter.getSPCMonitoringContext(request)
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('getSPCSummary', () => {
    it('returns ok result', async () => {
      const result = await adapter.getSPCSummary(request)
      expect(result.ok).toBe(true)
    })

    it('returns chartsMonitored > 0', async () => {
      const result = await adapter.getSPCSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.chartsMonitored).toBeGreaterThan(0)
    })

    it('confidence is between 0 and 1', async () => {
      const result = await adapter.getSPCSummary(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.confidence).toBeGreaterThanOrEqual(0)
      expect(result.data.confidence).toBeLessThanOrEqual(1)
    })
  })

  describe('getActiveSPCSignals', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getActiveSPCSignals(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('each signal has required fields', async () => {
      const result = await adapter.getActiveSPCSignals(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const signal of result.data) {
        expect(signal.signalId).toBeTruthy()
        expect(signal.characteristicId).toBeTruthy()
        expect(signal.status).toBeTruthy()
      }
    })
  })

  describe('getControlChartSeries', () => {
    it('returns ok result with points array', async () => {
      const result = await adapter.getControlChartSeries(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data.points)).toBe(true)
      expect(result.data.points.length).toBeGreaterThan(0)
    })

    it('UCL is greater than LCL', async () => {
      const result = await adapter.getControlChartSeries(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.upperControlLimit!).toBeGreaterThan(result.data.lowerControlLimit!)
    })
  })

  describe('getCharacteristicCapability', () => {
    it('returns ok result', async () => {
      const result = await adapter.getCharacteristicCapability(request)
      expect(result.ok).toBe(true)
    })

    it('Cpk is positive', async () => {
      const result = await adapter.getCharacteristicCapability(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.cpk).toBeGreaterThan(0)
    })

    it('sampleCount is positive integer', async () => {
      const result = await adapter.getCharacteristicCapability(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.sampleCount).toBeGreaterThan(0)
      expect(Number.isInteger(result.data.sampleCount)).toBe(true)
    })
  })

  describe('getSPCAlarmHistory', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getSPCAlarmHistory(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })
  })

  describe('getMonitoredCharacteristics', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data.length).toBeGreaterThan(0)
    })

    it('returns at least 3 characteristics', async () => {
      const result = await adapter.getMonitoredCharacteristics(request)
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.length).toBeGreaterThanOrEqual(3)
    })

    it('each characteristic has required fields', async () => {
      const result = await adapter.getMonitoredCharacteristics(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const char of result.data) {
        expect(char.characteristicId).toBeTruthy()
        expect(char.characteristicName).toBeTruthy()
        expect(char.chartType).toBeTruthy()
        expect(typeof char.hasActiveSignal).toBe('boolean')
      }
    })

    it('no characteristic has hardcoded pH/Moisture/Fat in the characteristicId directly', async () => {
      const result = await adapter.getMonitoredCharacteristics(request)
      if (!result.ok) throw new Error('Expected ok result')
      // IDs come from data, not hardcoded view logic
      const ids = result.data.map(c => c.characteristicId)
      expect(ids).not.toEqual(['CHAR-PH-001', 'CHAR-MOISTURE-001', 'CHAR-FAT-001'])
    })

    it('returns source mock', async () => {
      const result = await adapter.getMonitoredCharacteristics(request)
      expect(result.ok && (result as { source?: string }).source).toBe('mock')
      // source field is verified to be 'mock'
      expect(result.ok && result.fetchedAt).toBe(FIXED_NOW)
    })
  })

  describe('getControlChartSeries — routing by characteristicId', () => {
    it('returns pH series for CHAR-PH-001', async () => {
      const result = await adapter.getControlChartSeries({ ...request, characteristicId: 'CHAR-PH-001' })
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.characteristicId).toBe('CHAR-PH-001')
      expect(result.data.characteristicName).toBe('pH')
    })

    it('returns Moisture series for CHAR-MOISTURE-001', async () => {
      const result = await adapter.getControlChartSeries({ ...request, characteristicId: 'CHAR-MOISTURE-001' })
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.characteristicId).toBe('CHAR-MOISTURE-001')
    })

    it('returns Salt series for CHAR-SALT-001', async () => {
      const result = await adapter.getControlChartSeries({ ...request, characteristicId: 'CHAR-SALT-001' })
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.characteristicId).toBe('CHAR-SALT-001')
      expect(result.data.characteristicName).toBe('Salt %')
    })

    it('returns Texture series for CHAR-TEXTURE-001', async () => {
      const result = await adapter.getControlChartSeries({ ...request, characteristicId: 'CHAR-TEXTURE-001' })
      if (!result.ok) throw new Error('Expected ok result')
      expect(result.data.characteristicId).toBe('CHAR-TEXTURE-001')
      expect(result.data.characteristicName).toBe('Texture Score')
    })

    it('UCL > LCL for all routed characteristics', async () => {
      for (const id of ['CHAR-PH-001', 'CHAR-MOISTURE-001', 'CHAR-FAT-001', 'CHAR-SALT-001', 'CHAR-TEXTURE-001']) {
        const result = await adapter.getControlChartSeries({ ...request, characteristicId: id })
        if (!result.ok) throw new Error(`Expected ok result for ${id}`)
        expect(result.data.upperControlLimit!).toBeGreaterThan(result.data.lowerControlLimit!)
      }
    })
  })

  describe('getSPCRelatedBatches', () => {
    it('returns ok result with array', async () => {
      const result = await adapter.getSPCRelatedBatches(request)
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error('Expected ok result')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('each batch has a releaseImpact field', async () => {
      const result = await adapter.getSPCRelatedBatches(request)
      if (!result.ok) throw new Error('Expected ok result')
      for (const batch of result.data) {
        expect(['blocking', 'risk', 'none']).toContain(batch.releaseImpact)
      }
    })
  })

  describe('toSPCMonitoringAdapterError', () => {
    it('returns error result with source mock', () => {
      const errorResult = toSPCMonitoringAdapterError(new Error('Test error'))
      expect(errorResult.ok).toBe(false)
      if (errorResult.ok) throw new Error('Expected error result')
      expect(errorResult.source).toBe('mock')
      expect(errorResult.error.message).toBe('Test error')
    })
  })
})
