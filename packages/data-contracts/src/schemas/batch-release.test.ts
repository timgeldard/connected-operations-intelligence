import { describe, it, expect } from 'vitest'
import {
  BatchReleaseContextSchema,
  BatchReleaseQueueItemSchema,
  BatchReleaseSummarySchema,
  QualityResultsSummarySchema,
  MICFailureSchema,
  SPCSignalSummarySchema,
  ProcessOrderReleaseEvidenceSchema,
  WarehouseHoldStatusSchema,
  TraceExposureForReleaseSchema,
  CoAReadinessSchema,
  DeviationSummarySchema,
  ReleaseDecisionHistoryItemSchema,
} from './batch-release.js'

// ---------------------------------------------------------------------------
// BatchReleaseContextSchema
// ---------------------------------------------------------------------------
describe('BatchReleaseContextSchema', () => {
  const valid = {
    releaseCaseId: 'RC-2024-001',
    batchId: 'CH-240308-0047',
    materialId: 'MAT-001',
    materialDescription: 'Kerry Listowel Emmental',
    plantId: 'IE10',
    plantName: 'Listowel',
    status: 'awaiting-review',
    priority: 'routine',
    requestedBy: 'quality.lead@kerry.com',
    requestedAt: '2024-03-08T08:00:00.000Z',
    lastUpdatedAt: '2024-03-08T09:00:00.000Z',
    releaseType: 'standard',
  }

  it('accepts a valid context', () => {
    expect(BatchReleaseContextSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional fields', () => {
    const withOptionals = {
      ...valid,
      processOrderId: 'PO-001',
      assignedTo: 'analyst@kerry.com',
      dueBy: '2024-03-10T08:00:00.000Z',
    }
    expect(BatchReleaseContextSchema.safeParse(withOptionals).success).toBe(true)
  })

  it('rejects unknown status', () => {
    expect(BatchReleaseContextSchema.safeParse({ ...valid, status: 'approved' }).success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const { releaseCaseId: _omitted, ...rest } = valid
    expect(BatchReleaseContextSchema.safeParse(rest).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BatchReleaseQueueItemSchema
// ---------------------------------------------------------------------------
describe('BatchReleaseQueueItemSchema', () => {
  const valid = {
    releaseCaseId: 'RC-2024-001',
    batchId: 'CH-240308-0047',
    materialId: 'MAT-001',
    materialDescription: 'Kerry Listowel Emmental',
    plantId: 'IE10',
    status: 'awaiting-review',
    priority: 'expedited',
    blockers: ['CoA incomplete', 'Open deviation'],
    openDeviationCount: 2,
    spcAlarmCount: 1,
    hasOpenHold: false,
    requestedAt: '2024-03-08T08:00:00.000Z',
  }

  it('accepts a valid queue item', () => {
    expect(BatchReleaseQueueItemSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative deviation count', () => {
    expect(BatchReleaseQueueItemSchema.safeParse({ ...valid, openDeviationCount: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// BatchReleaseSummarySchema
// ---------------------------------------------------------------------------
describe('BatchReleaseSummarySchema', () => {
  const valid = {
    releaseCaseId: 'RC-2024-001',
    batchId: 'CH-240308-0047',
    materialId: 'MAT-001',
    materialDescription: 'Kerry Listowel Emmental',
    plantId: 'IE10',
    overallReadiness: 'blocked',
    qualityPassed: false,
    spcClean: true,
    coaComplete: false,
    noOpenHolds: true,
    deviationsResolved: false,
    traceClean: true,
    blockers: ['MIC failure: Listeria spp.'],
    warnings: ['SPC: X-bar nearing UCL'],
    recommendedAction: 'reject',
    lastEvaluatedAt: '2024-03-08T10:00:00.000Z',
  }

  it('accepts a valid summary', () => {
    expect(BatchReleaseSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects invalid recommendedAction', () => {
    expect(BatchReleaseSummarySchema.safeParse({ ...valid, recommendedAction: 'approve' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MICFailureSchema
// ---------------------------------------------------------------------------
describe('MICFailureSchema', () => {
  const valid = {
    organism: 'Listeria monocytogenes',
    testMethod: 'ISO 11290-1',
    result: 10,
    limit: 0,
    unit: 'cfu/g',
    exceededBy: 10,
    testedAt: '2024-03-07T14:00:00.000Z',
  }

  it('accepts a valid MIC failure', () => {
    expect(MICFailureSchema.safeParse(valid).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// QualityResultsSummarySchema
// ---------------------------------------------------------------------------
describe('QualityResultsSummarySchema', () => {
  const valid = {
    batchId: 'CH-240308-0047',
    micStatus: 'fail',
    chemicalStatus: 'pass',
    sensoryStatus: 'pass',
    physicalStatus: 'pass',
    overallStatus: 'fail',
    micFailures: [
      {
        organism: 'Listeria monocytogenes',
        testMethod: 'ISO 11290-1',
        result: 10,
        limit: 0,
        unit: 'cfu/g',
        exceededBy: 10,
        testedAt: '2024-03-07T14:00:00.000Z',
      },
    ],
    openRetestCount: 0,
  }

  it('accepts a valid quality results summary', () => {
    expect(QualityResultsSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative retest count', () => {
    expect(QualityResultsSummarySchema.safeParse({ ...valid, openRetestCount: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// SPCSignalSummarySchema
// ---------------------------------------------------------------------------
describe('SPCSignalSummarySchema', () => {
  const valid = {
    processOrderId: 'PO-001',
    batchId: 'CH-240308-0047',
    activeAlarmCount: 1,
    resolvedAlarmCount: 0,
    criticalAlarmCount: 0,
    alarms: [
      {
        alarmId: 'ALARM-001',
        chartType: 'xbar-r',
        parameter: 'pH',
        ruleViolated: 'Rule 1: Point beyond 3σ',
        severity: 'major',
        firedAt: '2024-03-08T06:30:00.000Z',
        status: 'active',
      },
    ],
    lastCheckedAt: '2024-03-08T10:00:00.000Z',
  }

  it('accepts a valid SPC signal summary', () => {
    expect(SPCSignalSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts alarm with resolvedAt', () => {
    const withResolved = {
      ...valid,
      alarms: [{ ...valid.alarms[0], resolvedAt: '2024-03-08T09:00:00.000Z', status: 'resolved' }],
    }
    expect(SPCSignalSummarySchema.safeParse(withResolved).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// ProcessOrderReleaseEvidenceSchema
// ---------------------------------------------------------------------------
describe('ProcessOrderReleaseEvidenceSchema', () => {
  const valid = {
    processOrderId: 'PO-001',
    batchId: 'CH-240308-0047',
    orderStatus: 'completed',
    plannedQuantity: 5000,
    confirmedQuantity: 4850,
    uom: 'KG',
    yieldPercent: 97,
    conformanceStatus: 'conformant',
    openNCRCount: 0,
    criticalDeviationCount: 0,
  }

  it('accepts valid process order evidence', () => {
    expect(ProcessOrderReleaseEvidenceSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects yield over 200%', () => {
    expect(ProcessOrderReleaseEvidenceSchema.safeParse({ ...valid, yieldPercent: 201 }).success).toBe(false)
  })

  it('rejects negative yield', () => {
    expect(ProcessOrderReleaseEvidenceSchema.safeParse({ ...valid, yieldPercent: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// WarehouseHoldStatusSchema
// ---------------------------------------------------------------------------
describe('WarehouseHoldStatusSchema', () => {
  const valid = {
    batchId: 'CH-240308-0047',
    materialId: 'MAT-001',
    plantId: 'IE10',
    stockType: 'quality-inspection',
    totalQuantity: 5000,
    blockedQuantity: 5000,
    restrictedQuantity: 0,
    unrestrictedQuantity: 0,
    uom: 'KG',
    activeHolds: [
      {
        holdId: 'HOLD-001',
        holdType: 'quality',
        reason: 'MIC failure',
        placedBy: 'quality.lead@kerry.com',
        placedAt: '2024-03-08T08:00:00.000Z',
        status: 'active',
      },
    ],
    hasBlockingHold: true,
    lastUpdatedAt: '2024-03-08T10:00:00.000Z',
  }

  it('accepts valid warehouse hold status', () => {
    expect(WarehouseHoldStatusSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts empty activeHolds array', () => {
    expect(
      WarehouseHoldStatusSchema.safeParse({ ...valid, activeHolds: [], hasBlockingHold: false }).success
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TraceExposureForReleaseSchema
// ---------------------------------------------------------------------------
describe('TraceExposureForReleaseSchema', () => {
  const valid = {
    batchId: 'CH-240308-0047',
    releaseCaseId: 'RC-2024-001',
    upstreamRiskLevel: 'high',
    downstreamRiskLevel: 'medium',
    affectedCustomerCount: 3,
    affectedSupplierLotCount: 1,
    openTraceInvestigations: [
      {
        investigationId: 'INV-2024-003847',
        status: 'open',
        severity: 'high',
        summary: 'Listeria environmental finding linked to this batch',
      },
    ],
    recallRiskFlag: false,
    traceReadiness: 'flagged',
    lastEvaluatedAt: '2024-03-08T10:00:00.000Z',
  }

  it('accepts valid trace exposure', () => {
    expect(TraceExposureForReleaseSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative customer count', () => {
    expect(
      TraceExposureForReleaseSchema.safeParse({ ...valid, affectedCustomerCount: -1 }).success
    ).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CoAReadinessSchema
// ---------------------------------------------------------------------------
describe('CoAReadinessSchema', () => {
  const valid = {
    batchId: 'CH-240308-0047',
    materialId: 'MAT-001',
    readinessStatus: 'incomplete',
    missingFields: ['pH result', 'moisture result'],
    customerSpecificCoas: [],
    lastUpdatedAt: '2024-03-08T10:00:00.000Z',
  }

  it('accepts valid CoA readiness', () => {
    expect(CoAReadinessSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts complete CoA with sign-off', () => {
    const complete = {
      ...valid,
      readinessStatus: 'complete',
      missingFields: [],
      signedOffBy: 'quality.lead@kerry.com',
      signedOffAt: '2024-03-08T11:00:00.000Z',
    }
    expect(CoAReadinessSchema.safeParse(complete).success).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// DeviationSummarySchema
// ---------------------------------------------------------------------------
describe('DeviationSummarySchema', () => {
  const valid = {
    batchId: 'CH-240308-0047',
    totalDeviationCount: 2,
    openDeviationCount: 1,
    criticalDeviationCount: 0,
    deviations: [
      {
        deviationId: 'DEV-001',
        type: 'quality',
        severity: 'major',
        status: 'open',
        description: 'MIC failure exceeds specification',
        raisedAt: '2024-03-07T15:00:00.000Z',
        raisedBy: 'analyst@kerry.com',
        impactsRelease: true,
      },
    ],
    blockingReleaseCount: 1,
    lastUpdatedAt: '2024-03-08T10:00:00.000Z',
  }

  it('accepts valid deviation summary', () => {
    expect(DeviationSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative blocking count', () => {
    expect(DeviationSummarySchema.safeParse({ ...valid, blockingReleaseCount: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ReleaseDecisionHistoryItemSchema
// ---------------------------------------------------------------------------
describe('ReleaseDecisionHistoryItemSchema', () => {
  const valid = {
    decisionId: 'DEC-001',
    releaseCaseId: 'RC-2024-001',
    batchId: 'CH-240308-0047',
    decision: 'rejected',
    decidedBy: 'quality.lead@kerry.com',
    decidedAt: '2024-03-08T12:00:00.000Z',
    rationale: 'MIC failure: Listeria monocytogenes detected above limit.',
    conditions: [],
    attachments: [],
  }

  it('accepts a valid decision history item', () => {
    expect(ReleaseDecisionHistoryItemSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts decision with conditions and attachments', () => {
    const withConditions = {
      ...valid,
      decision: 'conditional-release',
      conditions: ['Restricted to Plant IE10 only', 'Re-test within 7 days'],
      attachments: [{ attachmentId: 'ATT-001', name: 'coa.pdf', mimeType: 'application/pdf' }],
    }
    expect(ReleaseDecisionHistoryItemSchema.safeParse(withConditions).success).toBe(true)
  })

  it('rejects unknown decision type', () => {
    expect(ReleaseDecisionHistoryItemSchema.safeParse({ ...valid, decision: 'approved' }).success).toBe(false)
  })
})
