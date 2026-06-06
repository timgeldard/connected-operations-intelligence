import { describe, expect, it } from 'vitest'
import { buildSPCGenieReply, type SPCGenieSnapshot } from './spc-genie-pilot-engine.js'

const mockSnapshot: SPCGenieSnapshot = {
  summary: {
    data: {
      chartsMonitored: 5,
      activeSignals: 1,
      outOfControlSignals: 1,
      warningSignals: 0,
      characteristicsAtRisk: 1,
      highestSeverity: 'high',
      recommendedAction: 'Check pH levels.',
      confidence: 0.95,
    },
    source: 'databricks-api',
  },
  chart: {
    data: {
      chartId: 'CHART-PH',
      chartType: 'individuals',
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      centerLine: 6.5,
      upperControlLimit: 6.8,
      lowerControlLimit: 6.2,
      upperSpecLimit: 7.0,
      lowerSpecLimit: 6.0,
      points: [],
      confidence: 0.95,
    },
    source: 'databricks-api',
  },
  capability: {
    data: {
      characteristicId: 'CHAR-PH-001',
      characteristicName: 'pH',
      cp: 1.5,
      cpk: 1.2,
      pp: 1.4,
      ppk: 1.1,
      sampleCount: 50,
      mean: 6.5,
      standardDeviation: 0.05,
      confidence: 0.9,
      interpretation: 'capable',
    },
    source: 'databricks-api',
  },
  signals: {
    data: [
      {
        signalId: 'SIG-1',
        characteristicId: 'CHAR-PH-001',
        characteristicName: 'pH',
        materialId: 'MAT-1',
        batchId: 'CH-240308-0047',
        plantId: 'IE10',
        chartType: 'individuals',
        rule: 'Rule 1: Point beyond control limit',
        ruleCode: 'WE1',
        severity: 'high',
        detectedAt: '2026-05-14T00:00:00Z',
        samplePointId: 'SP-1',
        resultValue: 6.9,
        recommendedAction: 'Adjust pasteurisation temperature.',
        status: 'active',
      },
    ],
    source: 'databricks-api',
  },
}

describe('buildSPCGenieReply', () => {
  it('should answer about capability when asked about Cpk', () => {
    const reply = buildSPCGenieReply('What is the Cpk value?', mockSnapshot)
    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('Cpk: 1.20')
    expect(reply.text).toContain('capable')
  })

  it('should block release decisions', () => {
    const reply = buildSPCGenieReply('Should we release batch CH-240308-0047?', mockSnapshot)
    expect(reply.kind).toBe('blocked')
  })

  it('should answer about active signals', () => {
    const reply = buildSPCGenieReply('Are there active signals?', mockSnapshot)
    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('Active Signals (1)')
    expect(reply.text).toContain('violates Rule 1: Point beyond control limit')
  })

  it('should show database sources', () => {
    const reply = buildSPCGenieReply('Where does the data come from?', mockSnapshot)
    expect(reply.kind).toBe('approved')
    expect(reply.text).toContain('gold_batch_quality_result_v')
    expect(reply.text).toContain('spc_quality_metric_subgroup_mv')
  })
})
