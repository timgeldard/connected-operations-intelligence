import { z } from 'zod'

export const EntityRefSchema = z.object({
  id: z.string(),
  type: z.string(),
  displayName: z.string().optional(),
})

export const ScopeContextSchema = z.object({
  plantId: z.string().optional(),
  lineId: z.string().optional(),
  workCentreId: z.string().optional(),
  regionId: z.string().optional(),
  warehouseId: z.string().optional(),
  storageLocationId: z.string().optional(),
  materialId: z.string().optional(),
  batchId: z.string().optional(),
  processOrderId: z.string().optional(),
  supplierId: z.string().optional(),
  customerId: z.string().optional(),
})

export const WorkspaceContextSchema = z.object({
  workspaceId: z.string(),
  viewId: z.string().optional(),
  scope: ScopeContextSchema,
  userId: z.string(),
  sessionId: z.string().optional(),
})

export type EntityRef = z.infer<typeof EntityRefSchema>
export type ScopeContext = z.infer<typeof ScopeContextSchema>
export type WorkspaceContext = z.infer<typeof WorkspaceContextSchema>
