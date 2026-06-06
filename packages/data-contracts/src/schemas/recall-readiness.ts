import { z } from 'zod'

/**
 * Delivery-status taxonomy.
 *
 * `delivery-evidence` is the *source-truthful* default: gold_batch_delivery_v
 * exposes a posting record (the delivery exists in the lineage) but does NOT
 * expose an operational status. We must not invent "delivered" — that is an
 * operational claim. Other values map from a future delivery-status column.
 */
export const RecallDeliveryStatusSchema = z.enum([
  'delivery-evidence',
  'delivered',
  'in-transit',
  'recalled',
  'blocked',
  'unknown',
])
export type RecallDeliveryStatus = z.infer<typeof RecallDeliveryStatusSchema>

export const RecallDeliverySchema = z.object({
  id: z.string(),
  customer: z.string(),
  country: z.string(),
  date: z.string(),
  qty: z.number(),
  status: RecallDeliveryStatusSchema,
  /**
   * Provenance for `status`. `delivery-record-present` means the row was
   * observed in gold_batch_delivery_v with no governed operational status.
   */
  statusSource: z
    .enum(['delivery-record-present', 'governed', 'unavailable'])
    .nullable()
    .optional(),
  doc: z.string(),
})
export type RecallDelivery = z.infer<typeof RecallDeliverySchema>

export const RecallCountrySchema = z.object({
  code: z.string(),
  name: z.string(),
  qty: z.number(),
  pct: z.number(),
})
export type RecallCountry = z.infer<typeof RecallCountrySchema>

export const RecallTotalsSchema = z.object({
  customers: z.number().int(),
  countries: z.number().int(),
  deliveries: z.number().int(),
  shipped: z.number(),
  uom: z.string(),
})
export type RecallTotals = z.infer<typeof RecallTotalsSchema>

/**
 * Recall readiness for a batch — cross-plant exposure with delivery-level
 * detail and per-country aggregates. The active plant context is NEVER used
 * to filter this query — a shipment may originate at plant A but the
 * material may also be received and used at plant B.
 *
 * `recommendationStatus`: the recall decision is governed and is NOT
 * computed by this route. The default `not-evaluated` value MUST be
 * preserved until a governed recall-rule engine is wired. Do NOT interpret
 * `not-evaluated` as "no recall needed".
 */
export const RecallReadinessSchema = z.object({
  totals: RecallTotalsSchema,
  countries: z.array(RecallCountrySchema),
  deliveries: z.array(RecallDeliverySchema),
  recommendationStatus: z.enum(['not-evaluated', 'recommended', 'not-recommended']),
})
export type RecallReadiness = z.infer<typeof RecallReadinessSchema>
