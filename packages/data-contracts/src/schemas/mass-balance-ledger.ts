import { z } from 'zod'

/**
 * One SAP movement on the batch. Codes are MSEG movement codes:
 * 101 = production receipt, 261 = consumption to order, 601 = goods issue
 * (dispatch), 701 = stock adjustment, Z01 = company-specific extension.
 */
export const MassBalanceEventSchema = z.object({
  d: z.number().int().describe('[classification: source-field]'),
  date: z.string().nullable().optional().describe('[classification: source-field]'),
  delta: z.number().describe('[classification: source-derived]'),
  cum: z.number().describe('[classification: source-derived]'),
  code: z.enum(['101', '261', '601', '701', 'Z01']).describe('[classification: source-field]'),
  label: z.string().describe('[classification: application-derived]'),
})
export type MassBalanceEvent = z.infer<typeof MassBalanceEventSchema>

export const MassBalancePostingsSchema = z.object({
  production: z.number().int().describe('[classification: source-derived]'),
  consumption: z.number().int().describe('[classification: source-derived]'),
  dispatch: z.number().int().describe('[classification: source-derived]'),
  adjustment: z.number().int().describe('[classification: source-derived]'),
})

export const MassBalanceKpiSchema = z.object({
  produced: z.number().describe('[classification: source-derived]'),
  consumed: z.number().describe('[classification: source-derived]'),
  shipped: z.number().describe('[classification: source-derived]'),
  adjusted: z.number().describe('[classification: source-derived]'),
  current: z.number().describe('[classification: source-derived]'),
  variance: z.number().describe('[classification: source-derived]'),
  // uom is source-truthful: emit verbatim when present, `null` when the
  // source is silent. The previous empty-string sentinel was misleading —
  // it suggested "unit is empty" rather than "unit is unavailable".
  // Do NOT default to 'KG' or any other unit.
  uom: z.string().nullable().describe('[classification: source-field]'),
  postings: MassBalancePostingsSchema,
})

/**
 * Mass-balance ledger for a batch — derived from SAP MSEG (material
 * movements). The mathematical invariant is:
 *   variance = produced + adjusted + consumed + shipped - current
 * where `consumed` and `shipped` carry their natural negative signs.
 *
 * Caveats — surface these in the UI; DO NOT claim "reconciled" without
 * caveat:
 *   1. `MOVEMENT_CATEGORY` direction semantics are unresolved in the
 *      traceability mass-balance audit. The bucketing in this schema is
 *      derived from MOVEMENT_TYPE codes only.
 *   2. `BALANCE_QTY` from gold_batch_mass_balance_v is used as the
 *      running on-hand. Its derivation rules are NOT yet documented; the
 *      panel must not treat it as governed truth.
 *   3. Movement-type codes outside the known {101/102/131, 261/262,
 *      601/602, 701/702/711/712} sets fall into the `Z01` bucket and
 *      will not contribute to KPI rollups — flag this in tests when
 *      observed.
 */
export const MassBalanceLedgerSchema = z.object({
  kpi: MassBalanceKpiSchema,
  events: z.array(MassBalanceEventSchema),
  dateStart: z.string().describe('[classification: source-field]'),
  dateEnd: z.string().describe('[classification: source-field]'),
  /**
   * Whether the variance has been reconciled by a governed rule. ALWAYS
   * `application-heuristic` until a governed reconciliation engine is
   * wired. `governed` is reserved for future use.
   */
  reconciliationSource: z
    .enum(['application-heuristic', 'governed'])
    .describe('[classification: application-heuristic]'),
})
export type MassBalanceLedger = z.infer<typeof MassBalanceLedgerSchema>
