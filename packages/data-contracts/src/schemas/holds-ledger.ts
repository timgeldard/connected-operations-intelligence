import { z } from 'zod'

export const HoldStatusSchema = z.enum(['pending', 'released', 'rejected'])
export type HoldStatus = z.infer<typeof HoldStatusSchema>

export const HoldEntrySchema = z.object({
  id: z.string(),
  reason: z.string(),
  reasonCode: z.string().nullable().optional(),
  qty: z.number(),
  /**
   * Unit of measure. NULL when the source does not expose a UOM column
   * (current holds-ledger derivation does not join to material master).
   * The UI MUST render "source units" / empty when null — it MUST NOT
   * invent KG or any other unit.
   */
  uom: z.string().nullable(),
  opened: z.string(),
  resolved: z.string().nullable().optional(),
  owner: z.string(),
  status: HoldStatusSchema,
  detail: z.string(),
  resolution: z.string().nullable().optional(),
})
export type HoldEntry = z.infer<typeof HoldEntrySchema>

export const HoldsQtyByReasonSchema = z.object({
  code: z.string(),
  label: z.string(),
  qty: z.number(),
  /** UOM is nullable for the same reason as on HoldEntry — do not invent units. */
  uom: z.string().nullable(),
  color: z.string().nullable().optional(),
})
export type HoldsQtyByReason = z.infer<typeof HoldsQtyByReasonSchema>

/**
 * Active and resolved quality holds for a batch with quantity-by-reason
 * rollup. Holds are READ-ONLY from this UI — releases are posted from
 * other workflows. The presence of a hold does not imply blocking; see
 * the `qtyByReason` totals for full impact.
 */
export const HoldsLedgerSchema = z.object({
  activeHolds: z.array(HoldEntrySchema),
  resolvedHolds: z.array(HoldEntrySchema),
  qtyByReason: z.array(HoldsQtyByReasonSchema),
})
export type HoldsLedger = z.infer<typeof HoldsLedgerSchema>
