import { z } from 'zod'

const SeveritySchema = z.enum(['low', 'medium', 'high', 'critical'])

// ---------------------------------------------------------------------------
// ProductionStagingContext
// ---------------------------------------------------------------------------

export const ProductionStagingContextSchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  warehouseName: z.string().optional().describe('[classification: data-gap — no warehouse-name source replicated]'),
  planDate: z.string().date().describe('[classification: source-field]'),
  totalOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  stagedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  partialOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  openShortfalls: z.number().int().min(0).describe('[classification: source-derived]'),
  openMoveRequests: z.number().int().min(0).describe('[classification: source-derived]'),
  overallReadinessPercent: z.number().min(0).max(100).describe('[classification: application-derived]'),
  riskStatus: z.enum(['ready', 'at-risk', 'blocked', 'unknown']).describe('[classification: application-heuristic]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
})

export type ProductionStagingContext = z.infer<typeof ProductionStagingContextSchema>

// ---------------------------------------------------------------------------
// StagingOrderSummary
// ---------------------------------------------------------------------------

// SAP-truthful shape (governed staging-workload dataset, gold_process_order_staging_live):
// batch / line / staging-area / pick-task linkage are first-wave gaps at this grain.
export const StagingOrderSummarySchema = z.object({
  processOrderId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().optional().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: data-gap — order batch not at this grain]'),
  plantId: z.string().describe('[classification: source-field]'),
  lineOrResource: z.string().optional().describe('[classification: data-gap — production line join deferred]'),
  plannedStart: z.string().optional().describe('[classification: source-field — sched_start]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  stagedQuantity: z.number().describe('[classification: application-derived — order_qty * staging_pct]'),
  shortfallQuantity: z.number().describe('[classification: source-derived]'),
  uom: z.string().optional().describe('[classification: source-field]'),
  stagingArea: z.string().optional().describe('[classification: data-gap — storage location absent]'),
  status: z.enum(['not-staged', 'partial', 'staged', 'blocked', 'not-required']).describe('[classification: application-heuristic]'),
  urgency: SeveritySchema.describe('[classification: source-derived]'),
  pickTaskIds: z.array(z.string()).optional().describe('[classification: data-gap — TO linkage via pick-tasks dataset]'),
  blockerReason: z.string().optional().describe('[classification: source-field]'),
})

export type StagingOrderSummary = z.infer<typeof StagingOrderSummarySchema>

// ---------------------------------------------------------------------------
// StagingPickTask
// ---------------------------------------------------------------------------

// SAP-truthful shape (governed pick-tasks dataset = open LTAP transfer-order items):
// processOrderId only when BETYP='F'; materialDescription/uom are first-wave data gaps;
// assignee maps to the confirming user; createdAt is the SAP TO creation timestamp string.
export const StagingPickTaskSchema = z.object({
  taskId: z.string().describe('[classification: source-field]'),
  processOrderId: z.string().optional().describe('[classification: source-field — BENUM when BETYP=F]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().optional().describe('[classification: data-gap — material join deferred]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  storageLocation: z.string().describe('[classification: source-field]'),
  destinationLocation: z.string().describe('[classification: source-field]'),
  requiredQuantity: z.number().describe('[classification: source-field]'),
  pickedQuantity: z.number().describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: data-gap — not sourced at TO-item grain]'),
  assignee: z.string().optional().describe('[classification: source-field — confirming user]'),
  status: z.enum(['open', 'in-progress', 'picked', 'staged', 'cancelled']).describe('[classification: source-field]'),
  priority: SeveritySchema.describe('[classification: application-heuristic]'),
  createdAt: z.string().optional().describe('[classification: source-field]'),
  completedAt: z.string().optional().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
})

export type StagingPickTask = z.infer<typeof StagingPickTaskSchema>

// ---------------------------------------------------------------------------
// StagingZoneCapacity
// ---------------------------------------------------------------------------

// SAP-truthful shape (governed stock-zones dataset over gold_bin_occupancy): zone =
// storage type; counts are BIN counts (order counts are not derivable from bin occupancy).
export const StagingZoneCapacitySchema = z.object({
  zoneId: z.string().describe('[classification: source-field — storage type]'),
  zoneName: z.string().describe('[classification: source-field — storage type]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  capacityPercent: z.number().min(0).max(100).describe('[classification: source-derived — occupancy rate]'),
  occupiedBins: z.number().int().min(0).describe('[classification: source-field]'),
  emptyBins: z.number().int().min(0).describe('[classification: source-field]'),
  blockedBins: z.number().int().min(0).describe('[classification: source-field]'),
  status: z.enum(['available', 'high-utilisation', 'full', 'blocked']).describe('[classification: application-heuristic]'),
  overflowRisk: z.boolean().describe('[classification: application-heuristic]'),
})

export type StagingZoneCapacity = z.infer<typeof StagingZoneCapacitySchema>

// ---------------------------------------------------------------------------
// StagingShortfall
// ---------------------------------------------------------------------------

// SAP-truthful shape (governed shortfalls dataset, TR material backlog): available qty,
// affected orders, procurement state, and substitution are first-wave gaps at this grain.
export const StagingShortfallSchema = z.object({
  shortfallId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().optional().describe('[classification: data-gap — material join deferred]'),
  plantId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().optional().describe('[classification: data-gap — material-grain dataset]'),
  requiredQuantity: z.number().describe('[classification: source-field — open TR qty]'),
  availableQuantity: z.number().optional().describe('[classification: data-gap — stock join deferred]'),
  shortfallQuantity: z.number().describe('[classification: source-derived]'),
  uom: z.string().optional().describe('[classification: data-gap — not sourced at material grain]'),
  affectedOrders: z.array(z.string()).optional().describe('[classification: data-gap — order linkage deferred]'),
  urgency: SeveritySchema.describe('[classification: application-heuristic — TR age]'),
  procurementStatus: z.enum(['in-stock', 'in-transit', 'ordered', 'delayed', 'out-of-stock', 'unknown']).describe('[classification: application-heuristic]'),
  expectedArrival: z.string().optional().describe('[classification: data-gap]'),
  canBeSubstituted: z.boolean().optional().describe('[classification: data-gap]'),
})

export type StagingShortfall = z.infer<typeof StagingShortfallSchema>

// ---------------------------------------------------------------------------
// StagingMoveRequest
// ---------------------------------------------------------------------------

// SAP-truthful shape (governed move-requests dataset = open LTBP transfer-requirement
// items): requestedBy/assignedTo are data gaps (LTBK carries neither); reason maps to the
// WM queue; materialDescription/uom are first-wave gaps; createdAt is the SAP timestamp.
export const StagingMoveRequestSchema = z.object({
  requestId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  fromLocation: z.string().describe('[classification: source-field]'),
  toLocation: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().optional().describe('[classification: data-gap — material join deferred]'),
  quantity: z.number().describe('[classification: source-field]'),
  uom: z.string().optional().describe('[classification: data-gap — not sourced at TR-item grain]'),
  processOrderId: z.string().optional().describe('[classification: source-field — BENUM when BETYP=F]'),
  requestedBy: z.string().optional().describe('[classification: data-gap — LTBK carries no requester]'),
  assignedTo: z.string().optional().describe('[classification: data-gap — LTBK carries no assignee]'),
  status: z.enum(['open', 'assigned', 'in-transit', 'completed', 'cancelled']).describe('[classification: source-field]'),
  priority: SeveritySchema.describe('[classification: application-heuristic]'),
  createdAt: z.string().optional().describe('[classification: source-field]'),
  completedAt: z.string().optional().describe('[classification: source-field]'),
  reason: z.string().optional().describe('[classification: source-field — WM queue]'),
})

export type StagingMoveRequest = z.infer<typeof StagingMoveRequestSchema>

// ---------------------------------------------------------------------------
// StagingReadinessSummary
// ---------------------------------------------------------------------------

export const StagingReadinessSummarySchema = z.object({
  planDate: z.string().date().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  totalOrders: z.number().int().min(0).describe('[classification: source-derived]'),
  fullyStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  partiallyStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  notStaged: z.number().int().min(0).describe('[classification: source-derived]'),
  blocked: z.number().int().min(0).describe('[classification: source-derived]'),
  percentReady: z.number().min(0).max(100).describe('[classification: application-derived]'),
  openShortfalls: z.number().int().min(0).describe('[classification: source-derived]'),
  pendingPickTasks: z.number().int().min(0).describe('[classification: source-derived]'),
  openMoveRequests: z.number().int().min(0).describe('[classification: source-derived]'),
  riskStatus: z.enum(['ready', 'at-risk', 'blocked', 'unknown']).describe('[classification: application-heuristic]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type StagingReadinessSummary = z.infer<typeof StagingReadinessSummarySchema>

// ---------------------------------------------------------------------------
// StagingPickingWave
// ---------------------------------------------------------------------------

export const StagingPickingWaveSchema = z.object({
  waveId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  planDate: z.string().date().describe('[classification: source-field]'),
  waveLabel: z.string().describe('[classification: source-field]'),
  includedOrders: z.array(z.string()).describe('[classification: source-field]'),
  totalTasks: z.number().int().min(0).describe('[classification: source-derived]'),
  completedTasks: z.number().int().min(0).describe('[classification: source-derived]'),
  status: z.enum(['planned', 'in-progress', 'completed', 'partial', 'cancelled']).describe('[classification: source-field]'),
  scheduledStart: z.string().datetime().optional().describe('[classification: source-field]'),
  actualStart: z.string().datetime().optional().describe('[classification: source-field]'),
  estimatedCompletion: z.string().datetime().optional().describe('[classification: source-field]'),
  actualCompletion: z.string().datetime().optional().describe('[classification: source-field]'),
  assignedTeam: z.string().optional().describe('[classification: source-field]'),
})

export type StagingPickingWave = z.infer<typeof StagingPickingWaveSchema>

// ---------------------------------------------------------------------------
// StagingAlert
// ---------------------------------------------------------------------------

export const StagingAlertSchema = z.object({
  alertId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  alertType: z.enum(['shortfall', 'overdue-pick', 'zone-capacity', 'move-delay', 'blocked-order', 'other']).describe('[classification: source-field]'),
  severity: SeveritySchema.describe('[classification: source-derived]'),
  processOrderId: z.string().optional().describe('[classification: source-field]'),
  materialId: z.string().optional().describe('[classification: source-field]'),
  zoneId: z.string().optional().describe('[classification: source-field]'),
  description: z.string().describe('[classification: source-field]'),
  recommendedAction: z.string().describe('[classification: application-heuristic]'),
  raisedAt: z.string().describe('[classification: source-derived — oldest underlying record or fetch time]'),
  resolvedAt: z.string().optional().describe('[classification: source-field]'),
  status: z.enum(['open', 'acknowledged', 'in-progress', 'resolved']).describe('[classification: source-field]'),
  owner: z.string().optional().describe('[classification: source-field]'),
})

export type StagingAlert = z.infer<typeof StagingAlertSchema>
