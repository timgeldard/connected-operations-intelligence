import { z } from 'zod'

/**
 * A single failed or warning inspection characteristic from SAP QM.
 *
 * @remarks
 * Field names preserve the V1 FailSpec short-field convention (mat, matNo, lot,
 * res, lo, hi, sev, ts) so the V1 backend payload can be mapped directly without
 * renaming. V2 consumers should use descriptive aliases where readability matters.
 *
 * Original V1 source: LabBoard.tsx FailSpec interface,
 * apps/connectedquality/frontend/src/pages/lab/LabBoard.tsx
 */
export const ConnectedQualityLabFailureSchema = z.object({
  mat: z.string(),
  matNo: z.string(),
  lot: z.string(),
  batch: z.string().optional(),
  line: z.string().optional(),
  char: z.string(),
  text: z.string(),
  res: z.number(),
  lo: z.number().optional(),
  hi: z.number().optional(),
  units: z.string(),
  sev: z.enum(['fail', 'warn']),
  ts: z.string().nullable(),
  lotType: z.string(),
})

export type ConnectedQualityLabFailure = z.infer<typeof ConnectedQualityLabFailureSchema>

/**
 * The full response returned by the /api/cq/lab/fails endpoint.
 *
 * @remarks
 * `dataAvailable: false` means the upstream dataset (Databricks gold view) has
 * not yet published for this plant. The `reason` field carries the human-readable
 * message to display in the "no data" empty state.
 */
export const ConnectedQualityLabFailuresResponseSchema = z.object({
  fails: z.array(ConnectedQualityLabFailureSchema),
  dataAvailable: z.boolean(),
  reason: z.string().optional(),
  plantId: z.string().optional(),
  lotType: z.string().optional(),
})

export type ConnectedQualityLabFailuresResponse = z.infer<typeof ConnectedQualityLabFailuresResponseSchema>

/**
 * A plant that has published inspection-result data for the Lab Board.
 *
 * @remarks
 * V1 field names in the API response are `plant_id` and `plant_name`.
 * V2 uses camelCase equivalents in the TypeScript contract.
 */
export const ConnectedQualityLabPlantSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
})

export type ConnectedQualityLabPlant = z.infer<typeof ConnectedQualityLabPlantSchema>

export const ConnectedQualityLabPlantsResponseSchema = z.object({
  plants: z.array(ConnectedQualityLabPlantSchema),
})

export type ConnectedQualityLabPlantsResponse = z.infer<typeof ConnectedQualityLabPlantsResponseSchema>
