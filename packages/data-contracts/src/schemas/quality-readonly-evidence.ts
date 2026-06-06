import { z } from 'zod'

/**
 * Shared source attribution for read-only Quality evidence.
 *
 * `unavailable` and `unknown` are first-class values so callers do not need to
 * masquerade missing source verification as mock or live Databricks data.
 */
export const QualityEvidenceSourceSchema = z.enum([
  'mock',
  'legacy-api',
  'databricks-api',
  'unavailable',
  'unknown',
])

export type QualityEvidenceSource = z.infer<typeof QualityEvidenceSourceSchema>

/**
 * Section-level state for read-only Quality evidence.
 *
 * These values are intentionally evidence-oriented, not release-oriented.
 * `no-records` means no rows were returned by the queried source; it is not
 * proof that no source records exist elsewhere.
 */
export const QualityEvidenceStatusSchema = z.enum([
  'loaded',
  'no-records',
  'unavailable',
  'error',
  'mock',
  'pending-source-verification',
  'not-requested',
])

export type QualityEvidenceStatus = z.infer<typeof QualityEvidenceStatusSchema>

export const QualityUsageDecisionStatusSchema = z.enum([
  'source-present',
  'not-found',
  'source-unverified',
  'unavailable',
  'error',
  'not-requested',
])

export type QualityUsageDecisionStatus = z.infer<typeof QualityUsageDecisionStatusSchema>

export const QualityUsageDecisionMappingStatusSchema = z.enum([
  'source-only',
  'verified',
  'unverified',
  'unavailable',
  'not-mapped',
])

export type QualityUsageDecisionMappingStatus = z.infer<typeof QualityUsageDecisionMappingStatusSchema>

export const QualitySourceFreshnessStatusSchema = z.enum([
  'fresh',
  'stale',
  'unknown',
  'unavailable',
  'not-verified',
])

export type QualitySourceFreshnessStatus = z.infer<typeof QualitySourceFreshnessStatusSchema>

export const QualityCoaDocumentStatusSchema = z.enum(['unavailable', 'unknown'])

export type QualityCoaDocumentStatus = z.infer<typeof QualityCoaDocumentStatusSchema>

// ---------------------------------------------------------------------------
// QualityEvidenceRequest
// ---------------------------------------------------------------------------

export const QualityEvidenceRequestSchema = z.object({
  plantId: z.string().optional().describe('[classification: source-field]'),
  materialId: z.string().optional().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  inspectionLotId: z.string().optional().describe('[classification: source-field]'),
  processOrderId: z.string().optional().describe('[classification: source-field]'),
  dateFrom: z.string().date().optional().describe('[classification: source-field]'),
  dateTo: z.string().date().optional().describe('[classification: source-field]'),
}).strict()

export type QualityEvidenceRequest = z.infer<typeof QualityEvidenceRequestSchema>

// ---------------------------------------------------------------------------
// QualityInspectionLotEvidence
// ---------------------------------------------------------------------------

export const QualityInspectionLotEvidenceSchema = z.object({
  inspectionLotId: z.string().describe('[classification: source-field]'),
  inspectionType: z.string().optional().nullable().describe('[classification: source-field]'),
  inspectionLotStatus: z.string().optional().nullable().describe('[classification: source-field]'),
  materialId: z.string().optional().nullable().describe('[classification: source-field]'),
  batchId: z.string().optional().nullable().describe('[classification: source-field]'),
  plantId: z.string().optional().nullable().describe('[classification: source-field]'),
  processOrderId: z.string().optional().nullable().describe('[classification: source-field]'),
  createdAt: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
  startedAt: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
  completedAt: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
  source: QualityEvidenceSourceSchema.describe('[classification: source-field]'),
  /**
   * Per-lot usage decision evidence fields.
   *
   * These are raw source fields from `gold_inspection_usage_decision` joined to
   * the inspection lot. They are read-only evidence only — they do not represent
   * a batch-level release decision. Multiple lots per batch each carry their own
   * usage decision; no aggregation into a "batch decision" is performed.
   *
   * PROHIBITED: These fields must not be mapped to "Released", "Approved",
   * "Cleared", or "Can release" without a governed lot-selection rule.
   */
  usageDecisionCode: z.string().optional().nullable().describe('[classification: source-field]'),
  usageDecisionText: z.string().optional().nullable().describe('[classification: source-field]'),
  usageDecisionMappingStatus: QualityUsageDecisionMappingStatusSchema.optional().nullable().describe('[classification: application-derived]'),
  usageDecisionCreatedAt: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
}).strict()

export type QualityInspectionLotEvidence = z.infer<typeof QualityInspectionLotEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityMicResultEvidence
// ---------------------------------------------------------------------------

/**
 * MIC / inspection-characteristic result evidence.
 *
 * Specification limits are product or inspection specifications. They are not
 * SPC control limits, and `resultStatus` is not a release approval state.
 */
export const QualityMicResultEvidenceSchema = z.object({
  micId: z.string().optional().nullable().describe('[classification: source-field]'),
  micCode: z.string().optional().nullable().describe('[classification: source-field]'),
  micName: z.string().optional().nullable().describe('[classification: source-field]'),
  characteristicId: z.string().optional().nullable().describe('[classification: source-field]'),
  resultValue: z.number().optional().nullable().describe('[classification: source-field]'),
  resultText: z.string().optional().nullable().describe('[classification: source-field]'),
  resultUnit: z.string().optional().nullable().describe('[classification: source-field]'),
  lowerSpecificationLimit: z.number().optional().nullable().describe('[classification: source-field]'),
  upperSpecificationLimit: z.number().optional().nullable().describe('[classification: source-field]'),
  targetValue: z.number().optional().nullable().describe('[classification: source-field]'),
  toleranceText: z.string().optional().nullable().describe('[classification: source-field]'),
  valuationCode: z.string().optional().nullable().describe('[classification: source-field]'),
  valuationText: z.string().optional().nullable().describe('[classification: source-field]'),
  resultStatus: z.enum(['pass', 'fail', 'warning', 'pending', 'unknown', 'not-evaluated']).describe('[classification: application-heuristic]'),
  sampleId: z.string().optional().nullable().describe('[classification: source-field]'),
  sampleDate: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
  resultDate: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
  method: z.string().optional().nullable().describe('[classification: source-field]'),
  source: QualityEvidenceSourceSchema.describe('[classification: source-field]'),
}).strict()

export type QualityMicResultEvidence = z.infer<typeof QualityMicResultEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityUsageDecisionEvidence
// ---------------------------------------------------------------------------

/**
 * Source display for SAP QM usage decision evidence.
 *
 * This contract carries raw source fields and a mapping status. It deliberately
 * avoids accepted/released/conditional release semantics.
 */
export const QualityUsageDecisionEvidenceSchema = z.object({
  usageDecisionCode: z.string().optional().nullable().describe('[classification: source-field]'),
  usageDecisionText: z.string().optional().nullable().describe('[classification: source-field]'),
  valuationCode: z.string().optional().nullable().describe('[classification: source-field]'),
  qualityScore: z.number().optional().nullable().describe('[classification: source-field]'),
  createdBy: z.string().optional().nullable().describe('[classification: source-field]'),
  createdAt: z.string().datetime().optional().nullable().describe('[classification: source-field]'),
  source: QualityEvidenceSourceSchema.describe('[classification: source-field]'),
  mappingStatus: QualityUsageDecisionMappingStatusSchema.describe('[classification: application-derived]'),
}).strict()

export type QualityUsageDecisionEvidence = z.infer<typeof QualityUsageDecisionEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityCoaResultEvidence
// ---------------------------------------------------------------------------

/**
 * CoA-like result evidence.
 *
 * `documentStatus` is limited to unavailable/unknown until a source proves
 * official CoA document approval, signoff, versioning, or PDF availability.
 */
export const QualityCoaResultEvidenceSchema = z.object({
  micCode: z.string().optional().nullable().describe('[classification: source-field]'),
  micName: z.string().optional().nullable().describe('[classification: source-field]'),
  targetValue: z.number().optional().nullable().describe('[classification: source-field]'),
  toleranceRange: z.string().optional().nullable().describe('[classification: source-field]'),
  actualResult: z.number().optional().nullable().describe('[classification: source-field]'),
  resultStatus: z.string().optional().nullable().describe('[classification: application-heuristic]'),
  withinSpec: z.string().optional().nullable().describe('[classification: application-heuristic]'),
  deviationFromTarget: z.number().optional().nullable().describe('[classification: source-derived]'),
  source: QualityEvidenceSourceSchema.describe('[classification: source-field]'),
  documentStatus: QualityCoaDocumentStatusSchema.describe('[classification: source-field]'),
}).strict()

export type QualityCoaResultEvidence = z.infer<typeof QualityCoaResultEvidenceSchema>

// ---------------------------------------------------------------------------
// QualityEvidenceSummary
// ---------------------------------------------------------------------------

export const QualityEvidenceSummarySchema = z.object({
  source: QualityEvidenceSourceSchema.describe('[classification: source-field]'),
  status: QualityEvidenceStatusSchema.describe('[classification: application-derived]'),
  inspectionLotCount: z.number().int().min(0).describe('[classification: source-derived]'),
  micResultCount: z.number().int().min(0).describe('[classification: source-derived]'),
  usageDecisionStatus: QualityUsageDecisionStatusSchema.describe('[classification: application-derived]'),
  coaResultCount: z.number().int().min(0).describe('[classification: source-derived]'),
  unavailableEvidence: z.array(z.string()).describe('[classification: application-derived]'),
  warnings: z.array(z.string()).describe('[classification: application-derived]'),
  queriedAt: z.string().datetime().describe('[classification: source-field]'),
  sourceFreshnessStatus: QualitySourceFreshnessStatusSchema.describe('[classification: application-derived]'),
  /**
   * Extended state model fields.
   *
   * These carry expressive state-model states (from quality-readonly-evidence-state-model.md)
   * as strings rather than widening the strict `status` enum. They are optional so
   * existing adapters and fixtures remain schema-valid without modification.
   *
   * PROHIBITED: `evidenceState` must never be set to "released", "approved", "cleared",
   * or any value implying release authority. Only evidence-oriented states are valid.
   */
  evidenceState: z.string().optional().describe('[classification: application-derived]'),
  sourceStatus: z.string().optional().describe('[classification: source-field]'),
  lotCount: z.number().int().min(0).optional().describe('[classification: source-derived]'),
  multipleLotsWarning: z.string().optional().describe('[classification: application-derived]'),
  missingLotWarning: z.string().optional().describe('[classification: application-derived]'),
}).strict()

export type QualityEvidenceSummary = z.infer<typeof QualityEvidenceSummarySchema>

// ---------------------------------------------------------------------------
// QualityEvidenceResponse
// ---------------------------------------------------------------------------

export const QualityEvidenceResponseSchema = z.object({
  request: QualityEvidenceRequestSchema,
  summary: QualityEvidenceSummarySchema,
  inspectionLots: z.array(QualityInspectionLotEvidenceSchema),
  micResults: z.array(QualityMicResultEvidenceSchema),
  usageDecision: QualityUsageDecisionEvidenceSchema.optional().nullable(),
  coaResults: z.array(QualityCoaResultEvidenceSchema),
}).strict()

export type QualityEvidenceResponse = z.infer<typeof QualityEvidenceResponseSchema>
