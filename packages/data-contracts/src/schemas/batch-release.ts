import { z } from 'zod'

// ---------------------------------------------------------------------------
// BatchReleaseContext
// ---------------------------------------------------------------------------

/** Top-level context for a batch release case, analogous to TraceInvestigationContext. */
export const BatchReleaseContextSchema = z.object({
  releaseCaseId: z.string(),
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  plantName: z.string(),
  processOrderId: z.string().optional(),
  status: z.enum([
    'awaiting-review',
    'under-review',
    'conditionally-released',
    'released',
    'rejected',
    'on-hold',
    'escalated',
  ]),
  priority: z.enum(['routine', 'expedited', 'critical']),
  assignedTo: z.string().optional(),
  requestedBy: z.string(),
  requestedAt: z.string().datetime(),
  dueBy: z.string().datetime().optional(),
  lastUpdatedAt: z.string().datetime(),
  releaseType: z.enum(['standard', 'conditional', 'emergency', 'retrospective']),
})

export type BatchReleaseContext = z.infer<typeof BatchReleaseContextSchema>

// ---------------------------------------------------------------------------
// BatchReleaseQueueItem
// ---------------------------------------------------------------------------

/** A single entry in the batch release queue view. */
export const BatchReleaseQueueItemSchema = z.object({
  releaseCaseId: z.string(),
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  status: z.enum([
    'awaiting-review',
    'under-review',
    'conditionally-released',
    'released',
    'rejected',
    'on-hold',
    'escalated',
  ]),
  priority: z.enum(['routine', 'expedited', 'critical']),
  dueBy: z.string().datetime().optional(),
  blockers: z.array(z.string()),
  openDeviationCount: z.number().int().min(0),
  spcAlarmCount: z.number().int().min(0),
  hasOpenHold: z.boolean(),
  assignedTo: z.string().optional(),
  requestedAt: z.string().datetime(),
})

export type BatchReleaseQueueItem = z.infer<typeof BatchReleaseQueueItemSchema>

// ---------------------------------------------------------------------------
// BatchReleaseSummary
// ---------------------------------------------------------------------------

/** Decision-relevant summary combining all evidence signals for a batch. */
export const BatchReleaseSummarySchema = z.object({
  releaseCaseId: z.string(),
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  overallReadiness: z.enum(['ready', 'conditional', 'blocked', 'incomplete']),
  qualityPassed: z.boolean(),
  spcClean: z.boolean(),
  coaComplete: z.boolean(),
  noOpenHolds: z.boolean(),
  deviationsResolved: z.boolean(),
  traceClean: z.boolean(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendedAction: z.enum(['release', 'conditional-release', 'reject', 'escalate', 'retest']),
  lastEvaluatedAt: z.string().datetime(),
})

export type BatchReleaseSummary = z.infer<typeof BatchReleaseSummarySchema>

// ---------------------------------------------------------------------------
// QualityResultsSummary
// ---------------------------------------------------------------------------

/** MIC / CoA / inspection results consolidated for release decision. */
export const MICFailureSchema = z.object({
  organism: z.string(),
  testMethod: z.string(),
  result: z.number(),
  limit: z.number(),
  unit: z.string(),
  exceededBy: z.number(),
  testedAt: z.string().datetime(),
  testedBy: z.string().optional(),
})

export type MICFailure = z.infer<typeof MICFailureSchema>

export const QualityResultsSummarySchema = z.object({
  batchId: z.string(),
  inspectionLotId: z.string().optional(),
  micStatus: z.enum(['pass', 'fail', 'pending', 'conditional', 'not-required']),
  chemicalStatus: z.enum(['pass', 'fail', 'pending', 'conditional', 'not-required']),
  sensoryStatus: z.enum(['pass', 'fail', 'pending', 'conditional', 'not-required']),
  physicalStatus: z.enum(['pass', 'fail', 'pending', 'conditional', 'not-required']),
  overallStatus: z.enum(['pass', 'fail', 'pending', 'conditional']),
  micFailures: z.array(MICFailureSchema),
  openRetestCount: z.number().int().min(0),
  inspectionCompletedAt: z.string().datetime().optional(),
  inspectionCompletedBy: z.string().optional(),
})

export type QualityResultsSummary = z.infer<typeof QualityResultsSummarySchema>

// ---------------------------------------------------------------------------
// SPCSignalSummaryForRelease
// ---------------------------------------------------------------------------

/** SPC alarms active or recently fired for the batch's process order. */
export const SPCSignalSummarySchema = z.object({
  processOrderId: z.string(),
  batchId: z.string(),
  activeAlarmCount: z.number().int().min(0),
  resolvedAlarmCount: z.number().int().min(0),
  criticalAlarmCount: z.number().int().min(0),
  alarms: z.array(
    z.object({
      alarmId: z.string(),
      chartType: z.enum(['xbar-r', 'xbar-s', 'individuals', 'p', 'np', 'c', 'u', 'cusum', 'ewma']),
      parameter: z.string(),
      ruleViolated: z.string(),
      severity: z.enum(['minor', 'major', 'critical']),
      firedAt: z.string().datetime(),
      resolvedAt: z.string().datetime().optional(),
      status: z.enum(['active', 'acknowledged', 'resolved', 'overridden']),
    })
  ),
  lastCheckedAt: z.string().datetime(),
})

export type SPCSignalSummary = z.infer<typeof SPCSignalSummarySchema>

// ---------------------------------------------------------------------------
// ProcessOrderReleaseEvidence
// ---------------------------------------------------------------------------

/** Manufacturing process order conformance evidence relevant to release. */
export const ProcessOrderReleaseEvidenceSchema = z.object({
  processOrderId: z.string(),
  batchId: z.string(),
  orderStatus: z.enum(['created', 'released', 'in-process', 'completed', 'closed', 'deleted']),
  plannedQuantity: z.number(),
  confirmedQuantity: z.number(),
  uom: z.string(),
  yieldPercent: z.number().min(0).max(200),
  plannedStart: z.string().datetime().optional(),
  actualStart: z.string().datetime().optional(),
  plannedEnd: z.string().datetime().optional(),
  actualEnd: z.string().datetime().optional(),
  conformanceStatus: z.enum(['conformant', 'non-conformant', 'pending-review', 'waived']),
  openNCRCount: z.number().int().min(0),
  criticalDeviationCount: z.number().int().min(0),
  workCentreId: z.string().optional(),
  lineId: z.string().optional(),
})

export type ProcessOrderReleaseEvidence = z.infer<typeof ProcessOrderReleaseEvidenceSchema>

// ---------------------------------------------------------------------------
// WarehouseHoldStatus (richer release-oriented version)
// ---------------------------------------------------------------------------

/** Warehouse stock and hold status for a batch, release-decision oriented. */
export const WarehouseHoldStatusSchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  plantId: z.string(),
  storageLocationId: z.string().optional(),
  stockType: z.enum(['unrestricted', 'quality-inspection', 'blocked', 'returns', 'transit']),
  totalQuantity: z.number(),
  blockedQuantity: z.number(),
  restrictedQuantity: z.number(),
  unrestrictedQuantity: z.number(),
  uom: z.string(),
  activeHolds: z.array(
    z.object({
      holdId: z.string(),
      holdType: z.enum(['quality', 'regulatory', 'customer', 'internal', 'trace']),
      reason: z.string(),
      placedBy: z.string(),
      placedAt: z.string().datetime(),
      expiresAt: z.string().datetime().optional(),
      status: z.enum(['active', 'pending-release', 'released', 'escalated']),
    })
  ),
  hasBlockingHold: z.boolean(),
  lastUpdatedAt: z.string().datetime(),
})

export type WarehouseHoldStatus = z.infer<typeof WarehouseHoldStatusSchema>

// ---------------------------------------------------------------------------
// TraceExposureForRelease
// ---------------------------------------------------------------------------

/** Trace exposure signals relevant to the release decision (upstream/downstream risk). */
export const TraceExposureForReleaseSchema = z.object({
  batchId: z.string(),
  releaseCaseId: z.string(),
  upstreamRiskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  downstreamRiskLevel: z.enum(['none', 'low', 'medium', 'high', 'critical']),
  affectedCustomerCount: z.number().int().min(0),
  affectedSupplierLotCount: z.number().int().min(0),
  openTraceInvestigations: z.array(
    z.object({
      investigationId: z.string(),
      status: z.string(),
      severity: z.enum(['low', 'medium', 'high', 'critical']),
      summary: z.string(),
    })
  ),
  recallRiskFlag: z.boolean(),
  traceReadiness: z.enum(['clean', 'flagged', 'blocked', 'unknown']),
  lastEvaluatedAt: z.string().datetime(),
})

export type TraceExposureForRelease = z.infer<typeof TraceExposureForReleaseSchema>

// ---------------------------------------------------------------------------
// CoAReadiness
// ---------------------------------------------------------------------------

/** Certificate of Analysis readiness for the batch — distinct from CoAReleaseStatus
 *  (which is the quality decision record). CoAReadiness captures whether the CoA
 *  document is complete enough for release to proceed. */
export const CoAReadinessSchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  coaDocumentId: z.string().optional(),
  readinessStatus: z.enum(['complete', 'incomplete', 'pending-sign-off', 'not-applicable']),
  missingFields: z.array(z.string()),
  signedOffBy: z.string().optional(),
  signedOffAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  customerSpecificCoas: z.array(
    z.object({
      customerId: z.string(),
      customerName: z.string(),
      status: z.enum(['complete', 'incomplete', 'not-required']),
    })
  ),
  lastUpdatedAt: z.string().datetime(),
})

export type CoAReadiness = z.infer<typeof CoAReadinessSchema>

// ---------------------------------------------------------------------------
// DeviationSummary
// ---------------------------------------------------------------------------

/** Active and recent deviations associated with the batch / process order. */
export const DeviationSummarySchema = z.object({
  batchId: z.string(),
  processOrderId: z.string().optional(),
  totalDeviationCount: z.number().int().min(0),
  openDeviationCount: z.number().int().min(0),
  criticalDeviationCount: z.number().int().min(0),
  deviations: z.array(
    z.object({
      deviationId: z.string(),
      type: z.enum(['process', 'quality', 'environmental', 'supplier', 'equipment', 'other']),
      severity: z.enum(['minor', 'major', 'critical']),
      status: z.enum(['open', 'under-investigation', 'pending-approval', 'closed', 'waived']),
      description: z.string(),
      raisedAt: z.string().datetime(),
      raisedBy: z.string(),
      resolvedAt: z.string().datetime().optional(),
      impactsRelease: z.boolean(),
    })
  ),
  blockingReleaseCount: z.number().int().min(0),
  lastUpdatedAt: z.string().datetime(),
})

export type DeviationSummary = z.infer<typeof DeviationSummarySchema>

// ---------------------------------------------------------------------------
// ReleaseDecisionHistoryItem
// ---------------------------------------------------------------------------

/** An entry in the release decision audit trail for a batch or case. */
export const ReleaseDecisionHistoryItemSchema = z.object({
  decisionId: z.string(),
  releaseCaseId: z.string(),
  batchId: z.string(),
  decision: z.enum([
    'released',
    'conditional-release',
    'rejected',
    'placed-on-hold',
    'escalated',
    'retest-requested',
    'hold-released',
  ]),
  decidedBy: z.string(),
  decidedAt: z.string().datetime(),
  rationale: z.string(),
  conditions: z.array(z.string()),
  supersedes: z.string().optional(),
  attachments: z.array(
    z.object({
      attachmentId: z.string(),
      name: z.string(),
      mimeType: z.string(),
    })
  ),
})

export type ReleaseDecisionHistoryItem = z.infer<typeof ReleaseDecisionHistoryItemSchema>
