import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

const ChartTypeSchema = z.enum([
  'xbar-r',
  'xbar-s',
  'individuals',
  'p-chart',
  'np-chart',
  'c-chart',
  'u-chart',
  'ewma',
  'cusum',
])

const LimitProvenanceSchema = z.enum([
  'mock-fixture',
  'calculated-from-sample',
  'imported-from-approved-source',
  'unknown',
])

const ApprovalStateSchema = z.enum([
  'approved',
  'not-approved',
  'pending-validation',
  'unavailable',
])

// ---------------------------------------------------------------------------
// MonitoredSPCCharacteristic
// ---------------------------------------------------------------------------

export const MonitoredSPCCharacteristicSchema = z.object({
  characteristicId: z.string().describe('[classification: source-field]'),
  characteristicName: z.string().describe('[classification: source-field]'),
  micId: z.string().optional().describe('[classification: source-field]'),
  chartType: ChartTypeSchema.describe('[classification: source-field]'),
  batchCount: z.number().int().min(0).describe('[classification: source-derived]'),
  avgSamplesPerBatch: z.number().optional().describe('[classification: source-derived]'),
  hasActiveSignal: z.boolean().describe('[classification: source-derived]'),
  highestSignalSeverity: SeveritySchema.optional().describe('[classification: source-derived]'),
  operationId: z.string().optional().describe('[classification: source-field]'),
  chartTypeSource: z
    .enum(['heuristic', 'override', 'manual'])
    .optional()
    .describe('[classification: application-heuristic]'),
})

export type MonitoredSPCCharacteristic = z.infer<typeof MonitoredSPCCharacteristicSchema>

// ---------------------------------------------------------------------------
// SPCMonitoringContext
// ---------------------------------------------------------------------------

export const SPCMonitoringContextSchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  // workCentreId remains for legacy-bridge compatibility. The verified SPC
  // source has no SAP work-centre column; operationId below carries the
  // verified `operation_id` (sequential inspection-operation identifier).
  // See domain-integrations/spc/docs/spc-native-contract-alignment-audit.md
  // items 2.1, 2.2 and spc-v2-contract-mapping.md §5.
  workCentreId: z.string().optional().describe('[classification: source-field]'),
  operationId: z.string().optional().describe('[classification: source-field]'),
  characteristicId: z.string().optional().describe('[classification: source-field]'),
  chartType: ChartTypeSchema.optional().describe('[classification: source-field]'),
  activeSignals: z.number().int().min(0).describe('[classification: source-derived]'),
  highestSeverity: SeveritySchema.describe('[classification: source-derived]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
  activeScope: z.string().optional().describe('[classification: application-derived]'),
  activeView: z.string().optional().describe('[classification: application-derived]'),
})

export type SPCMonitoringContext = z.infer<typeof SPCMonitoringContextSchema>

// ---------------------------------------------------------------------------
// SPCSummary
// ---------------------------------------------------------------------------

export const SPCSummarySchema = z.object({
  chartsMonitored: z.number().int().min(0).describe('[classification: source-derived]'),
  activeSignals: z.number().int().min(0).describe('[classification: source-derived]'),
  outOfControlSignals: z.number().int().min(0).describe('[classification: source-derived]'),
  warningSignals: z.number().int().min(0).describe('[classification: source-derived]'),
  characteristicsAtRisk: z.number().int().min(0).describe('[classification: source-derived]'),
  highestSeverity: SeveritySchema.describe('[classification: source-derived]'),
  recommendedAction: z.string().describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type SPCSummary = z.infer<typeof SPCSummarySchema>

// ---------------------------------------------------------------------------
// SPCSignal
// ---------------------------------------------------------------------------

export const SPCSignalSchema = z.object({
  signalId: z.string().describe('[classification: source-field]'),
  characteristicId: z.string().describe('[classification: source-field]'),
  characteristicName: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  chartType: ChartTypeSchema.describe('[classification: source-field]'),
  rule: z.string().describe('[classification: source-derived]'),
  ruleCode: z.string().optional().nullable().describe('[classification: source-derived]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  detectedAt: z.string().datetime().describe('[classification: source-field]'),
  samplePointId: z.string().describe('[classification: source-field]'),
  resultValue: z.number().describe('[classification: source-field]'),
  recommendedAction: z.string().describe('[classification: application-heuristic]'),
  status: z
    .enum(['active', 'acknowledged', 'investigating', 'resolved', 'false-positive'])
    .describe('[classification: application-heuristic]'),
})

export type SPCSignal = z.infer<typeof SPCSignalSchema>

// ---------------------------------------------------------------------------
// ControlChartPoint
// ---------------------------------------------------------------------------

/**
 * Control-chart point.
 *
 * `status` is source-truthful by default:
 *   - `not-evaluated` — the route returned the subgroup point but no
 *     server-side rule engine has classified it. The native subgroup route
 *     (PR #82) intentionally emits this rather than claiming `in-control`.
 *   - `in-control` / `warning` / `out-of-control` — set ONLY when a
 *     governed signal-engine (e.g. Nelson/WECO via stored flags) has
 *     evaluated the point.
 *
 * UI MUST NOT collapse `not-evaluated` into `in-control`. Tests in this
 * domain enforce that the native databricks-api adapter never emits
 * `in-control` without a governed source.
 */
export const ControlChartPointSchema = z.object({
  pointId: z.string().describe('[classification: source-field]'),
  timestamp: z.string().datetime().describe('[classification: source-field]'),
  value: z.number().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  sampleId: z.string().optional().describe('[classification: source-field]'),
  signalIds: z.array(z.string()).describe('[classification: source-derived]'),
  status: z
    .enum(['not-evaluated', 'in-control', 'warning', 'out-of-control'])
    .describe('[classification: application-heuristic]'),
})

export type ControlChartPoint = z.infer<typeof ControlChartPointSchema>

// ---------------------------------------------------------------------------
// ControlChartSeries
// ---------------------------------------------------------------------------

export const ControlChartSeriesSchema = z.object({
  chartId: z.string().describe('[classification: source-field]'),
  chartType: ChartTypeSchema.describe('[classification: source-field]'),
  characteristicId: z.string().describe('[classification: source-field]'),
  characteristicName: z.string().describe('[classification: source-field]'),
  points: z.array(ControlChartPointSchema),
  centerLine: z.number().optional().describe('[classification: source-derived]'),
  upperControlLimit: z.number().optional().describe('[classification: source-derived]'),
  lowerControlLimit: z.number().optional().describe('[classification: source-derived]'),
  upperSpecLimit: z.number().optional().describe('[classification: source-field]'),
  lowerSpecLimit: z.number().optional().describe('[classification: source-field]'),
  // Source-truthful: when the upstream view (e.g. SPCSubgroupResponse
  // slice 1) does not expose a UOM column, the adapter MUST emit
  // `null` rather than an invented empty string. Relaxed from the
  // previous required-string contract in PR 8.
  unitOfMeasure: z.string().nullable().optional().describe('[classification: source-field]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
  limitProvenance: LimitProvenanceSchema.optional().describe('[classification: source-derived]'),
  approvalState: ApprovalStateSchema.optional().describe('[classification: governance-pending]'),
  lockedLimits: z.boolean().optional().describe('[classification: source-field]'),
  lockedFrom: z.string().datetime().optional().describe('[classification: source-field]'),
  lockedTo: z.string().datetime().optional().describe('[classification: source-field]'),
})

export type ControlChartSeries = z.infer<typeof ControlChartSeriesSchema>

// ---------------------------------------------------------------------------
// CharacteristicCapability
// ---------------------------------------------------------------------------

export const CharacteristicCapabilitySchema = z.object({
  characteristicId: z.string().describe('[classification: source-field]'),
  characteristicName: z.string().describe('[classification: source-field]'),
  cp: z.number().describe('[classification: source-derived]'),
  cpk: z.number().describe('[classification: source-derived]'),
  pp: z.number().describe('[classification: source-derived]'),
  ppk: z.number().describe('[classification: source-derived]'),
  sampleCount: z.number().int().min(0).describe('[classification: source-derived]'),
  mean: z.number().describe('[classification: source-derived]'),
  standardDeviation: z.number().min(0).describe('[classification: source-derived]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
  interpretation: z
    .enum(['capable', 'marginal', 'not-capable', 'insufficient-data'])
    .describe('[classification: application-heuristic]'),
  limitProvenance: LimitProvenanceSchema.optional().describe('[classification: source-derived]'),
  approvalState: ApprovalStateSchema.optional().describe('[classification: governance-pending]'),
})

export type CharacteristicCapability = z.infer<typeof CharacteristicCapabilitySchema>

// ---------------------------------------------------------------------------
// SPCAlarmHistoryItem
// ---------------------------------------------------------------------------

export const SPCAlarmHistoryItemSchema = z.object({
  alarmId: z.string().describe('[classification: source-field]'),
  timestamp: z.string().datetime().describe('[classification: source-field]'),
  characteristicId: z.string().describe('[classification: source-field]'),
  rule: z.string().describe('[classification: source-derived]'),
  ruleCode: z.string().optional().describe('[classification: source-derived]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  status: z
    .enum(['active', 'acknowledged', 'investigating', 'resolved', 'false-positive'])
    .describe('[classification: application-heuristic]'),
  acknowledgedBy: z.string().optional().describe('[classification: source-field]'),
  acknowledgedAt: z.string().datetime().optional().describe('[classification: source-field]'),
  linkedBatchId: z.string().optional().describe('[classification: source-field]'),
})

export type SPCAlarmHistoryItem = z.infer<typeof SPCAlarmHistoryItemSchema>

// ---------------------------------------------------------------------------
// SPCRelatedBatch
// ---------------------------------------------------------------------------

export const SPCRelatedBatchSchema = z.object({
  batchId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  status: z
    .enum(['released', 'on-hold', 'rejected', 'under-review', 'awaiting-review'])
    .describe('[classification: application-heuristic]'),
  relatedSignalCount: z.number().int().min(0).describe('[classification: source-derived]'),
  releaseImpact: z
    .enum(['blocking', 'risk', 'none'])
    .describe('[classification: application-heuristic]'),
  drillThroughTarget: z.string().optional().describe('[classification: application-derived]'),
})

export type SPCRelatedBatch = z.infer<typeof SPCRelatedBatchSchema>

// ---------------------------------------------------------------------------
// SPCSubgroupPoint / SPCSubgroupResponse  (slice 1 — native Databricks only)
//
// Narrow schemas backed by spc_quality_metric_subgroup_mv (verified UAT
// 2026-05-22). Uses GROUP BY (batch_id, batch_date); one point per subgroup.
// capabilityAvailable / nelsonStoredFlagsAvailable are z.literal(false) to
// prevent clients from requesting features that do not exist in the source.
// lockedLimits is z.null() for slice 1 — spc_locked_limits DESCRIBE TABLE
// not confirmed; deferred to slice 2.
// ---------------------------------------------------------------------------

export const SPCSubgroupPointSchema = z.object({
  batchId: z.string().describe('[classification: source-field]'),
  batchDate: z.string().describe('[classification: source-field]'),
  subgroupMean: z.number().describe('[classification: source-derived]'),
  subgroupRange: z.number().nullable().describe('[classification: source-derived]'),
  sampleCount: z.number().int().min(1).describe('[classification: source-derived]'),
  lslSpec: z.number().nullable().describe('[classification: source-field]'),
  uslSpec: z.number().nullable().describe('[classification: source-field]'),
})

export type SPCSubgroupPoint = z.infer<typeof SPCSubgroupPointSchema>

export const SPCSubgroupResponseSchema = z.object({
  materialId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  micId: z.string().describe('[classification: source-field]'),
  micName: z.string().nullable().describe('[classification: source-field]'),
  operationId: z.string().describe('[classification: source-field]'),
  points: z.array(SPCSubgroupPointSchema),
  lockedLimits: z.null().describe('[classification: unavailable]'),
  capabilityAvailable: z.literal(false).describe('[classification: unavailable]'),
  nelsonStoredFlagsAvailable: z.literal(false).describe('[classification: unavailable]'),
  signalsClientSideOnly: z.literal(true).describe('[classification: application-derived]'),
})

export type SPCSubgroupResponse = z.infer<typeof SPCSubgroupResponseSchema>
