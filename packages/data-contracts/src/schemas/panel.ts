import { z } from 'zod'

export const EvidencePanelDisplayStateSchema = z.enum([
  'loading',
  'ready',
  'stale',
  'partial',
  'error',
  'unauthorized',
  'not-applicable',
  'waiting-for-context',
])

export const FreshnessMetadataSchema = z.object({
  lastRefreshedAt: z.string().datetime().nullable(),
  isStale: z.boolean(),
  staleAfterSeconds: z.number(),
})

export const ConfidenceMetadataSchema = z.object({
  level: z.number().min(0).max(1).nullable(),
  reason: z.string().optional(),
  hidden: z.boolean().default(false),
})

export const EvidencePanelStateSchema = z.object({
  panelId: z.string(),
  displayState: EvidencePanelDisplayStateSchema,
  freshness: FreshnessMetadataSchema.optional(),
  confidence: ConfidenceMetadataSchema.optional(),
  errorMessage: z.string().optional(),
})

export type EvidencePanelDisplayState = z.infer<typeof EvidencePanelDisplayStateSchema>
export type FreshnessMetadata = z.infer<typeof FreshnessMetadataSchema>
export type ConfidenceMetadata = z.infer<typeof ConfidenceMetadataSchema>
export type EvidencePanelState = z.infer<typeof EvidencePanelStateSchema>
