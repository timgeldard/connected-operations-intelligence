import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// ProcessOrderReviewContext
// ---------------------------------------------------------------------------

export const ProcessOrderReviewContextSchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  lineOrResource: z.string().optional().describe('[classification: source-field]'),
  orderStatus: z
    .enum([
      'created',
      'released',
      'in-process',
      'confirmed',
      'partially-confirmed',
      'closed',
      'cancelled',
    ])
    .describe('[classification: source-field]'),
  qualityStatus: z
    .enum([
      'not-inspected',
      'in-inspection',
      'passed',
      'failed',
      'conditionally-released',
      'on-hold',
    ])
    .describe('[classification: application-heuristic]'),
  stagingStatus: z
    .enum(['not-started', 'partial', 'fully-staged', 'blocked', 'not-required'])
    .describe('[classification: application-heuristic]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
  activeScope: z.string().optional().describe('[classification: application-derived]'),
  activeView: z.string().optional().describe('[classification: application-derived]'),
})

export type ProcessOrderReviewContext = z.infer<typeof ProcessOrderReviewContextSchema>

// ---------------------------------------------------------------------------
// ProcessOrderHeader
// ---------------------------------------------------------------------------

export const ProcessOrderHeaderSchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  orderType: z
    .enum(['process-order', 'production-order', 'maintenance-order', 'planned-order'])
    .describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  productionLine: z.string().optional().describe('[classification: source-field]'),
  plannedQuantity: z.number().min(0).nullable().describe('[classification: source-field]'),
  confirmedQuantity: z.number().min(0).nullable().describe('[classification: source-field]'),
  scrapQuantity: z.number().min(0).optional().describe('[classification: source-field]'),
  uom: z.string().nullable().describe('[classification: source-field]'),
  plannedStart: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  plannedFinish: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  actualStart: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  actualFinish: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  orderStatus: z
    .enum([
      'created',
      'released',
      'in-process',
      'confirmed',
      'partially-confirmed',
      'closed',
      'cancelled',
      'unknown',
    ])
    .describe('[classification: source-field]'),
})

export type ProcessOrderHeader = z.infer<typeof ProcessOrderHeaderSchema>

// ---------------------------------------------------------------------------
// OrderProgressSummary
// ---------------------------------------------------------------------------

export const OrderProgressSummarySchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  progressPercent: z.number().min(0).max(100).describe('[classification: application-derived]'),
  operationsComplete: z.number().int().min(0).describe('[classification: source-derived]'),
  operationsTotal: z.number().int().min(0).describe('[classification: source-derived]'),
  confirmationsComplete: z.number().int().min(0).describe('[classification: source-derived]'),
  openConfirmations: z.number().int().min(0).describe('[classification: source-derived]'),
  currentOperation: z.string().optional().describe('[classification: source-derived]'),
  delayMinutes: z.number().min(0).describe('[classification: source-derived]'),
  riskLevel: z
    .enum(['on-track', 'at-risk', 'delayed', 'blocked'])
    .describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type OrderProgressSummary = z.infer<typeof OrderProgressSummarySchema>

// ---------------------------------------------------------------------------
// ExecutionTimelineItem
// ---------------------------------------------------------------------------

export const ExecutionTimelineItemSchema = z.object({
  eventId: z.string().describe('[classification: source-field]'),
  timestamp: z.string().datetime().describe('[classification: source-field]'),
  eventType: z
    .enum([
      'order-released',
      'operation-started',
      'operation-confirmed',
      'goods-issued',
      'deviation-raised',
      'quality-inspection',
      'staging-completed',
      'order-confirmed',
      'order-closed',
      'alert',
    ])
    .describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  sourceSystem: z.string().describe('[classification: source-field]'),
  actor: z.string().optional().describe('[classification: source-field]'),
  severity: SeveritySchema.optional().describe('[classification: source-derived]'),
})

export type ExecutionTimelineItem = z.infer<typeof ExecutionTimelineItemSchema>

// ---------------------------------------------------------------------------
// OrderQualityContext
// ---------------------------------------------------------------------------

export const OrderQualityContextSchema = z.object({
  inspectionLotId: z.string().optional().describe('[classification: source-field]'),
  releaseCaseId: z.string().optional().describe('[classification: source-field]'),
  qualityStatus: z
    .enum([
      'not-inspected',
      'in-inspection',
      'passed',
      'failed',
      'conditionally-released',
      'on-hold',
    ])
    .describe('[classification: application-heuristic]'),
  usageDecision: z.string().optional().describe('[classification: source-field]'),
  failedCharacteristics: z.number().int().min(0).describe('[classification: source-derived]'),
  openDeviations: z.number().int().min(0).describe('[classification: source-derived]'),
  spcSignals: z.number().int().min(0).describe('[classification: source-derived]'),
  releaseBlockers: z.array(z.string()).describe('[classification: source-derived]'),
})

export type OrderQualityContext = z.infer<typeof OrderQualityContextSchema>

// ---------------------------------------------------------------------------
// OrderStagingContext
// ---------------------------------------------------------------------------

export const OrderStagingContextSchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  stagingStatus: z
    .enum(['not-started', 'partial', 'fully-staged', 'blocked', 'not-required'])
    .describe('[classification: source-field]'),
  componentsRequired: z.number().int().min(0).describe('[classification: source-derived]'),
  componentsStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  missingComponents: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedComponents: z.number().int().min(0).describe('[classification: source-derived]'),
  openTransferRequirements: z.number().int().min(0).describe('[classification: source-derived]'),
  readinessStatus: z
    .enum(['ready', 'partial', 'blocked', 'not-started'])
    .describe('[classification: application-heuristic]'),
})

export type OrderStagingContext = z.infer<typeof OrderStagingContextSchema>

// ---------------------------------------------------------------------------
// RelatedBatchContext
// ---------------------------------------------------------------------------

export const RelatedBatchContextSchema = z.object({
  batchId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  relationshipType: z
    .enum(['output', 'input-component', 'co-product', 'by-product', 'rework'])
    .describe('[classification: source-field]'),
  traceRisk: z
    .enum(['none', 'potential', 'confirmed'])
    .describe('[classification: application-heuristic]'),
  qualityStatus: z
    .enum(['released', 'on-hold', 'rejected', 'under-review', 'awaiting-review'])
    .describe('[classification: application-heuristic]'),
  stockStatus: z
    .enum(['unrestricted', 'blocked', 'in-transit', 'quality-inspection', 'restricted'])
    .describe('[classification: application-heuristic]'),
  drillThroughTarget: z.string().optional().describe('[classification: application-derived]'),
})

export type RelatedBatchContext = z.infer<typeof RelatedBatchContextSchema>

// ---------------------------------------------------------------------------
// ProcessOrderOperation
// ---------------------------------------------------------------------------

export const ProcessOrderOperationSchema = z.object({
  operationId: z.string().describe('[classification: source-field]'),
  operationNumber: z.string().describe('[classification: source-field]'),
  operationText: z.string().describe('[classification: source-field]'),
  workCentre: z.string().nullable().describe('[classification: source-field]'),
  resource: z.string().optional().describe('[classification: source-field]'),
  plannedStart: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  plannedFinish: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  actualStart: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  actualFinish: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  status: z
    .enum(['pending', 'in-progress', 'confirmed', 'skipped'])
    .describe('[classification: source-field]'),
  plannedDurationMinutes: z.number().min(0).nullable().describe('[classification: source-derived]'),
  actualDurationMinutes: z.number().min(0).optional().describe('[classification: source-derived]'),
  confirmationStatus: z
    .enum(['unconfirmed', 'partially-confirmed', 'final-confirmed'])
    .describe('[classification: source-field]'),
  confirmed: z.boolean().describe('[classification: source-field]'),
  hasException: z.boolean().describe('[classification: source-derived]'),
})

export type ProcessOrderOperation = z.infer<typeof ProcessOrderOperationSchema>

// ---------------------------------------------------------------------------
// ProcessOrderConfirmation
// ---------------------------------------------------------------------------

export const ProcessOrderConfirmationSchema = z.object({
  confirmationId: z.string().describe('[classification: source-field]'),
  operationId: z.string().describe('[classification: source-field]'),
  // Not in vw_gold_confirmation — re-require once gold view exposes PHASE_DESCRIPTION join (2026-05-17)
  operationText: z.string().optional().describe('[classification: source-field]'),
  confirmedYield: z.number().min(0).nullable().describe('[classification: source-field]'),
  scrapQuantity: z.number().min(0).optional().describe('[classification: source-field]'),
  reworkQuantity: z.number().min(0).optional().describe('[classification: source-field]'),
  uom: z.string().nullable().describe('[classification: source-field]'),
  confirmedAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  confirmedBy: z.string().optional().describe('[classification: source-field]'),
  // Not in vw_gold_confirmation — re-require once gold view exposes final-confirmation flag (2026-05-17)
  isFinalConfirmation: z.boolean().optional().describe('[classification: source-field]'),
  setupDurationMinutes: z.number().min(0).optional().describe('[classification: source-field]'),
  machineDurationMinutes: z.number().min(0).optional().describe('[classification: source-field]'),
  cleaningDurationMinutes: z.number().min(0).optional().describe('[classification: source-field]'),
  variancePercent: z.number().optional().describe('[classification: source-derived]'),
})

export type ProcessOrderConfirmation = z.infer<typeof ProcessOrderConfirmationSchema>

// ---------------------------------------------------------------------------
// ProcessOrderGoodsMovement
// ---------------------------------------------------------------------------

export const ProcessOrderGoodsMovementSchema = z.object({
  movementId: z.string().describe('[classification: source-field]'),
  movementType: z.string().describe('[classification: source-field]'),
  direction: z.enum(['input', 'output', 'unknown']).describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  // Not in vw_gold_adp_movement — re-require once material master join is available (2026-05-17)
  materialDescription: z.string().optional().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  quantity: z.number().nullable().describe('[classification: source-field]'),
  uom: z.string().nullable().describe('[classification: source-field]'),
  postedAt: z.string().datetime().nullable().optional().describe('[classification: source-field]'),
  postedBy: z.string().optional().describe('[classification: source-field]'),
  referenceDocument: z.string().optional().describe('[classification: source-field]'),
  storageLocation: z.string().optional().describe('[classification: source-field]'),
})

export type ProcessOrderGoodsMovement = z.infer<typeof ProcessOrderGoodsMovementSchema>

// ---------------------------------------------------------------------------
// ProcessOrderSearch
// ---------------------------------------------------------------------------

export const ProcessOrderSearchRequestSchema = z.object({
  query: z.string().describe('[classification: application-derived]'),
  maxRows: z.number().int().optional().describe('[classification: application-derived]'),
  materialId: z.string().optional().describe('[classification: application-derived]'),
  batchId: z.string().optional().describe('[classification: application-derived]'),
})

export type ProcessOrderSearchRequest = z.infer<typeof ProcessOrderSearchRequestSchema>

export const ProcessOrderSearchMatchTypeSchema = z.enum([
  'process-order-id',
  'material-id',
  'description',
  'batch-id',
])

export type ProcessOrderSearchMatchType = z.infer<typeof ProcessOrderSearchMatchTypeSchema>

export const ProcessOrderSearchItemSchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().nullable().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  orderStatus: z.string().describe('[classification: source-field]'),
  plannedQuantity: z.number().optional().nullable().describe('[classification: source-field]'),
  confirmedQuantity: z.number().optional().nullable().describe('[classification: source-field]'),
  uom: z.string().optional().nullable().describe('[classification: source-field]'),
  plannedStart: z.string().optional().nullable().describe('[classification: source-field]'),
  plannedFinish: z.string().optional().nullable().describe('[classification: source-field]'),
  matchTypes: z.array(ProcessOrderSearchMatchTypeSchema).describe('[classification: application-derived]'),
})

export type ProcessOrderSearchItem = z.infer<typeof ProcessOrderSearchItemSchema>

export const ProcessOrderSearchResponseSchema = z.object({
  items: z.array(ProcessOrderSearchItemSchema).describe('[classification: source-derived]'),
  total: z.number().int().describe('[classification: source-derived]'),
  truncated: z.boolean().describe('[classification: source-derived]'),
  wildcardApplied: z.boolean().describe('[classification: source-derived]'),
})

export type ProcessOrderSearchResponse = z.infer<typeof ProcessOrderSearchResponseSchema>

