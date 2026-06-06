import { z } from 'zod'

export const SupplierLotRiskSchema = z.enum(['low', 'medium', 'high', 'unknown'])
export type SupplierLotRisk = z.infer<typeof SupplierLotRiskSchema>

export const SupplierLotSchema = z.object({
  vendor: z.string(),
  vendorBatch: z.string(),
  material: z.string(),
  receipt: z.string(),
  consumed: z.number(),
  uom: z.string(),
  coa: z.string().nullable().optional(),
  risk: SupplierLotRiskSchema,
})
export type SupplierLot = z.infer<typeof SupplierLotSchema>

export const SiblingBatchSchema = z.object({
  plant: z.string(),
  plantId: z.string().nullable().optional(),
  batchId: z.string(),
  mfg: z.string(),
  qty: z.number(),
  vendorBatch: z.string(),
})
export type SiblingBatch = z.infer<typeof SiblingBatchSchema>

/**
 * Supplier batches consumed by this batch (upstream) plus sibling batches at
 * other plants that consumed the same vendor lot (cross-plant ripple risk).
 *
 * Sibling batches must NEVER be filtered by the active plant — the whole
 * point is to surface cross-plant exposure of a shared vendor lot.
 */
export const SupplierBatchViewSchema = z.object({
  consumedLots: z.array(SupplierLotSchema),
  siblingBatches: z.array(SiblingBatchSchema),
})
export type SupplierBatchView = z.infer<typeof SupplierBatchViewSchema>
