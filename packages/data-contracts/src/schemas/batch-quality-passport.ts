import { z } from 'zod'

/**
 * Quality characteristic (CoA row) — one measured spec on a batch.
 * `status` is server-decided; the panel renders the visual based on it.
 * `binary` is set for go/no-go characteristics (e.g. Listeria "Absent").
 */
export const QualityCharacteristicSchema = z.object({
  mic: z.string().describe('[classification: source-field]'),
  param: z.string().describe('[classification: source-field]'),
  low: z.number().describe('[classification: source-field]'),
  high: z.number().describe('[classification: source-field]'),
  target: z.number().describe('[classification: source-field]'),
  actual: z.number().describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  status: z.enum(['ok', 'warn', 'fail']).describe('[classification: application-heuristic]'),
  binary: z.string().nullable().optional().describe('[classification: source-field]'),
})
export type QualityCharacteristic = z.infer<typeof QualityCharacteristicSchema>

export const LotHistoryEntrySchema = z.object({
  id: z.string().describe('[classification: source-field]'),
  date: z.string().describe('[classification: source-field]'),
  inspection: z.string().describe('[classification: source-field]'),
  result: z
    .enum(['accept', 'conditional', 'reject'])
    .describe('[classification: application-heuristic]'),
  mics: z.number().int().describe('[classification: source-derived]'),
  failed: z.number().int().describe('[classification: source-derived]'),
  decisionBy: z.string().describe('[classification: source-field]'),
})
export type LotHistoryEntry = z.infer<typeof LotHistoryEntrySchema>

export const PassportIdentitySchema = z.object({
  materialDescription: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  processOrderId: z.string().describe('[classification: source-field]'),
  manufactureDate: z.string().describe('[classification: source-field]'),
  expiryDate: z.string().describe('[classification: source-field]'),
  daysToExpiry: z.number().int().describe('[classification: application-derived]'),
  uom: z.string().describe('[classification: source-field]'),
})
export type PassportIdentity = z.infer<typeof PassportIdentitySchema>

/**
 * Quality KPI block.
 *
 * - `heuristicQualityConfidence` is an application-level derived score (0–100)
 *   computed from failed/warn MIC counts and rejected results. It is NOT a
 *   governed SAP/QM field and MUST be presented as a heuristic in the UI.
 * - `confidenceSource` is fixed at `application-heuristic` while the score is
 *   client-derived; it transitions to `governed` only when a backed QM
 *   calculation is authorised.
 * - `heuristicQualityStatus` is also derived from the same heuristic — treat as a
 *   *summary indicator*, not a release decision.
 */
export const PassportQualitySchema = z.object({
  heuristicQualityConfidence: z
    .number()
    .min(0)
    .max(100)
    .describe('[classification: application-heuristic]'),
  confidenceSource: z
    .enum(['application-heuristic', 'governed'])
    .describe('[classification: application-heuristic]'),
  heuristicQualityStatus: z
    .enum(['accepted', 'conditional', 'rejected'])
    .describe('[classification: application-heuristic]'),
  notes: z.array(z.string()).describe('[classification: application-derived]'),
  coa: z.array(QualityCharacteristicSchema),
})
export type PassportQuality = z.infer<typeof PassportQualitySchema>

export const PassportStockSchema = z.object({
  unrestricted: z.number().describe('[classification: source-field]'),
  qualityInspection: z.number().describe('[classification: source-field]'),
  blocked: z.number().describe('[classification: source-field]'),
  restricted: z.number().describe('[classification: source-field]'),
  transit: z.number().describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
})
export type PassportStock = z.infer<typeof PassportStockSchema>

/**
 * Production block — sourced from gold_batch_production_history_v.
 *
 * The 2026-05-25 Databricks compatibility audit (Finding #2) confirmed that
 * the live UAT view exposes only PROCESS_ORDER_ID, BATCH_ID, PLANT_ID,
 * MATERIAL_ID, POSTING_DATE, BATCH_QTY, UOM, and quality_status. The
 * concepts of production line, operator, planned-vs-actual quantity, yield,
 * confirmed-end timestamp, originating customer, and free-text production
 * notes are NOT modelled in the gold layer today.
 *
 * The seven fields without a live source are relaxed to nullable + optional
 * so the API can be source-truthful (emit `null`) rather than emit a
 * reassuring contract default such as `""` or `0.0`. The three live-sourced
 * fields stay required:
 *   - orderId      ← ph.PROCESS_ORDER_ID
 *   - startedAt    ← ph.POSTING_DATE (production-posting evidence, NOT a
 *                    confirmed production-start timestamp)
 *   - actualQty    ← ph.BATCH_QTY (actual batch quantity recorded on the
 *                    posting, NOT a planned quantity)
 *
 * See docs/data-layer/trace2-batch-quality-passport-source-verification.md
 * for the full mapping and the data-platform follow-ups.
 */
export const PassportProductionSchema = z.object({
  orderId: z.string().describe('[classification: source-field]'),
  line: z.string().nullable().optional().describe('[classification: source-field]'),
  operator: z.string().nullable().optional().describe('[classification: source-field]'),
  startedAt: z.string().describe('[classification: source-field]'),
  confirmedAt: z.string().nullable().optional().describe('[classification: source-field]'),
  plannedQty: z.number().nullable().optional().describe('[classification: source-field]'),
  actualQty: z.number().describe('[classification: source-field]'),
  yield: z.number().nullable().optional().describe('[classification: source-derived]'),
  originatingCustomer: z.string().nullable().optional().describe('[classification: source-field]'),
  notes: z.string().nullable().optional().describe('[classification: source-field]'),
})
export type PassportProduction = z.infer<typeof PassportProductionSchema>

export const PassportMassBalanceSchema = z.object({
  variance: z.number().describe('[classification: source-derived]'),
  note: z.string().describe('[classification: application-derived]'),
  detailUrl: z.string().nullable().optional().describe('[classification: application-derived]'),
})
export type PassportMassBalance = z.infer<typeof PassportMassBalanceSchema>

/**
 * Usage-decision evidence — NOT governed signoff.
 *
 * This represents the SAP usage-decision audit trail (who recorded the
 * inspection decision, when). It is NOT an e-signature, release approval,
 * Group QA signoff, or any other governed authority. The UI MUST label
 * these rows as "decision evidence" / "decision by" — never as "signed
 * off" / "approved" / "released".
 *
 * `decisionType` distinguishes the SAP event recorded:
 *   - `usage-decision-recorded` — INSPECTION_LOT USAGE_DECISION was entered
 *   - `inspection-completed`    — inspection lot reached END status
 *   - `none`                    — no decision evidence available
 */
export const PassportUsageDecisionEvidenceSchema = z.object({
  role: z.string().describe('[classification: source-field]'),
  decisionBy: z.string().describe('[classification: source-field]'),
  decisionType: z
    .enum(['usage-decision-recorded', 'inspection-completed', 'none'])
    .describe('[classification: source-field]'),
  recordedAt: z.string().describe('[classification: source-field]'),
})
export type PassportUsageDecisionEvidence = z.infer<typeof PassportUsageDecisionEvidenceSchema>

/**
 * Batch Quality Passport — consolidated quality identity card for a batch.
 *
 * Audience-aware: internal mode shows full detail; external (customer-safe)
 * mode masks supplier names, plant code, process order, reviewer names, and
 * production line/operator. Backend must enforce masking; frontend visually
 * adapts when the audience flag is set.
 *
 * `usageDecisionEvidence` replaces what was formerly called `signoff`.
 * This rename is deliberate — see PassportUsageDecisionEvidenceSchema.
 * Do NOT treat these rows as governed approval / e-signature / release
 * authority. The UI MUST surface them as decision *evidence* only.
 */
export const BatchQualityPassportSchema = z.object({
  identity: PassportIdentitySchema,
  quality: PassportQualitySchema,
  stock: PassportStockSchema,
  production: PassportProductionSchema,
  lotHistory: z.array(LotHistoryEntrySchema),
  massBalance: PassportMassBalanceSchema,
  usageDecisionEvidence: z.array(PassportUsageDecisionEvidenceSchema),
  inspectionLotCount: z.number().int().min(0).optional().describe('[classification: source-field]'),
  productionLotCount: z.number().int().min(0).optional().describe('[classification: source-derived]'),
})
export type BatchQualityPassport = z.infer<typeof BatchQualityPassportSchema>
