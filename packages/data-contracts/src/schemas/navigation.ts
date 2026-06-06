import { z } from 'zod'

export const DrillThroughMetadataSchema = z.object({
  targetWorkspaceId: z.string(),
  targetViewId: z.string().optional(),
  label: z.string(),
  contextPayload: z.record(z.string()).optional(),
})

export type DrillThroughMetadata = z.infer<typeof DrillThroughMetadataSchema>
