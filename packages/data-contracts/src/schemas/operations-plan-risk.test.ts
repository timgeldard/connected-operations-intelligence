import { describe, it, expect } from 'vitest'
import {
  OperationsPlanRiskContextSchema,
  PlanRiskSummarySchema,
  LateOrderSchema,
  MaterialShortageSchema,
  WarehouseStagingStatusSchema,
  QualityBlockerSchema,
  ReleaseHoldImpactSchema,
  LineStatusSchema,
  ScheduleAdherenceSummarySchema,
  YieldVarianceSummarySchema,
  MaintenanceConstraintSchema,
  ShiftHandoverItemSchema,
  OperationsActionQueueItemSchema,
} from './operations-plan-risk.js'

// ---------------------------------------------------------------------------
// OperationsPlanRiskContextSchema
// ---------------------------------------------------------------------------
describe('OperationsPlanRiskContextSchema', () => {
  const valid = {
    planDate: '2026-05-15',
    plantId: 'IE10',
    plantName: 'Listowel',
    lineIds: ['L-01', 'L-02'],
    shiftId: 'SHIFT-AM',
    supervisor: 'John Murphy',
    riskStatus: 'at-risk',
    highestSeverity: 'high',
    openBlockers: 3,
    lateOrders: 2,
    materialShortages: 1,
    qualityBlockers: 1,
    stagingBlockers: 0,
    maintenanceConstraints: 1,
    lastUpdatedAt: '2026-05-15T06:00:00.000Z',
    activeScope: 'plant',
    activeView: 'plan-overview',
  }

  it('accepts a valid context', () => {
    expect(OperationsPlanRiskContextSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown riskStatus', () => {
    expect(OperationsPlanRiskContextSchema.safeParse({ ...valid, riskStatus: 'delayed' }).success).toBe(false)
  })

  it('rejects negative openBlockers', () => {
    expect(OperationsPlanRiskContextSchema.safeParse({ ...valid, openBlockers: -1 }).success).toBe(false)
  })

  it('rejects missing required field', () => {
    const { plantId: _omitted, ...rest } = valid
    expect(OperationsPlanRiskContextSchema.safeParse(rest).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PlanRiskSummarySchema
// ---------------------------------------------------------------------------
describe('PlanRiskSummarySchema', () => {
  const valid = {
    planDate: '2026-05-15',
    plantId: 'IE10',
    plannedOrders: 24,
    ordersOnTrack: 18,
    ordersAtRisk: 4,
    ordersLate: 2,
    blockedOrders: 1,
    highestSeverity: 'high',
    topRiskReason: 'Material shortage for CHIP-VAR-001 affecting 3 orders',
    recommendedAction: 'Escalate staging request for CHIP-VAR-001 to warehouse immediately',
    confidence: 0.85,
  }

  it('accepts a valid summary', () => {
    expect(PlanRiskSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    expect(PlanRiskSummarySchema.safeParse({ ...valid, confidence: 1.1 }).success).toBe(false)
  })

  it('rejects negative order count', () => {
    expect(PlanRiskSummarySchema.safeParse({ ...valid, plannedOrders: -1 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LateOrderSchema
// ---------------------------------------------------------------------------
describe('LateOrderSchema', () => {
  const valid = {
    processOrderId: '4500837291',
    materialId: 'CHIP-VAR-001',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    batchId: '2026-W20-A',
    lineOrResource: 'L-04',
    plannedStart: '2026-05-15T04:00:00.000Z',
    plannedFinish: '2026-05-15T12:00:00.000Z',
    delayMinutes: 95,
    delayReason: 'Material shortage — staging incomplete',
    severity: 'high',
    owner: 'ops.supervisor@kerry.com',
  }

  it('accepts a valid late order', () => {
    expect(LateOrderSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional actualStart and estimatedFinish', () => {
    const withOptionals = {
      ...valid,
      actualStart: '2026-05-15T05:30:00.000Z',
      estimatedFinish: '2026-05-15T14:35:00.000Z',
    }
    expect(LateOrderSchema.safeParse(withOptionals).success).toBe(true)
  })

  it('rejects unknown severity', () => {
    expect(LateOrderSchema.safeParse({ ...valid, severity: 'extreme' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MaterialShortageSchema
// ---------------------------------------------------------------------------
describe('MaterialShortageSchema', () => {
  const valid = {
    materialId: 'SALT-IND-002',
    materialDescription: 'Industrial Salt 25kg Bag',
    plantId: 'IE10',
    requiredQuantity: 500,
    availableQuantity: 200,
    shortageQuantity: 300,
    uom: 'KG',
    requiredBy: '2026-05-15T08:00:00.000Z',
    affectedOrders: ['4500837291', '4500837295'],
    stagingStatus: 'partial',
    procurementStatus: 'ordered',
    severity: 'medium',
  }

  it('accepts a valid shortage', () => {
    expect(MaterialShortageSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown stagingStatus', () => {
    expect(MaterialShortageSchema.safeParse({ ...valid, stagingStatus: 'missing' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// WarehouseStagingStatusSchema
// ---------------------------------------------------------------------------
describe('WarehouseStagingStatusSchema', () => {
  const valid = {
    processOrderId: '4500837291',
    materialId: 'CHIP-VAR-001',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    batchId: '2026-W20-A',
    requiredQuantity: 200,
    stagedQuantity: 120,
    missingQuantity: 80,
    uom: 'KG',
    stagingArea: 'STG-01A',
    status: 'partial',
  }

  it('accepts a valid staging status', () => {
    expect(WarehouseStagingStatusSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional fields', () => {
    const withOptionals = {
      ...valid,
      transferRequirementId: 'TR-20260515-001',
      lastMovementAt: '2026-05-15T05:00:00.000Z',
      blockerReason: 'Picker not assigned',
    }
    expect(WarehouseStagingStatusSchema.safeParse(withOptionals).success).toBe(true)
  })

  it('rejects unknown status', () => {
    expect(WarehouseStagingStatusSchema.safeParse({ ...valid, status: 'missing' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// QualityBlockerSchema
// ---------------------------------------------------------------------------
describe('QualityBlockerSchema', () => {
  const valid = {
    blockerId: 'QB-20260515-001',
    type: 'release-hold',
    materialId: 'CHIP-VAR-001',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    severity: 'critical',
    description: 'Batch held pending MIC retest result for Listeria spp.',
    owner: 'quality.lead@kerry.com',
  }

  it('accepts a valid blocker', () => {
    expect(QualityBlockerSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional fields', () => {
    const withOptionals = {
      ...valid,
      batchId: '2026-W20-A',
      processOrderId: '4500837291',
      inspectionLotId: 'IL-240308-001',
      releaseCaseId: 'RC-2026-001847',
      dueAt: '2026-05-15T12:00:00.000Z',
      drillThroughTarget: 'quality-batch-release',
    }
    expect(QualityBlockerSchema.safeParse(withOptionals).success).toBe(true)
  })

  it('rejects unknown type', () => {
    expect(QualityBlockerSchema.safeParse({ ...valid, type: 'audit' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ReleaseHoldImpactSchema
// ---------------------------------------------------------------------------
describe('ReleaseHoldImpactSchema', () => {
  const valid = {
    holdId: 'HOLD-20260515-003',
    batchId: '2026-W20-A',
    materialId: 'CHIP-VAR-001',
    materialDescription: 'Kerry Listowel Mature Cheddar 20kg Block',
    plantId: 'IE10',
    blockedQuantity: 4870,
    affectedOrders: ['4500837291'],
    affectedDeliveries: ['DEL-20260517-001'],
    holdReason: 'MIC retest outstanding — Listeria spp.',
    releaseStatus: 'active',
    qualityOwner: 'quality.lead@kerry.com',
    severity: 'critical',
  }

  it('accepts a valid hold impact', () => {
    expect(ReleaseHoldImpactSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown releaseStatus', () => {
    expect(ReleaseHoldImpactSchema.safeParse({ ...valid, releaseStatus: 'blocked' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LineStatusSchema
// ---------------------------------------------------------------------------
describe('LineStatusSchema', () => {
  const valid = {
    lineId: 'L-04',
    lineName: 'Cheddar Block Line 4',
    status: 'running',
    oee: 76.4,
    speedLossPercent: 8.2,
    downtimeMinutes: 0,
    changeoverStatus: 'not-applicable',
    riskLevel: 'low',
  }

  it('accepts a valid line status', () => {
    expect(LineStatusSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects OEE > 100', () => {
    expect(LineStatusSchema.safeParse({ ...valid, oee: 110 }).success).toBe(false)
  })

  it('rejects unknown riskLevel', () => {
    expect(LineStatusSchema.safeParse({ ...valid, riskLevel: 'severe' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ScheduleAdherenceSummarySchema
// ---------------------------------------------------------------------------
describe('ScheduleAdherenceSummarySchema', () => {
  const valid = {
    planDate: '2026-05-15',
    totalOrders: 24,
    onTimeOrders: 18,
    lateOrders: 2,
    atRiskOrders: 4,
    adherencePercent: 75,
    averageDelayMinutes: 42,
    confidence: 0.82,
  }

  it('accepts a valid summary', () => {
    expect(ScheduleAdherenceSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional worstLine', () => {
    expect(ScheduleAdherenceSummarySchema.safeParse({ ...valid, worstLine: 'L-04' }).success).toBe(true)
  })

  it('rejects adherencePercent > 100', () => {
    expect(ScheduleAdherenceSummarySchema.safeParse({ ...valid, adherencePercent: 101 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// YieldVarianceSummarySchema
// ---------------------------------------------------------------------------
describe('YieldVarianceSummarySchema', () => {
  const valid = {
    processOrderId: '4500837295',
    materialId: 'CHIP-VAR-001',
    lineOrResource: 'L-04',
    plannedYieldPercent: 96.5,
    actualYieldPercent: 91.2,
    variancePercent: -5.3,
    scrapQuantity: 265,
    reworkQuantity: 0,
    lossReason: 'Moisture loss above target — temperature deviation at pasteurisation',
    severity: 'medium',
  }

  it('accepts a valid yield variance', () => {
    expect(YieldVarianceSummarySchema.safeParse(valid).success).toBe(true)
  })

  it('rejects negative scrapQuantity', () => {
    expect(YieldVarianceSummarySchema.safeParse({ ...valid, scrapQuantity: -10 }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// MaintenanceConstraintSchema
// ---------------------------------------------------------------------------
describe('MaintenanceConstraintSchema', () => {
  const valid = {
    constraintId: 'MC-20260515-001',
    assetId: 'ASSET-PRESS-L04-01',
    assetName: 'Block Press Unit 1 — Line 4',
    lineId: 'L-04',
    constraintType: 'breakdown',
    severity: 'high',
    affectedOrders: ['4500837291', '4500837299'],
    status: 'active',
  }

  it('accepts a valid constraint', () => {
    expect(MaintenanceConstraintSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional fields', () => {
    const withOptionals = {
      ...valid,
      workOrderId: 'WO-20260515-007',
      expectedResolutionAt: '2026-05-15T10:00:00.000Z',
    }
    expect(MaintenanceConstraintSchema.safeParse(withOptionals).success).toBe(true)
  })

  it('rejects unknown constraintType', () => {
    expect(MaintenanceConstraintSchema.safeParse({ ...valid, constraintType: 'unknown-type' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// ShiftHandoverItemSchema
// ---------------------------------------------------------------------------
describe('ShiftHandoverItemSchema', () => {
  const valid = {
    handoverId: 'HO-20260515-AM-001',
    shiftId: 'SHIFT-AM',
    createdBy: 'John Murphy',
    createdAt: '2026-05-15T05:55:00.000Z',
    category: 'maintenance',
    title: 'Block press L-04 unit 1 — in breakdown',
    description: 'Block press unit 1 on L-04 went down at 04:30. Maintenance team on site, estimated fix by 10:00.',
    linkedOrders: ['4500837291'],
    linkedLines: ['L-04'],
    severity: 'high',
    status: 'open',
  }

  it('accepts a valid handover item', () => {
    expect(ShiftHandoverItemSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects unknown category', () => {
    expect(ShiftHandoverItemSchema.safeParse({ ...valid, category: 'logistics' }).success).toBe(false)
  })

  it('rejects unknown status', () => {
    expect(ShiftHandoverItemSchema.safeParse({ ...valid, status: 'pending' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// OperationsActionQueueItemSchema
// ---------------------------------------------------------------------------
describe('OperationsActionQueueItemSchema', () => {
  const valid = {
    actionId: 'AQ-20260515-001',
    title: 'Escalate staging request for CHIP-VAR-001',
    description: 'Material shortage of 80 KG is blocking process order 4500837291 — staging required by 08:00.',
    ownerRole: 'operations-supervisor',
    severity: 'high',
    sourcePanel: 'material-shortage',
    linkedEntityType: 'material',
    linkedEntityId: 'CHIP-VAR-001',
    status: 'open',
    recommendedAction: 'Request staging from warehouse via Request Staging action',
  }

  it('accepts a valid action queue item', () => {
    expect(OperationsActionQueueItemSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts optional dueAt', () => {
    const withDue = { ...valid, dueAt: '2026-05-15T08:00:00.000Z' }
    expect(OperationsActionQueueItemSchema.safeParse(withDue).success).toBe(true)
  })

  it('rejects unknown linkedEntityType', () => {
    expect(OperationsActionQueueItemSchema.safeParse({ ...valid, linkedEntityType: 'delivery' }).success).toBe(false)
  })

  it('rejects unknown status', () => {
    expect(OperationsActionQueueItemSchema.safeParse({ ...valid, status: 'cancelled' }).success).toBe(false)
  })
})
