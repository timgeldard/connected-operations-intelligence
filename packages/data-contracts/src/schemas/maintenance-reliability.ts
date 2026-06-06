import { z } from 'zod'

// ---------------------------------------------------------------------------
// MaintenanceReliabilityContext
// ---------------------------------------------------------------------------

export const MaintenanceReliabilityContextSchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  openWorkOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  overduePreventiveMaintenance: z.number().int().min(0).describe('[classification: source-derived]'),
  equipmentAvailabilityPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  maintenanceBacklogHours: z.number().min(0).describe('[classification: source-derived]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
})

export type MaintenanceReliabilityContext = z.infer<typeof MaintenanceReliabilityContextSchema>

// ---------------------------------------------------------------------------
// MaintenanceKpiSummary
// ---------------------------------------------------------------------------

export const MaintenanceKpiSummarySchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  openWorkOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  overdueWorkOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  criticalWorkOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  completedThisShift: z.number().int().min(0).describe('[classification: source-derived]'),
  overduePreventiveMaintenance: z.number().int().min(0).describe('[classification: source-derived]'),
  equipmentAvailabilityPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  targetAvailabilityPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  maintenanceBacklogHours: z.number().min(0).describe('[classification: source-derived]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type MaintenanceKpiSummary = z.infer<typeof MaintenanceKpiSummarySchema>

// ---------------------------------------------------------------------------
// WorkOrder
// ---------------------------------------------------------------------------

export const WorkOrderSchema = z.object({
  workOrderId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  equipmentId: z.string().describe('[classification: source-field]'),
  equipmentDescription: z.string().describe('[classification: source-field]'),
  lineId: z.string().optional().describe('[classification: source-field]'),
  workOrderType: z.enum(['corrective', 'preventive', 'predictive', 'emergency', 'inspection']).describe('[classification: source-field]'),
  status: z.enum(['open', 'in-progress', 'on-hold', 'completed', 'cancelled']).describe('[classification: source-field]'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).describe('[classification: source-field]'),
  plannedStart: z.string().datetime().optional().describe('[classification: source-field]'),
  plannedFinish: z.string().datetime().optional().describe('[classification: source-field]'),
  actualStart: z.string().datetime().optional().describe('[classification: source-field]'),
  estimatedHours: z.number().min(0).describe('[classification: source-field]'),
  assignedTechnician: z.string().optional().describe('[classification: source-field]'),
  productionImpact: z.enum(['line-down', 'reduced-capacity', 'no-impact', 'risk-only']).describe('[classification: source-field]'),
})

export type WorkOrder = z.infer<typeof WorkOrderSchema>

// ---------------------------------------------------------------------------
// PreventiveMaintenanceTask
// ---------------------------------------------------------------------------

export const PreventiveMaintenanceTaskSchema = z.object({
  taskId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  equipmentId: z.string().describe('[classification: source-field]'),
  equipmentDescription: z.string().describe('[classification: source-field]'),
  frequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly', 'annually']).describe('[classification: source-field]'),
  dueDate: z.string().datetime().describe('[classification: source-field]'),
  status: z.enum(['upcoming', 'due-today', 'overdue', 'completed', 'deferred']).describe('[classification: source-field]'),
  daysOverdue: z.number().int().min(0).describe('[classification: application-derived]'),
  estimatedHours: z.number().min(0).describe('[classification: source-field]'),
  assignedTechnician: z.string().optional().describe('[classification: source-field]'),
  linkedWorkOrderId: z.string().optional().describe('[classification: source-field]'),
})

export type PreventiveMaintenanceTask = z.infer<typeof PreventiveMaintenanceTaskSchema>

// ---------------------------------------------------------------------------
// EquipmentAvailability
// ---------------------------------------------------------------------------

export const EquipmentAvailabilitySchema = z.object({
  equipmentId: z.string().describe('[classification: source-field]'),
  equipmentDescription: z.string().describe('[classification: source-field]'),
  lineId: z.string().optional().describe('[classification: source-field]'),
  availabilityPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  targetPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  plannedDowntimeMinutes: z.number().min(0).describe('[classification: source-derived]'),
  unplannedDowntimeMinutes: z.number().min(0).describe('[classification: source-derived]'),
  currentStatus: z.enum(['running', 'planned-down', 'unplanned-down', 'standby', 'maintenance']).describe('[classification: application-heuristic]'),
  openWorkOrderCount: z.number().int().min(0).describe('[classification: source-derived]'),
})

export type EquipmentAvailability = z.infer<typeof EquipmentAvailabilitySchema>

// ---------------------------------------------------------------------------
// ReliabilityMetric
// ---------------------------------------------------------------------------

export const ReliabilityMetricSchema = z.object({
  equipmentId: z.string().describe('[classification: source-field]'),
  equipmentDescription: z.string().describe('[classification: source-field]'),
  mtbfHours: z.number().min(0).describe('[classification: source-derived]'),
  mttrHours: z.number().min(0).describe('[classification: source-derived]'),
  failureCount: z.number().int().min(0).describe('[classification: source-derived]'),
  oeeImpactPercent: z.number().min(0).max(100).describe('[classification: application-derived]'),
  trendDirection: z.enum(['improving', 'stable', 'degrading']).describe('[classification: application-heuristic]'),
  periodDays: z.number().int().min(1).describe('[classification: source-derived]'),
})

export type ReliabilityMetric = z.infer<typeof ReliabilityMetricSchema>

// ---------------------------------------------------------------------------
// MaintenanceBacklogItem
// ---------------------------------------------------------------------------

export const MaintenanceBacklogItemSchema = z.object({
  backlogId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  equipmentId: z.string().describe('[classification: source-field]'),
  equipmentDescription: z.string().describe('[classification: source-field]'),
  deferredFrom: z.string().datetime().describe('[classification: source-field]'),
  deferredReason: z.string().describe('[classification: source-field]'),
  estimatedHours: z.number().min(0).describe('[classification: source-field]'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).describe('[classification: source-field]'),
  productionImpact: z.enum(['line-down', 'reduced-capacity', 'no-impact', 'risk-only']).describe('[classification: source-field]'),
  targetCompletionDate: z.string().datetime().optional().describe('[classification: source-field]'),
})

export type MaintenanceBacklogItem = z.infer<typeof MaintenanceBacklogItemSchema>
