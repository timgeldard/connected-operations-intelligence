import { describe, it, expect } from 'vitest'
import {
  MaintenanceReliabilityContextSchema,
  MaintenanceKpiSummarySchema,
  WorkOrderSchema,
  PreventiveMaintenanceTaskSchema,
  EquipmentAvailabilitySchema,
  ReliabilityMetricSchema,
  MaintenanceBacklogItemSchema,
} from './maintenance-reliability.js'

describe('MaintenanceReliabilityContextSchema', () => {
  it('accepts a valid context', () => {
    const result = MaintenanceReliabilityContextSchema.safeParse({
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      openWorkOrders: 14,
      overduePreventiveMaintenance: 3,
      equipmentAvailabilityPercent: 91.2,
      maintenanceBacklogHours: 142,
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects equipmentAvailabilityPercent > 100', () => {
    const result = MaintenanceReliabilityContextSchema.safeParse({
      plantId: 'IE10',
      plantName: 'Kerry Listowel',
      openWorkOrders: 14,
      overduePreventiveMaintenance: 3,
      equipmentAvailabilityPercent: 110,
      maintenanceBacklogHours: 142,
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing plantId', () => {
    const result = MaintenanceReliabilityContextSchema.safeParse({
      plantName: 'Kerry Listowel',
      openWorkOrders: 5,
      overduePreventiveMaintenance: 0,
      equipmentAvailabilityPercent: 90,
      maintenanceBacklogHours: 50,
      lastUpdatedAt: '2024-03-08T10:00:00.000Z',
    })
    expect(result.success).toBe(false)
  })
})

describe('MaintenanceKpiSummarySchema', () => {
  it('accepts valid KPI summary', () => {
    const result = MaintenanceKpiSummarySchema.safeParse({
      plantId: 'IE10',
      openWorkOrders: 14,
      overdueWorkOrders: 4,
      criticalWorkOrders: 2,
      completedThisShift: 3,
      overduePreventiveMaintenance: 3,
      equipmentAvailabilityPercent: 91.2,
      targetAvailabilityPercent: 95,
      maintenanceBacklogHours: 142,
      confidence: 0.91,
    })
    expect(result.success).toBe(true)
  })

  it('rejects confidence > 1', () => {
    const result = MaintenanceKpiSummarySchema.safeParse({
      plantId: 'IE10',
      openWorkOrders: 10,
      overdueWorkOrders: 2,
      criticalWorkOrders: 1,
      completedThisShift: 2,
      overduePreventiveMaintenance: 1,
      equipmentAvailabilityPercent: 90,
      targetAvailabilityPercent: 95,
      maintenanceBacklogHours: 100,
      confidence: 1.5,
    })
    expect(result.success).toBe(false)
  })
})

describe('WorkOrderSchema', () => {
  it('accepts valid work order', () => {
    const result = WorkOrderSchema.safeParse({
      workOrderId: 'WO-2024-01847',
      title: 'PHE gasket replacement',
      equipmentId: 'EQ-IE10-PHE-001',
      equipmentDescription: 'Plate Heat Exchanger — Pasteurisation',
      workOrderType: 'corrective',
      status: 'open',
      priority: 'critical',
      estimatedHours: 4,
      productionImpact: 'line-down',
    })
    expect(result.success).toBe(true)
  })

  it('accepts work order with optional fields', () => {
    const result = WorkOrderSchema.safeParse({
      workOrderId: 'WO-2024-01848',
      title: 'Routine inspection',
      equipmentId: 'EQ-IE10-COMP-002',
      equipmentDescription: 'Air Compressor 2',
      lineId: 'LINE-02',
      workOrderType: 'inspection',
      status: 'in-progress',
      priority: 'low',
      plannedStart: '2024-03-09T08:00:00.000Z',
      plannedFinish: '2024-03-09T10:00:00.000Z',
      actualStart: '2024-03-09T08:15:00.000Z',
      estimatedHours: 2,
      assignedTechnician: 'John Murphy',
      productionImpact: 'no-impact',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid workOrderType', () => {
    const result = WorkOrderSchema.safeParse({
      workOrderId: 'WO-001',
      title: 'Test',
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      workOrderType: 'scheduled',
      status: 'open',
      priority: 'medium',
      estimatedHours: 1,
      productionImpact: 'no-impact',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid priority', () => {
    const result = WorkOrderSchema.safeParse({
      workOrderId: 'WO-001',
      title: 'Test',
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      workOrderType: 'corrective',
      status: 'open',
      priority: 'urgent',
      estimatedHours: 1,
      productionImpact: 'no-impact',
    })
    expect(result.success).toBe(false)
  })
})

describe('PreventiveMaintenanceTaskSchema', () => {
  it('accepts valid PM task', () => {
    const result = PreventiveMaintenanceTaskSchema.safeParse({
      taskId: 'PM-IE10-2024-0312',
      title: 'Monthly lubrication — filler head bearings',
      equipmentId: 'EQ-IE10-FILL-001',
      equipmentDescription: 'Filler Head Assembly',
      frequency: 'monthly',
      dueDate: '2024-03-08T00:00:00.000Z',
      status: 'overdue',
      daysOverdue: 2,
      estimatedHours: 1.5,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid frequency', () => {
    const result = PreventiveMaintenanceTaskSchema.safeParse({
      taskId: 'PM-001',
      title: 'Task',
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      frequency: 'bi-annual',
      dueDate: '2024-03-08T00:00:00.000Z',
      status: 'upcoming',
      daysOverdue: 0,
      estimatedHours: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = PreventiveMaintenanceTaskSchema.safeParse({
      taskId: 'PM-001',
      title: 'Task',
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      frequency: 'weekly',
      dueDate: '2024-03-08T00:00:00.000Z',
      status: 'pending',
      daysOverdue: 0,
      estimatedHours: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('EquipmentAvailabilitySchema', () => {
  it('accepts valid equipment availability', () => {
    const result = EquipmentAvailabilitySchema.safeParse({
      equipmentId: 'EQ-IE10-PHE-001',
      equipmentDescription: 'Plate Heat Exchanger',
      availabilityPercent: 88.5,
      targetPercent: 95,
      plannedDowntimeMinutes: 30,
      unplannedDowntimeMinutes: 60,
      currentStatus: 'running',
      openWorkOrderCount: 2,
    })
    expect(result.success).toBe(true)
  })

  it('rejects availabilityPercent > 100', () => {
    const result = EquipmentAvailabilitySchema.safeParse({
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      availabilityPercent: 105,
      targetPercent: 95,
      plannedDowntimeMinutes: 0,
      unplannedDowntimeMinutes: 0,
      currentStatus: 'running',
      openWorkOrderCount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid currentStatus', () => {
    const result = EquipmentAvailabilitySchema.safeParse({
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      availabilityPercent: 90,
      targetPercent: 95,
      plannedDowntimeMinutes: 0,
      unplannedDowntimeMinutes: 0,
      currentStatus: 'offline',
      openWorkOrderCount: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('ReliabilityMetricSchema', () => {
  it('accepts valid reliability metric', () => {
    const result = ReliabilityMetricSchema.safeParse({
      equipmentId: 'EQ-IE10-PHE-001',
      equipmentDescription: 'Plate Heat Exchanger',
      mtbfHours: 312,
      mttrHours: 4.2,
      failureCount: 3,
      oeeImpactPercent: 8.4,
      trendDirection: 'stable',
      periodDays: 90,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid trendDirection', () => {
    const result = ReliabilityMetricSchema.safeParse({
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      mtbfHours: 200,
      mttrHours: 2,
      failureCount: 1,
      oeeImpactPercent: 5,
      trendDirection: 'worsening',
      periodDays: 30,
    })
    expect(result.success).toBe(false)
  })

  it('rejects periodDays < 1', () => {
    const result = ReliabilityMetricSchema.safeParse({
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      mtbfHours: 200,
      mttrHours: 2,
      failureCount: 1,
      oeeImpactPercent: 5,
      trendDirection: 'stable',
      periodDays: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe('MaintenanceBacklogItemSchema', () => {
  it('accepts valid backlog item', () => {
    const result = MaintenanceBacklogItemSchema.safeParse({
      backlogId: 'BL-2024-0047',
      title: 'Conveyor belt tension adjustment',
      equipmentId: 'EQ-IE10-CONV-003',
      equipmentDescription: 'Conveyor Line 3',
      deferredFrom: '2024-02-15T00:00:00.000Z',
      deferredReason: 'Deferred pending spare parts delivery',
      estimatedHours: 3,
      priority: 'medium',
      productionImpact: 'reduced-capacity',
    })
    expect(result.success).toBe(true)
  })

  it('accepts backlog item with targetCompletionDate', () => {
    const result = MaintenanceBacklogItemSchema.safeParse({
      backlogId: 'BL-2024-0048',
      title: 'Pump seal replacement',
      equipmentId: 'EQ-IE10-PUMP-002',
      equipmentDescription: 'CIP Pump 2',
      deferredFrom: '2024-01-20T00:00:00.000Z',
      deferredReason: 'Awaiting planned shutdown window',
      estimatedHours: 6,
      priority: 'high',
      productionImpact: 'line-down',
      targetCompletionDate: '2024-03-15T00:00:00.000Z',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid productionImpact', () => {
    const result = MaintenanceBacklogItemSchema.safeParse({
      backlogId: 'BL-001',
      title: 'Task',
      equipmentId: 'EQ-001',
      equipmentDescription: 'Equipment',
      deferredFrom: '2024-01-01T00:00:00.000Z',
      deferredReason: 'Deferred',
      estimatedHours: 2,
      priority: 'low',
      productionImpact: 'minor-impact',
    })
    expect(result.success).toBe(false)
  })
})
