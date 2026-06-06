import { z } from 'zod'

// ---------------------------------------------------------------------------
// TraceInvestigationContext
// ---------------------------------------------------------------------------

export const TraceInvestigationContextSchema = z.object({
  investigationId: z.string().describe('[classification: source-field]'),
  status: z
    .enum(['open', 'in-progress', 'escalated', 'resolved', 'closed'])
    .describe('[classification: source-field]'),
  severity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  processOrderId: z.string().optional().describe('[classification: source-field]'),
  initiatedBy: z.string().describe('[classification: source-field]'),
  initiatedAt: z.string().datetime().describe('[classification: source-field]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
  scope: z
    .object({
      plantId: z.string().optional().describe('[classification: source-field]'),
      lineId: z.string().optional().describe('[classification: source-field]'),
      regionId: z.string().optional().describe('[classification: source-field]'),
      materialId: z.string().optional().describe('[classification: source-field]'),
      batchId: z.string().optional().describe('[classification: source-field]'),
      processOrderId: z.string().optional().describe('[classification: source-field]'),
    })
    .optional(),
  activeView: z.string().optional().describe('[classification: application-derived]'),
})

export type TraceInvestigationContext = z.infer<typeof TraceInvestigationContextSchema>

// ---------------------------------------------------------------------------
// BatchHeaderSummary
// ---------------------------------------------------------------------------

export const BatchHeaderSummarySchema = z.object({
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  plantName: z.string().describe('[classification: source-field]'),
  batchStatus: z
    .enum(['active', 'archived', 'blocked', 'deleted', 'unknown'])
    .describe('[classification: source-field]'),
  quantity: z.number().optional().describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: source-field]'),
  manufactureDate: z.string().datetime().optional().describe('[classification: source-field]'),
  expiryDate: z.string().datetime().optional().describe('[classification: source-field]'),
  vendorBatchId: z.string().optional().describe('[classification: source-field]'),
  processOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  // Individual stock bucket quantities — sourced from gold_batch_stock_v (all columns verified live 2026-05-19).
  // All optional: absent means the source row did not return a value, not that the stock is zero.
  unrestricted: z.number().optional().describe('[classification: source-field]'),
  blocked: z.number().optional().describe('[classification: source-field]'),
  qualityInspection: z.number().optional().describe('[classification: source-field]'),
  restricted: z.number().optional().describe('[classification: source-field]'),
  transit: z.number().optional().describe('[classification: source-field]'),
  // SAP restricted stock maps to 'restricted', NOT 'returns'. 'returns' is retained only for
  // legacy/mock compatibility or explicit returns-type stock if sourced from a verified field.
  stockStatus: z
    .enum(['unrestricted', 'quality-inspection', 'blocked', 'restricted', 'returns', 'transit'])
    .describe('[classification: application-heuristic]'),
  // 'unknown' means QM usage-decision data is not available from this source.
  // It must NOT be treated as a positive quality signal.
  // 'not-applicable' means quality inspection is structurally not applicable to this batch type.
  qualityStatus: z
    .enum(['accepted', 'rejected', 'pending', 'conditional', 'not-applicable', 'unknown'])
    .describe('[classification: application-heuristic]'),
  releaseStatus: z
    .enum(['released', 'blocked', 'restricted', 'not-released', 'unknown'])
    .describe('[classification: governance-pending]'),
})

export type BatchHeaderSummary = z.infer<typeof BatchHeaderSummarySchema>

// ---------------------------------------------------------------------------
// TraceNode
// ---------------------------------------------------------------------------

export const TraceNodeSchema = z.object({
  id: z.string().describe('[classification: source-field]'),
  type: z
    .enum([
      'raw-material',
      'intermediate',
      'finished-good',
      'customer-delivery',
      'supplier-lot',
      'process-order',
    ])
    .optional()
    .describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  plantId: z.string().optional().describe('[classification: source-field]'),
  quantity: z.number().optional().describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: source-field]'),
  status: z
    .enum(['resolved', 'unresolved', 'blocked', 'partial'])
    .optional()
    .describe('[classification: source-field]'),
  riskLevel: z
    .enum(['none', 'low', 'medium', 'high', 'critical'])
    .optional()
    .describe('[classification: application-heuristic]'),
  // Fields from gold_batch_lineage graph response
  depth: z.number().int().optional().describe('[classification: source-field]'),
  directions: z.array(z.string()).optional().describe('[classification: source-derived]'),
  isAnchor: z.boolean().optional().describe('[classification: source-derived]'),
})

export type TraceNode = z.infer<typeof TraceNodeSchema>

// ---------------------------------------------------------------------------
// TraceEdge
// ---------------------------------------------------------------------------

export const TraceEdgeSchema = z.object({
  id: z.string().describe('[classification: source-field]'),
  source: z.string().describe('[classification: source-field]'),
  target: z.string().describe('[classification: source-field]'),
  relationshipType: z
    .enum([
      'component-of', // legacy/generic — retained for backward compatibility
      'produced-from', // batch was produced from this upstream batch
      'split-from', // batch was split from this batch
      'merged-into', // batch was merged into this batch
      'transferred-to', // stock transfer (STO or plant transfer)
      'delivered-to', // customer delivery
      'vendor-receipt', // inbound goods receipt from an external supplier
      'consumed-by', // batch/component consumed into a production order
    ])
    .optional()
    .describe('[classification: application-derived]'),
  // Raw LINK_TYPE value from gold_batch_lineage — preserved for audit and debug.
  linkType: z.string().optional().describe('[classification: source-field]'),
  quantity: z.number().optional().describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: source-field]'),
  movementType: z.string().optional().describe('[classification: source-field]'),
  documentReference: z.string().optional().describe('[classification: source-field]'),
  // Full evidence fields from gold_batch_lineage
  postingDate: z.string().optional().describe('[classification: source-field]'),
  processOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  materialDocumentNumber: z.string().optional().describe('[classification: source-field]'),
  purchaseOrderId: z.string().optional().describe('[classification: source-field]'),
  supplierId: z.string().optional().describe('[classification: source-field]'),
  customerId: z.string().optional().describe('[classification: source-field]'),
  deliveryId: z.string().optional().describe('[classification: source-field]'),
  salesOrderId: z.string().optional().describe('[classification: source-field]'),
})

export type TraceEdge = z.infer<typeof TraceEdgeSchema>

// ---------------------------------------------------------------------------
// TraceGraph
// ---------------------------------------------------------------------------

export const TraceGraphSchema = z.object({
  nodes: z.array(TraceNodeSchema),
  edges: z.array(TraceEdgeSchema),
  direction: z.enum(['upstream', 'downstream', 'both']).describe('[classification: source-field]'),
  depth: z.number().int().min(0).describe('[classification: source-field]'),
  rootBatch: z.string().describe('[classification: source-field]'),
  upstreamCount: z.number().int().min(0).describe('[classification: source-derived]'),
  downstreamCount: z.number().int().min(0).describe('[classification: source-derived]'),
  unresolvedNodeCount: z.number().int().min(0).describe('[classification: source-derived]'),
  warnings: z.array(z.string()).optional().describe('[classification: application-derived]'),
  truncated: z.boolean().optional().describe('[classification: source-field]'),
})

export type TraceGraph = z.infer<typeof TraceGraphSchema>

// ---------------------------------------------------------------------------
// MassBalanceMovement
// ---------------------------------------------------------------------------

export const MassBalanceMovementSchema = z.object({
  date: z.string().describe('[classification: source-field]'),
  category: z
    .enum(['production', 'shipment', 'consumption', 'adjustment'])
    .describe('[classification: application-derived]'),
  quantity: z.number().min(0).describe('[classification: source-field]'),
  delta: z.number().describe('[classification: source-derived]'),
  runningBalance: z.number().describe('[classification: source-derived]'),
  uom: z.string().describe('[classification: source-field]'),
  reference: z.string().optional().describe('[classification: source-field]'),
  movementType: z.string().optional().describe('[classification: source-field]'),
})

export type MassBalanceMovement = z.infer<typeof MassBalanceMovementSchema>

// ---------------------------------------------------------------------------
// MassBalanceSummary
// ---------------------------------------------------------------------------

export const MassBalanceSummarySchema = z.object({
  inputQuantity: z.number().describe('[classification: source-field]'),
  outputQuantity: z.number().describe('[classification: source-field]'),
  varianceQuantity: z.number().describe('[classification: source-field]'),
  variancePercent: z.number().describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
  unresolvedMovements: z.number().int().min(0).describe('[classification: source-field]'),
  movements: MassBalanceMovementSchema.array().readonly().optional(),
})

export type MassBalanceSummary = z.infer<typeof MassBalanceSummarySchema>

// ---------------------------------------------------------------------------
// CustomerExposureSummary
// ---------------------------------------------------------------------------

export const CustomerExposureSummarySchema = z.object({
  affectedCustomers: z.number().int().min(0).describe('[classification: source-field]'),
  affectedDeliveries: z.number().int().min(0).describe('[classification: source-field]'),
  shippedQuantity: z.number().min(0).describe('[classification: source-field]'),
  countries: z.array(z.string()).describe('[classification: source-field]'),
  highestSeverity: z
    .enum(['none', 'low', 'medium', 'high', 'critical'])
    .describe('[classification: source-field]'),
  blockedDeliveries: z.number().int().min(0).describe('[classification: source-field]'),
  // recallRecommended is governance-pending. Until a governed recall-rule
  // engine exists, the mapper MUST emit `null` rather than `false` — `false`
  // could be misread as "recall not required", which is a positive safety
  // claim the system cannot make without a governed rule source.
  //   true  → governed source says recall recommended
  //   false → governed source says recall NOT recommended
  //   null  → no governed recall-rule source available
  recallRecommended: z.boolean().nullable().describe('[classification: governance-pending]'),
  // Minimum hop count from anchor batch to the closest affected customer delivery.
  // depth=1 → direct shipment; depth≥2 → multi-hop indirect exposure.
  // When absent, severity logic falls back to conservative binary shipped/not-shipped rules.
  // Requires population from live Databricks lineage data (TRACE-P0-003).
  // Nullable to match the Pydantic Optional[int] serialization (FastAPI emits null for None).
  maxExposureDepth: z
    .number()
    .int()
    .min(1)
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
  // Unit of measure for shippedQuantity. Absent when source view does not expose a UoM column.
  // Display "source units" when absent. Nullable to match Pydantic Optional[str] serialization.
  uom: z.string().nullable().optional().describe('[classification: source-field]'),
  // Identifies which Databricks source populated this summary.
  // 'lineage' = gold_batch_lineage DELIVERY edges (preliminary, no countries).
  // 'inventory-movements' = gold_batch_delivery_v direct delivery records (V1-parity).
  deliveryEvidenceSource: z
    .enum(['lineage', 'inventory-movements'])
    .nullable()
    .optional()
    .describe('[classification: source-field]'),
})

export type CustomerExposureSummary = z.infer<typeof CustomerExposureSummarySchema>

// ---------------------------------------------------------------------------
// SupplierExposureSummary
// ---------------------------------------------------------------------------

// Per-supplier detail row for the supplier exposure table.
// Sourced from gold_batch_lineage (LINK_TYPE='VENDOR_RECEIPT') joined to gold_supplier.
// Populated by the live first slice from POST /api/trace2/supplier-exposure.
export const SupplierDetailSchema = z.object({
  supplierId: z.string().describe('[classification: source-field]'),
  supplierName: z.string().optional().describe('[classification: source-field]'),
  countryId: z.string().optional().describe('[classification: source-field]'),
  countryName: z.string().optional().describe('[classification: source-field]'),
  receivedQuantity: z.number().min(0).describe('[classification: source-field]'),
  batchCount: z.number().int().min(0).describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: source-field]'),
  lastReceiptDate: z.string().optional().describe('[classification: source-field]'),
})

export type SupplierDetail = z.infer<typeof SupplierDetailSchema>

export const SupplierExposureSummarySchema = z.object({
  supplierCount: z.number().int().min(0).describe('[classification: source-field]'),
  supplierLots: z.number().int().min(0).describe('[classification: source-field]'),
  highestRiskSupplier: z.string().optional().describe('[classification: source-field]'),
  upstreamMaterials: z.number().int().min(0).describe('[classification: source-field]'),
  openSupplierActions: z.number().int().min(0).describe('[classification: source-field]'),
  // Per-supplier detail rows. Absent when the source does not populate suppliers
  // (mock or unavailable); empty array when source returned no VENDOR_RECEIPT rows.
  // openSupplierActions and highestRiskSupplier remain absent in the live slice
  // until a verified QM source is wired (TRACE-P1-012).
  suppliers: SupplierDetailSchema.array().readonly().optional(),
})

export type SupplierExposureSummary = z.infer<typeof SupplierExposureSummarySchema>

// ---------------------------------------------------------------------------
// ProductionHistory
// ---------------------------------------------------------------------------

// One row in the production history for a given material.
// Sourced from gold_batch_production_history_v.
export const ProductionHistoryRowSchema = z.object({
  processOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  batchId: z.string().describe('[classification: source-field]'),
  plantId: z.string().optional().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  postingDate: z.string().optional().describe('[classification: source-field]'),
  quantity: z.number().min(0).describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: source-field]'),
  // Live values observed in gold_batch_production_history_v are 'Pass' and 'Fail'.
  // Mapped to 'pass' / 'fail' / 'unknown' (anything else, including null/empty).
  qualityStatus: z
    .enum(['pass', 'fail', 'unknown'])
    .describe('[classification: application-heuristic]'),
})

export type ProductionHistoryRow = z.infer<typeof ProductionHistoryRowSchema>

export const ProductionHistorySummarySchema = z.object({
  materialId: z.string().describe('[classification: source-field]'),
  totalBatches: z.number().int().min(0).describe('[classification: source-field]'),
  passCount: z.number().int().min(0).describe('[classification: source-field]'),
  failCount: z.number().int().min(0).describe('[classification: source-field]'),
  unknownCount: z.number().int().min(0).describe('[classification: source-field]'),
  rows: ProductionHistoryRowSchema.array().readonly(),
})

export type ProductionHistorySummary = z.infer<typeof ProductionHistorySummarySchema>

// ---------------------------------------------------------------------------
// TraceEvent
// ---------------------------------------------------------------------------

export const TraceEventSchema = z.object({
  eventId: z.string().describe('[classification: source-field]'),
  timestamp: z.string().datetime().describe('[classification: source-field]'),
  type: z
    .enum([
      'batch-created',
      'batch-moved',
      'batch-released',
      'batch-blocked',
      'investigation-opened',
      'investigation-updated',
      'investigation-escalated',
      'investigation-resolved',
      'evidence-added',
      'quality-decision',
      'system-alert',
      'user-action',
    ])
    .describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  description: z.string().optional().describe('[classification: source-field]'),
  sourceSystem: z.string().describe('[classification: source-field]'),
  actor: z.string().optional().describe('[classification: source-field]'),
  severity: z
    .enum(['info', 'warning', 'critical'])
    .optional()
    .describe('[classification: source-field]'),
})

export type TraceEvent = z.infer<typeof TraceEventSchema>

// ---------------------------------------------------------------------------
// CoAReleaseStatus
// ---------------------------------------------------------------------------

export const CoAReleaseStatusSchema = z.object({
  coaAvailable: z.boolean().describe('[classification: source-field]'),
  releaseStatus: z
    .enum(['released', 'not-released', 'conditional', 'blocked', 'unknown'])
    .describe('[classification: governance-pending]'),
  usageDecision: z
    .enum(['accept', 'reject', 'pending', 'conditional', 'not-set'])
    .describe('[classification: source-field]'),
  openQualityLots: z.number().int().min(0).describe('[classification: source-field]'),
  failedCharacteristics: z.number().int().min(0).describe('[classification: source-field]'),
  pendingResults: z.number().int().min(0).describe('[classification: source-field]'),
  lastDecisionAt: z.string().datetime().optional().describe('[classification: source-field]'),
})

export type CoAReleaseStatus = z.infer<typeof CoAReleaseStatusSchema>

// ---------------------------------------------------------------------------
// TraceRiskSignal
// ---------------------------------------------------------------------------

export const TraceRiskSignalSchema = z.object({
  signalId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  severity: z
    .enum(['info', 'low', 'medium', 'high', 'critical'])
    .describe('[classification: source-field]'),
  source: z.string().describe('[classification: source-field]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
  recommendedAction: z.string().optional().describe('[classification: application-heuristic]'),
})

export type TraceRiskSignal = z.infer<typeof TraceRiskSignalSchema>

// ---------------------------------------------------------------------------
// RelatedInvestigation
// ---------------------------------------------------------------------------

export const RelatedInvestigationSchema = z.object({
  investigationId: z.string().describe('[classification: source-field]'),
  title: z.string().describe('[classification: source-field]'),
  status: z
    .enum(['open', 'in-progress', 'escalated', 'resolved', 'closed'])
    .describe('[classification: source-field]'),
  severity: z
    .enum(['low', 'medium', 'high', 'critical'])
    .describe('[classification: source-field]'),
  relatedBy: z
    .enum([
      'same-batch',
      'same-material',
      'same-supplier',
      'same-customer',
      'same-plant',
      'linked-investigation',
    ])
    .describe('[classification: source-field]'),
  openedAt: z.string().datetime().describe('[classification: source-field]'),
  owner: z.string().optional().describe('[classification: source-field]'),
})

export type RelatedInvestigation = z.infer<typeof RelatedInvestigationSchema>
