import { z } from 'zod'

export const TimelineEventTypeSchema = z.enum([
  'production',
  'consumption',
  'qc',
  'release',
  'approval',
  'hold',
  'dispatch',
  'note',
])
export type TimelineEventType = z.infer<typeof TimelineEventTypeSchema>

export const TimelineEventToneSchema = z.enum(['good', 'warn', 'bad', 'brand', 'neutral'])
export type TimelineEventTone = z.infer<typeof TimelineEventToneSchema>

export const TimelineEventSourceSystemSchema = z.enum(['SAP', 'LIMS', 'TRACE', 'MANUAL'])
export type TimelineEventSourceSystem = z.infer<typeof TimelineEventSourceSystemSchema>

export const TimelineEventSchema = z.object({
  ts: z.string(),
  type: TimelineEventTypeSchema,
  label: z.string(),
  actor: z.string(),
  detail: z.string(),
  tone: TimelineEventToneSchema,
  sourceSystem: TimelineEventSourceSystemSchema.nullable().optional(),
})
export type TimelineEvent = z.infer<typeof TimelineEventSchema>

/**
 * Chronological investigation events for a batch — union across SAP, LIMS,
 * TRACE, and manual notes. Backend decides `tone` and `sourceSystem`; UI
 * just renders the badges from those values.
 */
export const InvestigationTimelineSchema = z.object({
  events: z.array(TimelineEventSchema),
})
export type InvestigationTimeline = z.infer<typeof InvestigationTimelineSchema>
