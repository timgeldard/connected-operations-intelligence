import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// ProductionStagingContext
// ---------------------------------------------------------------------------

export const ProductionStagingContextSchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  warehouseName: z.string().describe('[classification: source-field]'),
  planDate: z.string().date().describe('[classification: source-field]'),
  totalOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  stagedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  partialOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  openShortfalls: z.number().int().min(0).describe('[classification: source-derived]'),
  openMoveRequests: z.number().int().min(0).describe('[classification: source-derived]'),
  overallReadinessPercent: z.number().min(0).max(100).describe('[classification: application-derived]'),
  riskStatus: z.enum(['ready', 'at-risk', 'blocked', 'unknown']).describe('[classification: application-heuristic]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
})

export type ProductionStagingContext = z.infer<typeof ProductionStagingContextSchema>

// ---------------------------------------------------------------------------
// StagingOrderSummary
// ---------------------------------------------------------------------------

export const StagingOrderSummarySchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  lineOrResource: z.string().describe('[classification: source-field]'),
  plannedStart: z.string().datetime().describe('[classification: source-field]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  stagedQuantity: z.number().describe('[classification: source-field]'),
  shortfallQuantity: z.number().describe('[classification: source-derived]'),
  uom: z.string().describe('[classification: source-field]'),
  stagingArea: z.string().describe('[classification: source-field]'),
  status: z.enum(['not-staged', 'partial', 'staged', 'blocked', 'not-required']).describe('[classification: source-field]'),
  urgency: SeveritySchema.describe('[classification: source-derived]'),
  pickTaskIds: z.array(z.string()).describe('[classification: source-field]'),
  blockerReason: z.string().optional().describe('[classification: source-field]'),
})

export type StagingOrderSummary = z.infer<typeof StagingOrderSummarySchema>

// ---------------------------------------------------------------------------
// StagingPickTask
// ---------------------------------------------------------------------------

export const StagingPickTaskSchema = z.object({
  taskId: z.string().describe('[classification: source-field]'),
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  storageLocation: z.string().describe('[classification: source-field]'),
  destinationLocation: z.string().describe('[classification: source-field]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  pickedQuantity: z.number().describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  assignee: z.string().optional().describe('[classification: source-field]'),
  status: z.enum(['open', 'in-progress', 'picked', 'staged', 'cancelled']).describe('[classification: source-field]'),
  priority: SeveritySchema.describe('[classification: source-field]'),
  createdAt: z.string().datetime().describe('[classification: source-field]'),
  completedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
})

export type StagingPickTask = z.infer<typeof StagingPickTaskSchema>

// ---------------------------------------------------------------------------
// StagingZoneCapacity
// ---------------------------------------------------------------------------

export const StagingZoneCapacitySchema = z.object({
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  capacityPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  pendingOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  stagedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  status: z.enum(['available', 'high-utilisation', 'full', 'blocked']).describe('[classification: application-heuristic]'),
  overflowRisk: z.boolean().describe('[classification: application-heuristic]'),
})

export type StagingZoneCapacity = z.infer<typeof StagingZoneCapacitySchema>

// ---------------------------------------------------------------------------
// StagingShortfall
// ---------------------------------------------------------------------------

export const StagingShortfallSchema = z.object({
  shortfallId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  availableQuantity: z.number().describe('[classification: source-field]'),
  shortfallQuantity: z.number().describe('[classification: source-derived]'),
  uom: z.string().describe('[classification: source-field]'),
  affectedOrders: z.array(z.string()).describe('[classification: source-field]'),
  urgency: SeveritySchema.describe('[classification: source-derived]'),
  procurementStatus: z.enum(['in-stock', 'in-transit', 'ordered', 'delayed', 'out-of-stock', 'unknown']).describe('[classification: application-heuristic]'),
  expectedArrival: z.string().datetime().optional().describe('[classification: source-field]'),
  canBeSubstituted: z.boolean().describe('[classification: source-derived]'),
})

export type StagingShortfall = z.infer<typeof StagingShortfallSchema>

// ---------------------------------------------------------------------------
// StagingMoveRequest
// ---------------------------------------------------------------------------

export const StagingMoveRequestSchema = z.object({
  requestId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  fromLocation: z.string().describe('[classification: source-field]'),
  toLocation: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  quantity: z.number().describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  processOrderId: z.string().optional().describe('[classification: source-field]'),
  requestedBy: z.string().describe('[classification: source-field]'),
  assignedTo: z.string().optional().describe('[classification: source-field]'),
  status: z.enum(['open', 'assigned', 'in-transit', 'completed', 'cancelled']).describe('[classification: source-field]'),
  priority: SeveritySchema.describe('[classification: source-field]'),
  createdAt: z.string().datetime().describe('[classification: source-field]'),
  completedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  reason: z.string().describe('[classification: source-field]'),
})

export type StagingMoveRequest = z.infer<typeof StagingMoveRequestSchema>

// ---------------------------------------------------------------------------
// StagingReadinessSummary
// ---------------------------------------------------------------------------

export const StagingReadinessSummarySchema = z.object({
  planDate: z.string().date().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  totalOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  fullyStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  partiallyStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  notStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  blocked: z.number().int().min(0).describe('[classification: source-derived]'),
  percentReady: z.number().min(0).max(100).describe('[classification: application-derived]'),
  openShortfalls: z.number().int().min(0).describe('[classification: source-derived]'),
  pendingPickTasks: z.number().int().min(0).describe('[classification: source-derived]'),
  openMoveRequests: z.number().int().min(0).describe('[classification: source-derived]'),
  riskStatus: z.enum(['ready', 'at-risk', 'blocked', 'unknown']).describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type StagingReadinessSummary = z.infer<typeof StagingReadinessSummarySchema>

// ---------------------------------------------------------------------------
// StagingPickingWave
// ---------------------------------------------------------------------------

export const StagingPickingWaveSchema = z.object({
  waveId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  planDate: z.string().date().describe('[classification: source-field]'),
  waveLabel: z.string().describe('[classification: source-field]'),
  includedOrders: z.array(z.string()).describe('[classification: source-field]'),
  totalTasks: z.number().int().min(0).describe('[classification: source-derived]'),
  completedTasks: z.number().int().min(0).describe('[classification: source-derived]'),
  status: z.enum(['planned', 'in-progress', 'completed', 'partial', 'cancelled']).describe('[classification: source-field]'),
  scheduledStart: z.string().datetime().optional().describe('[classification: source-field]'),
  actualStart: z.string().datetime().optional().describe('[classification: source-field]'),
  estimatedCompletion: z.string().datetime().optional().describe('[classification: source-field]'),
  actualCompletion: z.string().datetime().optional().describe('[classification: source-field]'),
  assignedTeam: z.string().optional().describe('[classification: source-field]'),
})

export type StagingPickingWave = z.infer<typeof StagingPickingWaveSchema>

// ---------------------------------------------------------------------------
// StagingAlert
// ---------------------------------------------------------------------------

export const StagingAlertSchema = z.object({
  alertId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  alertType: z.enum(['shortfall', 'overdue-pick', 'zone-capacity', 'move-delay', 'blocked-order', 'other']).describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  processOrderId: z.string().optional().describe('[classification: source-field]'),
  materialId: z.string().optional().describe('[classification: source-field]'),
  zoneId: z.string().optional().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  recommendedAction: z.string().describe('[classification: application-heuristic]'),
  raisedAt: z.string().datetime().describe('[classification: source-field]'),
  resolvedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  status: z.enum(['open', 'acknowledged', 'in-progress', 'resolved']).describe('[classification: source-field]'),
  owner: z.string().optional().describe('[classification: source-field]'),
})

export type StagingAlert = z.infer<typeof StagingAlertSchema>
