import { describe, it, expect } from 'vitest'
import {
  EnvMonContextSchema,
  EnvMonSiteSummarySchema,
  EnvMonZoneSchema,
  EnvMonAlertSchema,
  EnvMonSwabResultSchema,
  EnvMonTrendSchema,
  EnvMonHeatmapCellSchema,
  EnvMonCorrectiveActionSchema,
  EnvMonSwabVectorSchema,
  EnvMonKpiSummarySchema,
} from './environmental-monitoring.js'

describe('EnvMonContextSchema', () => {
  it('accepts valid context', () => {
    const result = EnvMonContextSchema.safeParse({
      regionId: 'EU-WEST',
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      monitoringPeriodStart: '2024-03-01',
      monitoringPeriodEnd: '2024-03-08',
      totalZones: 24,
      activeAlerts: 3,
      openCorrectiveActions: 2,
      overallRiskStatus: 'elevated',
      lastSampleDate: '2024-03-07',
      lastUpdatedAt: '2024-03-08T15:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid riskStatus', () => {
    const result = EnvMonContextSchema.safeParse({
      regionId: 'EU-WEST',
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      monitoringPeriodStart: '2024-03-01',
      monitoringPeriodEnd: '2024-03-08',
      totalZones: 0,
      activeAlerts: 0,
      openCorrectiveActions: 0,
      overallRiskStatus: 'green',
      lastUpdatedAt: '2024-03-08T15:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('EnvMonSiteSummarySchema', () => {
  it('accepts valid summary', () => {
    const result = EnvMonSiteSummarySchema.safeParse({
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      zonesMonitored: 24,
      zonesWithAlerts: 3,
      positiveCount: 5,
      positiveRate: 4.2,
      openCorrectiveActions: 2,
      overdueActions: 0,
      complianceRate: 97.5,
      riskStatus: 'elevated',
      highestSeverity: 'high',
      confidence: 0.92,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const result = EnvMonSiteSummarySchema.safeParse({
      plantId: 'IE10',
      plantName: 'Test',
      zonesMonitored: 1,
      zonesWithAlerts: 0,
      positiveCount: 0,
      positiveRate: 0,
      openCorrectiveActions: 0,
      overdueActions: 0,
      complianceRate: 100,
      riskStatus: 'compliant',
      highestSeverity: 'low',
      confidence: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('EnvMonZoneSchema', () => {
  it('accepts valid zone', () => {
    const result = EnvMonZoneSchema.safeParse({
      zoneId: 'ZONE-001',
      zoneName: 'Filling Line A',
      plantId: 'IE10',
      areaType: 'production',
      hygieneZone: 'zone-2',
      status: 'compliant',
      lastSampleDate: '2024-03-05',
      nextScheduledSample: '2024-03-12',
      consecutivePositives: 0,
      openAlerts: 0,
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvMonAlertSchema', () => {
  it('accepts valid alert', () => {
    const result = EnvMonAlertSchema.safeParse({
      alertId: 'ALT-001',
      zoneId: 'ZONE-003',
      zoneName: 'Packaging Hall',
      plantId: 'IE10',
      testType: 'swab',
      organism: 'Listeria monocytogenes',
      severity: 'critical',
      detectedAt: '2024-03-07T09:00:00.000Z',
      status: 'investigating',
      description: 'Positive environmental swab detected',
      owner: 'qc.lab@listowel.ie',
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvMonSwabResultSchema', () => {
  it('accepts valid swab result', () => {
    const result = EnvMonSwabResultSchema.safeParse({
      sampleId: 'SWB-2024-001',
      zoneId: 'ZONE-003',
      zoneName: 'Packaging Hall',
      plantId: 'IE10',
      testType: 'swab',
      organism: 'Total Viable Count',
      result: 'negative',
      cfu: 0,
      cfuLimit: 100,
      sampleDate: '2024-03-07',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid result value', () => {
    const result = EnvMonSwabResultSchema.safeParse({
      sampleId: 'SWB-001',
      zoneId: 'Z1',
      zoneName: 'Zone 1',
      plantId: 'IE10',
      testType: 'swab',
      organism: 'TVC',
      result: 'inconclusive',
      sampleDate: '2024-03-07',
    })
    expect(result.success).toBe(false)
  })
})

describe('EnvMonTrendSchema', () => {
  it('accepts valid trend record', () => {
    const result = EnvMonTrendSchema.safeParse({
      date: '2024-03-07',
      plantId: 'IE10',
      samplesCollected: 12,
      positiveCount: 1,
      positiveRate: 8.3,
      newAlerts: 1,
      resolvedAlerts: 0,
      openAlerts: 3,
      complianceRate: 91.7,
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvMonHeatmapCellSchema', () => {
  it('accepts valid heatmap cell', () => {
    const result = EnvMonHeatmapCellSchema.safeParse({
      zoneId: 'ZONE-001',
      zoneName: 'Filling Line A',
      areaType: 'production',
      hygieneZone: 'zone-2',
      riskScore: 15,
      positiveCount: 0,
      sampleCount: 12,
      lastTestDate: '2024-03-05',
      status: 'compliant',
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvMonCorrectiveActionSchema', () => {
  it('accepts valid corrective action', () => {
    const result = EnvMonCorrectiveActionSchema.safeParse({
      actionId: 'CA-001',
      alertId: 'ALT-001',
      zoneId: 'ZONE-003',
      zoneName: 'Packaging Hall',
      plantId: 'IE10',
      title: 'Deep clean and retest zone 3',
      description: 'Perform full zone sanitisation following positive environmental finding',
      actionType: 'deep-clean',
      severity: 'critical',
      status: 'in-progress',
      assignee: 'hygiene.team@listowel.ie',
      dueDate: '2024-03-09',
      recurrence: false,
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvMonSwabVectorSchema', () => {
  it('accepts valid swab vector', () => {
    const result = EnvMonSwabVectorSchema.safeParse({
      vectorId: 'VEC-001',
      vectorName: 'Weekly Production Zone Route',
      plantId: 'IE10',
      zoneIds: ['ZONE-001', 'ZONE-002', 'ZONE-003'],
      frequency: 'weekly',
      nextDueDate: '2024-03-14',
      lastCompletedDate: '2024-03-07',
      status: 'on-schedule',
      pointCount: 18,
    })
    expect(result.success).toBe(true)
  })
})

describe('EnvMonKpiSummarySchema', () => {
  it('accepts valid KPI summary', () => {
    const result = EnvMonKpiSummarySchema.safeParse({
      plantId: 'IE10',
      periodStart: '2024-03-01',
      periodEnd: '2024-03-08',
      zonesMonitored: 24,
      samplesCollected: 96,
      positiveRate: 4.2,
      alertsOpen: 3,
      alertsResolved: 8,
      correctiveActionsOpen: 2,
      correctiveActionsOverdue: 0,
      complianceRate: 97.5,
      trendDirection: 'stable',
      confidence: 0.9,
    })
    expect(result.success).toBe(true)
  })
})
