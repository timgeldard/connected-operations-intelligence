import { describe, it, expect } from 'vitest'
import {
  ProductionStagingContextSchema,
  StagingOrderSummarySchema,
  StagingPickTaskSchema,
  StagingZoneCapacitySchema,
  StagingShortfallSchema,
  StagingMoveRequestSchema,
  StagingReadinessSummarySchema,
  StagingPickingWaveSchema,
  StagingAlertSchema,
} from './production-staging.js'

describe('ProductionStagingContextSchema', () => {
  it('accepts valid context', () => {
    const result = ProductionStagingContextSchema.safeParse({
      plantId: 'IE10',
      warehouseId: 'WH-IE10-01',
      warehouseName: 'Listowel Central Warehouse',
      planDate: '2024-03-08',
      totalOrders: 18,
      stagedOrders: 12,
      partialOrders: 3,
      blockedOrders: 1,
      openShortfalls: 2,
      openMoveRequests: 4,
      overallReadinessPercent: 66.7,
      riskStatus: 'at-risk',
      lastUpdatedAt: '2024-03-08T15:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid riskStatus', () => {
    const result = ProductionStagingContextSchema.safeParse({
      plantId: 'IE10',
      warehouseId: 'WH01',
      warehouseName: 'Test',
      planDate: '2024-03-08',
      totalOrders: 1,
      stagedOrders: 0,
      partialOrders: 0,
      blockedOrders: 0,
      openShortfalls: 0,
      openMoveRequests: 0,
      overallReadinessPercent: 0,
      riskStatus: 'green',
      lastUpdatedAt: '2024-03-08T15:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('StagingOrderSummarySchema', () => {
  it('accepts valid staging order', () => {
    const result = StagingOrderSummarySchema.safeParse({
      processOrderId: 'PO-001',
      materialId: 'MAT-100',
      materialDescription: 'Kerry Gold Butter 500g',
      batchId: 'BATCH-001',
      plantId: 'IE10',
      lineOrResource: 'LINE-A1',
      plannedStart: '2024-03-08T06:00:00.000Z',
      requiredQuantity: 1000,
      stagedQuantity: 800,
      shortfallQuantity: 200,
      uom: 'KG',
      stagingArea: 'SA-01',
      status: 'partial',
      urgency: 'high',
      pickTaskIds: ['TASK-001', 'TASK-002'],
    })
    expect(result.success).toBe(true)
  })
})

describe('StagingPickTaskSchema', () => {
  it('accepts valid pick task', () => {
    const result = StagingPickTaskSchema.safeParse({
      taskId: 'TASK-001',
      processOrderId: 'PO-001',
      materialId: 'MAT-100',
      materialDescription: 'Kerry Gold Butter 500g',
      warehouseId: 'WH-IE10-01',
      storageLocation: 'A-01-01',
      destinationLocation: 'SA-01',
      requiredQuantity: 500,
      pickedQuantity: 0,
      uom: 'KG',
      status: 'open',
      priority: 'high',
      createdAt: '2024-03-08T05:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('StagingZoneCapacitySchema', () => {
  it('accepts valid zone capacity', () => {
    const result = StagingZoneCapacitySchema.safeParse({
      zoneId: 'SA-01',
      zoneName: 'Staging Area 1',
      warehouseId: 'WH-IE10-01',
      capacityPercent: 85,
      pendingOrders: 6,
      stagedOrders: 12,
      blockedOrders: 1,
      status: 'high-utilisation',
      overflowRisk: true,
    })
    expect(result.success).toBe(true)
  })
})

describe('StagingShortfallSchema', () => {
  it('accepts valid shortfall', () => {
    const result = StagingShortfallSchema.safeParse({
      shortfallId: 'SF-001',
      materialId: 'MAT-200',
      materialDescription: 'Packaging Film Roll',
      plantId: 'IE10',
      warehouseId: 'WH-IE10-01',
      requiredQuantity: 50,
      availableQuantity: 20,
      shortfallQuantity: 30,
      uom: 'ROLL',
      affectedOrders: ['PO-003', 'PO-005'],
      urgency: 'high',
      procurementStatus: 'ordered',
      canBeSubstituted: false,
    })
    expect(result.success).toBe(true)
  })
})

describe('StagingMoveRequestSchema', () => {
  it('accepts valid move request', () => {
    const result = StagingMoveRequestSchema.safeParse({
      requestId: 'MV-001',
      warehouseId: 'WH-IE10-01',
      fromLocation: 'B-03-05',
      toLocation: 'SA-01',
      materialId: 'MAT-100',
      materialDescription: 'Kerry Gold Butter 500g',
      quantity: 200,
      uom: 'KG',
      requestedBy: 'ops.supervisor@listowel.ie',
      status: 'assigned',
      priority: 'medium',
      createdAt: '2024-03-08T07:00:00.000Z',
      reason: 'Staging shortfall for PO-001',
    })
    expect(result.success).toBe(true)
  })
})

describe('StagingReadinessSummarySchema', () => {
  it('accepts valid readiness summary', () => {
    const result = StagingReadinessSummarySchema.safeParse({
      planDate: '2024-03-08',
      warehouseId: 'WH-IE10-01',
      totalOrders: 18,
      fullyStaged: 12,
      partiallyStaged: 3,
      notStaged: 2,
      blocked: 1,
      percentReady: 66.7,
      openShortfalls: 2,
      pendingPickTasks: 8,
      openMoveRequests: 4,
      riskStatus: 'at-risk',
      confidence: 0.88,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence out of range', () => {
    const result = StagingReadinessSummarySchema.safeParse({
      planDate: '2024-03-08',
      warehouseId: 'WH01',
      totalOrders: 1,
      fullyStaged: 0,
      partiallyStaged: 0,
      notStaged: 1,
      blocked: 0,
      percentReady: 0,
      openShortfalls: 0,
      pendingPickTasks: 0,
      openMoveRequests: 0,
      riskStatus: 'blocked',
      confidence: -0.1,
    })
    expect(result.success).toBe(false)
  })
})

describe('StagingPickingWaveSchema', () => {
  it('accepts valid picking wave', () => {
    const result = StagingPickingWaveSchema.safeParse({
      waveId: 'WAVE-001',
      warehouseId: 'WH-IE10-01',
      planDate: '2024-03-08',
      waveLabel: 'Early Morning Wave',
      includedOrders: ['PO-001', 'PO-002', 'PO-003'],
      totalTasks: 12,
      completedTasks: 8,
      status: 'in-progress',
      scheduledStart: '2024-03-08T05:30:00.000Z',
      actualStart: '2024-03-08T05:35:00.000Z',
    })
    expect(result.success).toBe(true)
  })
})

describe('StagingAlertSchema', () => {
  it('accepts valid staging alert', () => {
    const result = StagingAlertSchema.safeParse({
      alertId: 'SA-ALT-001',
      warehouseId: 'WH-IE10-01',
      alertType: 'shortfall',
      severity: 'high',
      processOrderId: 'PO-003',
      materialId: 'MAT-200',
      description: 'Material shortfall will delay PO-003 start by 2 hours',
      recommendedAction: 'Expedite delivery from supplier or identify substitution',
      raisedAt: '2024-03-08T06:30:00.000Z',
      status: 'open',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid alertType', () => {
    const result = StagingAlertSchema.safeParse({
      alertId: 'SA-ALT-002',
      warehouseId: 'WH01',
      alertType: 'inventory-discrepancy',
      severity: 'low',
      description: 'Test',
      recommendedAction: 'Check',
      raisedAt: '2024-03-08T06:30:00.000Z',
      status: 'open',
    })
    expect(result.success).toBe(false)
  })
})
