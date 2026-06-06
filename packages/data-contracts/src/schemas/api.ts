import { z } from 'zod'

export const ApiErrorEnvelopeSchema = z.object({
  detail: z.union([z.string(), z.array(z.unknown()), z.record(z.unknown())]),
  status_code: z.number().optional(),
  error_id: z.string().optional(),
})

export const PagedResultSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    hasNextPage: z.boolean(),
  })

export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>
export type PagedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasNextPage: boolean
}
