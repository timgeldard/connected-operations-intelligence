import { z } from 'zod'

export const BatchSummarySchema = z.object({
  batchId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  processOrderId: z.string().optional(),
  quantity: z.number().optional(),
  uom: z.string().optional(),
  productionDate: z.string().datetime().optional(),
  releaseStatus: z.enum(['released', 'blocked', 'restricted', 'unrestricted', 'unknown']),
  expiryDate: z.string().datetime().optional(),
})

export const ProcessOrderSummarySchema = z.object({
  processOrderId: z.string(),
  materialId: z.string(),
  materialDescription: z.string(),
  plantId: z.string(),
  scheduledStart: z.string().datetime().optional(),
  scheduledEnd: z.string().datetime().optional(),
  targetQuantity: z.number().optional(),
  actualQuantity: z.number().optional(),
  uom: z.string().optional(),
  status: z.enum(['created', 'released', 'partially-confirmed', 'confirmed', 'closed', 'deleted']),
  oeePercent: z.number().min(0).max(100).optional(),
})

/** A single warehouse hold record (one hold line). For the full batch stock + holds
 *  status used in release decisions, see {@link WarehouseHoldStatus} in batch-release. */
export const WarehouseHoldRecordSchema = z.object({
  materialId: z.string(),
  plantId: z.string(),
  storageLocationId: z.string().optional(),
  batchId: z.string().optional(),
  holdType: z.string(),
  holdReason: z.string().optional(),
  quantity: z.number(),
  uom: z.string(),
  placedAt: z.string().datetime(),
  releasedAt: z.string().datetime().optional(),
})

/** A single SPC signal occurrence. For the aggregate batch-level SPC alarm summary
 *  used in release decisions, see {@link SPCSignalSummary} in batch-release. */
export const SPCSignalRecordSchema = z.object({
  chartId: z.string(),
  materialId: z.string(),
  plantId: z.string(),
  parameter: z.string(),
  signalType: z.enum(['rule-1', 'rule-2', 'rule-3', 'rule-4', 'rule-5', 'rule-6', 'rule-7', 'rule-8']),
  detectedAt: z.string().datetime(),
  severity: z.enum(['info', 'warning', 'critical']),
  description: z.string().optional(),
})

export const TraceExposureSummarySchema = z.object({
  traceId: z.string(),
  batchId: z.string(),
  materialId: z.string(),
  direction: z.enum(['forward', 'reverse', 'both']),
  affectedBatches: z.number(),
  affectedCustomers: z.number().optional(),
  affectedSuppliers: z.number().optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  generatedAt: z.string().datetime(),
})

export type BatchSummary = z.infer<typeof BatchSummarySchema>
export type ProcessOrderSummary = z.infer<typeof ProcessOrderSummarySchema>
export type WarehouseHoldRecord = z.infer<typeof WarehouseHoldRecordSchema>
export type SPCSignalRecord = z.infer<typeof SPCSignalRecordSchema>
export type TraceExposureSummary = z.infer<typeof TraceExposureSummarySchema>
