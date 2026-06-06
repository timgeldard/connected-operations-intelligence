import { describe, it, expect } from 'vitest'
import {
  SPCMonitoringContextSchema,
  SPCSummarySchema,
  SPCSignalSchema,
  ControlChartSeriesSchema,
  ControlChartPointSchema,
  CharacteristicCapabilitySchema,
  SPCAlarmHistoryItemSchema,
  SPCRelatedBatchSchema,
} from './spc-monitoring.js'

describe('SPCMonitoringContextSchema', () => {
  it('accepts a valid context', () => {
    const result = SPCMonitoringContextSchema.safeParse({
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      materialId: 'MAT-CH-EMMENTAL',
      materialDescription: 'Emmental Block',
      activeSignals: 2,
      highestSeverity: 'high',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing plantId', () => {
    const result = SPCMonitoringContextSchema.safeParse({
      plantName: 'Kerry Listowel',
      materialId: 'MAT-CH',
      materialDescription: 'Emmental',
      activeSignals: 0,
      highestSeverity: 'low',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid highestSeverity', () => {
    const result = SPCMonitoringContextSchema.safeParse({
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      materialId: 'MAT-CH',
      materialDescription: 'Emmental',
      activeSignals: 0,
      highestSeverity: 'unknown',
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('SPCSummarySchema', () => {
  it('accepts valid summary', () => {
    const result = SPCSummarySchema.safeParse({
      chartsMonitored: 12,
      activeSignals: 2,
      outOfControlSignals: 1,
      warningSignals: 1,
      characteristicsAtRisk: 2,
      highestSeverity: 'high',
      recommendedAction: 'Investigate pH signal.',
      confidence: 0.93,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const result = SPCSummarySchema.safeParse({
      chartsMonitored: 5,
      activeSignals: 0,
      outOfControlSignals: 0,
      warningSignals: 0,
      characteristicsAtRisk: 0,
      highestSeverity: 'low',
      recommendedAction: 'All clear.',
      confidence: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('SPCSignalSchema', () => {
  it('accepts valid signal', () => {
    const result = SPCSignalSchema.safeParse({
      signalId: 'SIG-001',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      materialId: 'MAT-CH-EMMENTAL',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      chartType: 'xbar-r',
      rule: 'Rule 1',
      ruleCode: 'WE1',
      severity: 'high',
      detectedAt: '2024-03-08T05:45:00.000Z',
      samplePointId: 'SP-001',
      resultValue: 6.92,
      recommendedAction: 'Investigate.',
      status: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a signal without ruleCode for legacy source compatibility', () => {
    const result = SPCSignalSchema.safeParse({
      signalId: 'SIG-001',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      materialId: 'MAT-CH-EMMENTAL',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      chartType: 'xbar-r',
      rule: 'Rule 1',
      severity: 'high',
      detectedAt: '2024-03-08T05:45:00.000Z',
      samplePointId: 'SP-001',
      resultValue: 6.92,
      recommendedAction: 'Investigate.',
      status: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a signal with a null ruleCode for legacy source compatibility', () => {
    const result = SPCSignalSchema.safeParse({
      signalId: 'SIG-001',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      materialId: 'MAT-CH-EMMENTAL',
      batchId: 'CH-240308-0047',
      plantId: 'IE10',
      chartType: 'xbar-r',
      rule: 'Rule 1',
      ruleCode: null,
      severity: 'high',
      detectedAt: '2024-03-08T05:45:00.000Z',
      samplePointId: 'SP-001',
      resultValue: 6.92,
      recommendedAction: 'Investigate.',
      status: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = SPCSignalSchema.safeParse({
      signalId: 'SIG-001',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      materialId: 'MAT',
      batchId: 'CH-001',
      plantId: 'IE10',
      chartType: 'xbar-r',
      rule: 'Rule 1',
      severity: 'high',
      detectedAt: '2024-03-08T05:45:00.000Z',
      samplePointId: 'SP-001',
      resultValue: 6.92,
      recommendedAction: 'Investigate.',
      status: 'pending',
    })
    expect(result.success).toBe(false)
  })
})

describe('ControlChartPointSchema', () => {
  it('accepts valid point', () => {
    const result = ControlChartPointSchema.safeParse({
      pointId: 'PT-001',
      timestamp: '2024-03-08T06:00:00.000Z',
      value: 6.55,
      signalIds: [],
      status: 'in-control',
    })
    expect(result.success).toBe(true)
  })
})

describe('ControlChartSeriesSchema', () => {
  it('accepts valid series', () => {
    const result = ControlChartSeriesSchema.safeParse({
      chartId: 'CHART-001',
      chartType: 'xbar-r',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      points: [{ pointId: 'PT-001', timestamp: '2024-03-08T06:00:00.000Z', value: 6.55, signalIds: [], status: 'in-control' }],
      centerLine: 6.58,
      upperControlLimit: 6.85,
      lowerControlLimit: 6.31,
      unitOfMeasure: 'pH',
      confidence: 0.95,
    })
    expect(result.success).toBe(true)
  })

  it('accepts series with missing control limits', () => {
    const result = ControlChartSeriesSchema.safeParse({
      chartId: 'CHART-001',
      chartType: 'xbar-r',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      points: [{ pointId: 'PT-001', timestamp: '2024-03-08T06:00:00.000Z', value: 6.55, signalIds: [], status: 'in-control' }],
      unitOfMeasure: 'pH',
      confidence: 0.85,
    })
    expect(result.success).toBe(true)
  })
})

describe('CharacteristicCapabilitySchema', () => {
  it('accepts valid capability', () => {
    const result = CharacteristicCapabilitySchema.safeParse({
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      cp: 1.42,
      cpk: 1.18,
      pp: 1.35,
      ppk: 1.09,
      sampleCount: 87,
      mean: 6.58,
      standardDeviation: 0.089,
      confidence: 0.91,
      interpretation: 'capable',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid interpretation', () => {
    const result = CharacteristicCapabilitySchema.safeParse({
      characteristicId: 'CHAR-001',
      characteristicName: 'pH',
      cp: 1.0,
      cpk: 0.9,
      pp: 1.0,
      ppk: 0.9,
      sampleCount: 10,
      mean: 6.5,
      standardDeviation: 0.1,
      confidence: 0.8,
      interpretation: 'unknown',
    })
    expect(result.success).toBe(false)
  })
})

describe('SPCAlarmHistoryItemSchema', () => {
  it('accepts valid alarm history item', () => {
    const result = SPCAlarmHistoryItemSchema.safeParse({
      alarmId: 'ALM-001',
      timestamp: '2024-03-08T05:45:00.000Z',
      characteristicId: 'CHAR-PH-001',
      rule: 'Rule 1',
      severity: 'high',
      status: 'active',
    })
    expect(result.success).toBe(true)
  })

  it('accepts alarm history item with ruleCode', () => {
    const result = SPCAlarmHistoryItemSchema.safeParse({
      alarmId: 'ALM-001',
      timestamp: '2024-03-08T05:45:00.000Z',
      characteristicId: 'CHAR-PH-001',
      rule: 'Rule 1',
      ruleCode: 'WE1',
      severity: 'high',
      status: 'active',
    })
    expect(result.success).toBe(true)
  })
})

describe('SPCRelatedBatchSchema', () => {
  it('accepts valid related batch', () => {
    const result = SPCRelatedBatchSchema.safeParse({
      batchId: 'CH-240308-0047',
      materialId: 'MAT-CH-EMMENTAL',
      plantId: 'IE10',
      status: 'under-review',
      relatedSignalCount: 2,
      releaseImpact: 'blocking',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid releaseImpact', () => {
    const result = SPCRelatedBatchSchema.safeParse({
      batchId: 'CH-001',
      materialId: 'MAT',
      plantId: 'IE10',
      status: 'released',
      relatedSignalCount: 0,
      releaseImpact: 'minimal',
    })
    expect(result.success).toBe(false)
  })
})
