import { z } from 'zod'

export const InvestigationDateScopeSchema = z.object({
  from: z.date().optional(),
  to: z.date().optional(),
})

export const ActiveInvestigationContextSchema = z.object({
  batchId: z.string().min(1).optional(),
  materialId: z.string().min(1).optional(),
  plantId: z.string().min(1).optional(),
  processOrderId: z.string().min(1).optional(),
  scope: InvestigationDateScopeSchema.optional(),
  lastChangedByPanel: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
})

export const INVESTIGATION_CONTEXT_KEYS = [
  'batchId',
  'materialId',
  'plantId',
  'processOrderId',
  'scope',
] as const

export type InvestigationContextKey = typeof INVESTIGATION_CONTEXT_KEYS[number]

export type ActiveInvestigationContext = z.infer<typeof ActiveInvestigationContextSchema>

export type ActiveInvestigationContextPatch = Partial<
  Omit<ActiveInvestigationContext, 'timestamp' | 'scope'>
> & {
  readonly scope?: Partial<NonNullable<ActiveInvestigationContext['scope']>>
  readonly timestamp?: string
}

export function createEmptyInvestigationContext(now: () => string = () => new Date().toISOString()): ActiveInvestigationContext {
  return { timestamp: now() }
}

export function validateInvestigationContext(context: ActiveInvestigationContext): ActiveInvestigationContext {
  return ActiveInvestigationContextSchema.parse(context)
}

export function normalizeInvestigationPatch(
  current: ActiveInvestigationContext,
  patch: ActiveInvestigationContextPatch,
  now: () => string = () => new Date().toISOString(),
): ActiveInvestigationContext {
  const next: ActiveInvestigationContext = {
    ...current,
    ...patch,
    scope: patch.scope === undefined ? current.scope : { ...current.scope, ...patch.scope },
    timestamp: patch.timestamp ?? now(),
  }

  return validateInvestigationContext(removeEmptyValues(next))
}

function removeEmptyValues(context: ActiveInvestigationContext): ActiveInvestigationContext {
  const cleaned: ActiveInvestigationContext = { timestamp: context.timestamp }
  if (context.batchId) cleaned.batchId = context.batchId
  if (context.materialId) cleaned.materialId = context.materialId
  if (context.plantId) cleaned.plantId = context.plantId
  if (context.processOrderId) cleaned.processOrderId = context.processOrderId
  if (context.lastChangedByPanel) cleaned.lastChangedByPanel = context.lastChangedByPanel
  if (context.scope?.from || context.scope?.to) cleaned.scope = context.scope
  return cleaned
}
