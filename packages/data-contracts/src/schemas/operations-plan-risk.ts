import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// OperationsPlanRiskContext
// ---------------------------------------------------------------------------

export const OperationsPlanRiskContextSchema = z.object({
  planDate: z.string().date().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  lineIds: z.array(z.string()).describe('[classification: source-field]'),
  shiftId: z.string().describe('[classification: source-field]'),
  supervisor: z.string().describe('[classification: source-field]'),
  riskStatus: z.enum(['on-track', 'at-risk', 'critical', 'unknown']).describe('[classification: application-heuristic]'),
  highestSeverity: SeveritySchema.describe('[classification: source-derived]'),
  openBlockers: z.number().int().min(0).describe('[classification: source-derived]'),
  lateOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  materialShortages: z.number().int().min(0).describe('[classification: source-derived]'),
  qualityBlockers: z.number().int().min(0).describe('[classification: source-derived]'),
  stagingBlockers: z.number().int().min(0).describe('[classification: source-derived]'),
  maintenanceConstraints: z.number().int().min(0).describe('[classification: source-derived]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
  activeScope: z.string().describe('[classification: application-derived]'),
  activeView: z.string().describe('[classification: application-derived]'),
})

export type OperationsPlanRiskContext = z.infer<typeof OperationsPlanRiskContextSchema>

// ---------------------------------------------------------------------------
// PlanRiskSummary
// ---------------------------------------------------------------------------

export const PlanRiskSummarySchema = z.object({
  planDate: z.string().date().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plannedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  ordersOnTrack: z.number().int().min(0).describe('[classification: source-derived]'),
  ordersAtRisk: z.number().int().min(0).describe('[classification: source-derived]'),
  ordersLate: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  highestSeverity: SeveritySchema.describe('[classification: source-derived]'),
  topRiskReason: z.string().describe('[classification: application-heuristic]'),
  recommendedAction: z.string().describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type PlanRiskSummary = z.infer<typeof PlanRiskSummarySchema>

// ---------------------------------------------------------------------------
// LateOrder
// ---------------------------------------------------------------------------

export const LateOrderSchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  lineOrResource: z.string().describe('[classification: source-field]'),
  plannedStart: z.string().datetime().describe('[classification: source-field]'),
  plannedFinish: z.string().datetime().describe('[classification: source-field]'),
  actualStart: z.string().datetime().optional().describe('[classification: source-field]'),
  estimatedFinish: z.string().datetime().optional().describe('[classification: source-field]'),
  delayMinutes: z.number().int().describe('[classification: source-derived]'),
  delayReason: z.string().describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  owner: z.string().describe('[classification: source-field]'),
})

export type LateOrder = z.infer<typeof LateOrderSchema>

// ---------------------------------------------------------------------------
// MaterialShortage
// ---------------------------------------------------------------------------

export const MaterialShortageSchema = z.object({
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  availableQuantity: z.number().describe('[classification: source-field]'),
  shortageQuantity: z.number().describe('[classification: source-derived]'),
  uom: z.string().describe('[classification: source-field]'),
  requiredBy: z.string().datetime().describe('[classification: source-field]'),
  affectedOrders: z.array(z.string()).describe('[classification: source-field]'),
  stagingStatus: z.enum(['not-staged', 'partial', 'staged', 'not-required']).describe('[classification: source-field]'),
  procurementStatus: z.enum(['in-stock', 'ordered', 'delayed', 'out-of-stock', 'unknown']).describe('[classification: application-heuristic]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
})

export type MaterialShortage = z.infer<typeof MaterialShortageSchema>

// ---------------------------------------------------------------------------
// WarehouseStagingStatus
// ---------------------------------------------------------------------------

export const WarehouseStagingStatusSchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  stagedQuantity: z.number().describe('[classification: source-field]'),
  missingQuantity: z.number().describe('[classification: source-derived]'),
  uom: z.string().describe('[classification: source-field]'),
  transferRequirementId: z.string().optional().describe('[classification: source-field]'),
  stagingArea: z.string().describe('[classification: source-field]'),
  status: z.enum(['pending', 'in-progress', 'staged', 'partial', 'blocked', 'not-required']).describe('[classification: source-field]'),
  lastMovementAt: z.string().datetime().optional().describe('[classification: source-field]'),
  blockerReason: z.string().optional().describe('[classification: source-field]'),
})

export type WarehouseStagingStatus = z.infer<typeof WarehouseStagingStatusSchema>

// ---------------------------------------------------------------------------
// QualityBlocker
// ---------------------------------------------------------------------------

export const QualityBlockerSchema = z.object({
  blockerId: z.string().describe('[classification: source-field]'),
  type: z.enum(['inspection-lot', 'release-hold', 'deviation', 'spc-alarm', 'coa-incomplete', 'other']).describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  processOrderId: z.string().optional().describe('[classification: source-field]'),
  inspectionLotId: z.string().optional().describe('[classification: source-field]'),
  releaseCaseId: z.string().optional().describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  description: z.string().describe('[classification: source-field]'),
  owner: z.string().describe('[classification: source-field]'),
  dueAt: z.string().datetime().optional().describe('[classification: source-field]'),
  drillThroughTarget: z.string().optional().describe('[classification: application-derived]'),
})

export type QualityBlocker = z.infer<typeof QualityBlockerSchema>

// ---------------------------------------------------------------------------
// ReleaseHoldImpact
// ---------------------------------------------------------------------------

export const ReleaseHoldImpactSchema = z.object({
  holdId: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  blockedQuantity: z.number().describe('[classification: source-field]'),
  affectedOrders: z.array(z.string()).describe('[classification: source-field]'),
  affectedDeliveries: z.array(z.string()).describe('[classification: source-field]'),
  holdReason: z.string().describe('[classification: source-field]'),
  releaseStatus: z.enum(['active', 'pending-release', 'released', 'escalated']).describe('[classification: governance-pending]'),
  qualityOwner: z.string().describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
})

export type ReleaseHoldImpact = z.infer<typeof ReleaseHoldImpactSchema>

// ---------------------------------------------------------------------------
// LineStatus
// ---------------------------------------------------------------------------

export const LineStatusSchema = z.object({
  lineId: z.string().describe('[classification: source-field]'),
  lineName: z.string().describe('[classification: source-field]'),
  currentOrderId: z.string().optional().describe('[classification: source-field]'),
  currentMaterial: z.string().optional().describe('[classification: source-field]'),
  status: z.enum(['running', 'idle', 'changeover', 'downtime', 'planned-stop', 'unknown']).describe('[classification: application-heuristic]'),
  oee: z.number().min(0).max(100).describe('[classification: application-derived]'),
  speedLossPercent: z.number().min(0).max(100).describe('[classification: application-derived]'),
  downtimeMinutes: z.number().int().min(0).describe('[classification: source-derived]'),
  changeoverStatus: z.enum(['not-applicable', 'pending', 'in-progress', 'complete']).describe('[classification: source-derived]'),
  nextOrderId: z.string().optional().describe('[classification: source-field]'),
  riskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']).describe('[classification: application-heuristic]'),
})

export type LineStatus = z.infer<typeof LineStatusSchema>

// ---------------------------------------------------------------------------
// ScheduleAdherenceSummary
// ---------------------------------------------------------------------------

export const ScheduleAdherenceSummarySchema = z.object({
  planDate: z.string().date().describe('[classification: source-field]'),
  totalOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  onTimeOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  lateOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  atRiskOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  adherencePercent: z.number().min(0).max(100).describe('[classification: application-derived]'),
  averageDelayMinutes: z.number().describe('[classification: source-derived]'),
  worstLine: z.string().optional().describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type ScheduleAdherenceSummary = z.infer<typeof ScheduleAdherenceSummarySchema>

// ---------------------------------------------------------------------------
// YieldVarianceSummary
// ---------------------------------------------------------------------------

export const YieldVarianceSummarySchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  lineOrResource: z.string().describe('[classification: source-field]'),
  plannedYieldPercent: z.number().min(0).max(200).describe('[classification: source-derived]'),
  actualYieldPercent: z.number().min(0).max(200).describe('[classification: source-derived]'),
  variancePercent: z.number().describe('[classification: source-derived]'),
  scrapQuantity: z.number().min(0).describe('[classification: source-field]'),
  reworkQuantity: z.number().min(0).describe('[classification: source-field]'),
  lossReason: z.string().describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
})

export type YieldVarianceSummary = z.infer<typeof YieldVarianceSummarySchema>

// ---------------------------------------------------------------------------
// MaintenanceConstraint
// ---------------------------------------------------------------------------

export const MaintenanceConstraintSchema = z.object({
  constraintId: z.string().describe('[classification: source-field]'),
  assetId: z.string().describe('[classification: source-field]'),
  assetName: z.string().describe('[classification: source-field]'),
  lineId: z.string().describe('[classification: source-field]'),
  workOrderId: z.string().optional().describe('[classification: source-field]'),
  constraintType: z.enum(['planned-pm', 'breakdown', 'inspection', 'calibration', 'permit-required', 'other']).describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  expectedResolutionAt: z.string().datetime().optional().describe('[classification: source-field]'),
  affectedOrders: z.array(z.string()).describe('[classification: source-field]'),
  status: z.enum(['active', 'scheduled', 'in-progress', 'resolved', 'overdue']).describe('[classification: source-field]'),
})

export type MaintenanceConstraint = z.infer<typeof MaintenanceConstraintSchema>

// ---------------------------------------------------------------------------
// ShiftHandoverItem
// ---------------------------------------------------------------------------

export const ShiftHandoverItemSchema = z.object({
  handoverId: z.string().describe('[classification: source-field]'),
  shiftId: z.string().describe('[classification: source-field]'),
  createdBy: z.string().describe('[classification: source-field]'),
  createdAt: z.string().datetime().describe('[classification: source-field]'),
  category: z.enum(['quality', 'safety', 'maintenance', 'operations', 'material', 'other']).describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  linkedOrders: z.array(z.string()).describe('[classification: source-field]'),
  linkedLines: z.array(z.string()).describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  status: z.enum(['open', 'acknowledged', 'in-progress', 'resolved']).describe('[classification: source-field]'),
})

export type ShiftHandoverItem = z.infer<typeof ShiftHandoverItemSchema>

// ---------------------------------------------------------------------------
// OperationsActionQueueItem
// ---------------------------------------------------------------------------

export const OperationsActionQueueItemSchema = z.object({
  actionId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  ownerRole: z.string().describe('[classification: source-field]'),
  dueAt: z.string().datetime().optional().describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  sourcePanel: z.string().describe('[classification: application-derived]'),
  linkedEntityType: z.enum(['process-order', 'line', 'material', 'batch', 'asset', 'handover', 'other']).describe('[classification: source-field]'),
  linkedEntityId: z.string().describe('[classification: source-field]'),
  status: z.enum(['open', 'in-progress', 'completed', 'dismissed']).describe('[classification: application-heuristic]'),
  recommendedAction: z.string().describe('[classification: application-heuristic]'),
})

export type OperationsActionQueueItem = z.infer<typeof OperationsActionQueueItemSchema>
