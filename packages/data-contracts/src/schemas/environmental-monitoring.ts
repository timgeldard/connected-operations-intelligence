import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// EnvMonContext
// ---------------------------------------------------------------------------

export const EnvMonContextSchema = z.object({
  regionId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  monitoringPeriodStart: z.string().date().describe('[classification: source-field]'),
  monitoringPeriodEnd: z.string().date().describe('[classification: source-field]'),
  totalZones: z.number().int().min(0).describe('[classification: source-derived]'),
  activeAlerts: z.number().int().min(0).describe('[classification: source-derived]'),
  openCorrectiveActions: z.number().int().min(0).describe('[classification: source-derived]'),
  overallRiskStatus: z.enum(['compliant', 'elevated', 'non-compliant', 'unknown']).describe('[classification: application-heuristic]'),
  lastSampleDate: z.string().date().optional().describe('[classification: source-field]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
})

export type EnvMonContext = z.infer<typeof EnvMonContextSchema>

// ---------------------------------------------------------------------------
// EnvMonSiteSummary
// ---------------------------------------------------------------------------

export const EnvMonSiteSummarySchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  zonesMonitored: z.number().int().min(0).describe('[classification: source-derived]'),
  zonesWithAlerts: z.number().int().min(0).describe('[classification: source-derived]'),
  positiveCount: z.number().int().min(0).describe('[classification: source-derived]'),
  positiveRate: z.number().min(0).max(100).describe('[classification: source-derived]'),
  openCorrectiveActions: z.number().int().min(0).describe('[classification: source-derived]'),
  overdueActions: z.number().int().min(0).describe('[classification: source-derived]'),
  complianceRate: z.number().min(0).max(100).describe('[classification: source-derived]'),
  riskStatus: z.enum(['compliant', 'elevated', 'non-compliant', 'unknown']).describe('[classification: application-heuristic]'),
  highestSeverity: SeveritySchema.describe('[classification: source-derived]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type EnvMonSiteSummary = z.infer<typeof EnvMonSiteSummarySchema>

// ---------------------------------------------------------------------------
// EnvMonZone
// ---------------------------------------------------------------------------

export const EnvMonZoneSchema = z.object({
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  areaType: z.enum(['production', 'storage', 'packaging', 'utility', 'corridor', 'other']).describe('[classification: source-field]'),
  hygieneZone: z.enum(['zone-1', 'zone-2', 'zone-3', 'zone-4']).describe('[classification: source-field]'),
  status: z.enum(['compliant', 'alert', 'overdue', 'corrective-action', 'suspended']).describe('[classification: application-heuristic]'),
  lastSampleDate: z.string().date().optional().describe('[classification: source-field]'),
  nextScheduledSample: z.string().date().optional().describe('[classification: source-field]'),
  consecutivePositives: z.number().int().min(0).describe('[classification: source-derived]'),
  openAlerts: z.number().int().min(0).describe('[classification: source-derived]'),
})

export type EnvMonZone = z.infer<typeof EnvMonZoneSchema>

// ---------------------------------------------------------------------------
// EnvMonAlert
// ---------------------------------------------------------------------------

export const EnvMonAlertSchema = z.object({
  alertId: z.string().describe('[classification: source-field]'),
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  testType: z.enum(['swab', 'air-sample', 'surface-contact', 'rinse-water', 'other']).describe('[classification: source-field]'),
  organism: z.string().describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-field]'),
  detectedAt: z.string().datetime().describe('[classification: source-field]'),
  resolvedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  status: z.enum(['open', 'investigating', 'corrective-action', 'resolved', 'escalated']).describe('[classification: source-field]'),
  correctiveActionId: z.string().optional().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  owner: z.string().describe('[classification: source-field]'),
})

export type EnvMonAlert = z.infer<typeof EnvMonAlertSchema>

// ---------------------------------------------------------------------------
// EnvMonSwabResult
// ---------------------------------------------------------------------------

export const EnvMonSwabResultSchema = z.object({
  sampleId: z.string().describe('[classification: source-field]'),
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  vectorId: z.string().optional().describe('[classification: source-field]'),
  testType: z.enum(['swab', 'air-sample', 'surface-contact', 'rinse-water', 'other']).describe('[classification: source-field]'),
  organism: z.string().describe('[classification: source-field]'),
  result: z.enum(['negative', 'positive', 'borderline', 'pending']).describe('[classification: source-field]'),
  cfu: z.number().min(0).optional().describe('[classification: source-field]'),
  cfuLimit: z.number().min(0).optional().describe('[classification: source-field]'),
  sampleDate: z.string().date().describe('[classification: source-field]'),
  analysedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  analyst: z.string().optional().describe('[classification: source-field]'),
  lotId: z.string().optional().describe('[classification: source-field]'),
})

export type EnvMonSwabResult = z.infer<typeof EnvMonSwabResultSchema>

// ---------------------------------------------------------------------------
// EnvMonNativeSwabResult — source-truthful schema for GET /api/envmon/swab-results
//
// Matches the actual mapper output from map_swab_result_rows (SAP QM inspection
// lot + MIC result data). All fields from the LEFT JOIN are nullable.
// Required: plantId (lot header, always present), status (derived from valuation).
// ---------------------------------------------------------------------------

export const EnvMonNativeSwabResultSchema = z.object({
  inspectionLotId: z.string().nullable().describe('[classification: source-field]'),
  inspectionPointId: z.string().nullable().describe('[classification: source-field]'),
  sampleId: z.string().nullable().describe('[classification: source-field]'),
  operationId: z.string().nullable().describe('[classification: source-field]'),
  functionalLocation: z.string().nullable().describe('[classification: source-field]'),
  sampleSummary: z.string().nullable().describe('[classification: source-field]'),
  sampleHour: z.union([z.string(), z.number()]).nullable().describe('[classification: source-field]'),
  plantId: z.string().nullable().describe('[classification: source-field]'),
  inspectionType: z.string().nullable().describe('[classification: source-field]'),
  createdDate: z.string().nullable().describe('[classification: source-field]'),
  inspectionEndDate: z.string().nullable().describe('[classification: source-field]'),
  micId: z.string().nullable().describe('[classification: source-field]'),
  micName: z.string().nullable().describe('[classification: source-field]'),
  micCode: z.string().nullable().describe('[classification: source-field]'),
  result: z.union([z.string(), z.number()]).nullable().describe('[classification: source-field]'),
  quantitativeResult: z.union([z.number(), z.string()]).nullable().describe('[classification: source-field]'),
  qualitativeResult: z.string().nullable().describe('[classification: source-field]'),
  targetValue: z.union([z.number(), z.string()]).nullable().describe('[classification: source-field]'),
  upperTolerance: z.union([z.number(), z.string()]).nullable().describe('[classification: source-field]'),
  lowerTolerance: z.union([z.number(), z.string()]).nullable().describe('[classification: source-field]'),
  unitOfMeasure: z.string().nullable().describe('[classification: source-field]'),
  valuation: z.string().nullable().describe('[classification: source-field]'),
  status: z.enum(['fail', 'warning', 'pending', 'pass']).describe('[classification: application-heuristic]'),
  inspector: z.string().nullable().describe('[classification: source-field]'),
  inspectionMethod: z.string().nullable().describe('[classification: source-field]'),
  materialId: z.string().nullable().describe('[classification: source-field]'),
  batchId: z.string().nullable().describe('[classification: source-field]'),
  processOrderId: z.string().nullable().describe('[classification: source-field]'),
})

export type EnvMonNativeSwabResult = z.infer<typeof EnvMonNativeSwabResultSchema>

// ---------------------------------------------------------------------------
// EnvMonTrend
// ---------------------------------------------------------------------------

export const EnvMonTrendSchema = z.object({
  date: z.string().date().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  samplesCollected: z.number().int().min(0).describe('[classification: source-derived]'),
  positiveCount: z.number().int().min(0).describe('[classification: source-derived]'),
  positiveRate: z.number().min(0).max(100).describe('[classification: source-derived]'),
  newAlerts: z.number().int().min(0).describe('[classification: source-derived]'),
  resolvedAlerts: z.number().int().min(0).describe('[classification: source-derived]'),
  openAlerts: z.number().int().min(0).describe('[classification: source-derived]'),
  complianceRate: z.number().min(0).max(100).describe('[classification: source-derived]'),
})

export type EnvMonTrend = z.infer<typeof EnvMonTrendSchema>

// ---------------------------------------------------------------------------
// EnvMonHeatmapCell
// ---------------------------------------------------------------------------

export const EnvMonHeatmapCellSchema = z.object({
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  areaType: z.string().describe('[classification: source-field]'),
  hygieneZone: z.enum(['zone-1', 'zone-2', 'zone-3', 'zone-4']).describe('[classification: source-field]'),
  riskScore: z.number().min(0).max(100).describe('[classification: application-heuristic]'),
  positiveCount: z.number().int().min(0).describe('[classification: source-derived]'),
  sampleCount: z.number().int().min(0).describe('[classification: source-derived]'),
  lastTestDate: z.string().date().optional().describe('[classification: source-field]'),
  status: z.enum(['compliant', 'alert', 'overdue', 'corrective-action', 'suspended']).describe('[classification: application-heuristic]'),
})

export type EnvMonHeatmapCell = z.infer<typeof EnvMonHeatmapCellSchema>

// ---------------------------------------------------------------------------
// EnvMonCorrectiveAction
// ---------------------------------------------------------------------------

export const EnvMonCorrectiveActionSchema = z.object({
  actionId: z.string().describe('[classification: source-field]'),
  alertId: z.string().describe('[classification: source-field]'),
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  actionType: z.enum(['deep-clean', 'retest', 'equipment-check', 'process-review', 'personnel-training', 'other']).describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-field]'),
  status: z.enum(['open', 'in-progress', 'pending-verification', 'closed', 'overdue']).describe('[classification: source-field]'),
  assignee: z.string().describe('[classification: source-field]'),
  dueDate: z.string().date().describe('[classification: source-field]'),
  closedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  verifiedBy: z.string().optional().describe('[classification: source-field]'),
  recurrence: z.boolean().describe('[classification: source-derived]'),
})

export type EnvMonCorrectiveAction = z.infer<typeof EnvMonCorrectiveActionSchema>

// ---------------------------------------------------------------------------
// EnvMonSwabVector
// ---------------------------------------------------------------------------

export const EnvMonSwabVectorSchema = z.object({
  vectorId: z.string().describe('[classification: source-field]'),
  vectorName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  zoneIds: z.array(z.string()).describe('[classification: source-field]'),
  frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'quarterly']).describe('[classification: source-field]'),
  nextDueDate: z.string().date().optional().describe('[classification: source-field]'),
  lastCompletedDate: z.string().date().optional().describe('[classification: source-field]'),
  status: z.enum(['on-schedule', 'overdue', 'in-progress', 'suspended']).describe('[classification: source-field]'),
  pointCount: z.number().int().min(0).describe('[classification: source-derived]'),
  assignedTeam: z.string().optional().describe('[classification: source-field]'),
})

export type EnvMonSwabVector = z.infer<typeof EnvMonSwabVectorSchema>

// ---------------------------------------------------------------------------
// EnvMonKpiSummary
// ---------------------------------------------------------------------------

export const EnvMonKpiSummarySchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  periodStart: z.string().date().describe('[classification: source-field]'),
  periodEnd: z.string().date().describe('[classification: source-field]'),
  zonesMonitored: z.number().int().min(0).describe('[classification: source-derived]'),
  samplesCollected: z.number().int().min(0).describe('[classification: source-derived]'),
  positiveRate: z.number().min(0).max(100).describe('[classification: source-derived]'),
  alertsOpen: z.number().int().min(0).describe('[classification: source-derived]'),
  alertsResolved: z.number().int().min(0).describe('[classification: source-derived]'),
  correctiveActionsOpen: z.number().int().min(0).describe('[classification: source-derived]'),
  correctiveActionsOverdue: z.number().int().min(0).describe('[classification: source-derived]'),
  complianceRate: z.number().min(0).max(100).describe('[classification: source-derived]'),
  trendDirection: z.enum(['improving', 'stable', 'deteriorating', 'unknown']).describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type EnvMonKpiSummary = z.infer<typeof EnvMonKpiSummarySchema>

// ---------------------------------------------------------------------------
// EnvMonL4Zone & EnvMonL5Coordinate
// ---------------------------------------------------------------------------

export const EnvMonPointSchema = z.object({
  x: z.number().describe('[classification: application-heuristic]'),
  y: z.number().describe('[classification: application-heuristic]'),
})

export type EnvMonPoint = z.infer<typeof EnvMonPointSchema>

export const EnvMonL4ZoneSchema = z.object({
  zoneId: z.string().describe('[classification: source-field]'),
  label: z.string().describe('[classification: source-field]'),
  points: z.array(EnvMonPointSchema).describe('[classification: application-heuristic]'),
})

export type EnvMonL4Zone = z.infer<typeof EnvMonL4ZoneSchema>

export const EnvMonL5CoordinateSchema = z.object({
  locationId: z.string().describe('[classification: source-field]'),
  label: z.string().describe('[classification: source-field]'),
  parentZoneId: z.string().describe('[classification: source-field]'),
  x: z.number().describe('[classification: application-heuristic]'),
  y: z.number().describe('[classification: application-heuristic]'),
})

export type EnvMonL5Coordinate = z.infer<typeof EnvMonL5CoordinateSchema>
