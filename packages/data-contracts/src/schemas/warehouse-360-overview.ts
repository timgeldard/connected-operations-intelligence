import { z } from 'zod'

// ---------------------------------------------------------------------------
// Warehouse360OverviewContext
// ---------------------------------------------------------------------------

export const Warehouse360OverviewContextSchema = z.object({
  warehouseId: z.string().describe('[classification: source-field]'),
  warehouseName: z.string().describe('[classification: source-field]'),
  plantId: z.string().describe('[classification: source-field]'),
  totalStockLines: z.number().int().min(0).describe('[classification: source-derived]'),
  holdPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  openTransfers: z.number().int().min(0).describe('[classification: source-derived]'),
  capacityUtilizationPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  lastUpdatedAt: z.string().datetime().describe('[classification: source-field]'),
})

export type Warehouse360OverviewContext = z.infer<typeof Warehouse360OverviewContextSchema>

// ---------------------------------------------------------------------------
// Warehouse360Summary
// ---------------------------------------------------------------------------

export const Warehouse360SummarySchema = z.object({
  warehouseId: z.string().describe('[classification: source-field]'),
  totalStockLines: z.number().int().min(0).describe('[classification: source-derived]'),
  unrestrictedLines: z.number().int().min(0).describe('[classification: source-derived]'),
  holdLines: z.number().int().min(0).describe('[classification: source-derived]'),
  qualityInspectionLines: z.number().int().min(0).describe('[classification: source-derived]'),
  openGoodsReceipts: z.number().int().min(0).describe('[classification: source-derived]'),
  openGoodsIssues: z.number().int().min(0).describe('[classification: source-derived]'),
  openTransfers: z.number().int().min(0).describe('[classification: source-derived]'),
  capacityUtilizationPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  activeReplenishmentNeeds: z.number().int().min(0).describe('[classification: source-derived]'),
  confidence: z.number().min(0).max(1).describe('[classification: application-heuristic]'),
})

export type Warehouse360Summary = z.infer<typeof Warehouse360SummarySchema>

// ---------------------------------------------------------------------------
// StockOverview
// ---------------------------------------------------------------------------

export const StockZoneSchema = z.object({
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  zoneType: z.enum(['ambient', 'chilled', 'frozen', 'hazardous', 'bulk', 'staging']).describe('[classification: source-field]'),
  stockLines: z.number().int().min(0).describe('[classification: source-derived]'),
  capacityPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  holdPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
})

export type StockZone = z.infer<typeof StockZoneSchema>

export const StockOverviewSchema = z.object({
  warehouseId: z.string().describe('[classification: source-field]'),
  zones: z.array(StockZoneSchema),
  totalStorageLocations: z.number().int().min(0).describe('[classification: source-derived]'),
  occupiedLocations: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedLocations: z.number().int().min(0).describe('[classification: source-derived]'),
})

export type StockOverview = z.infer<typeof StockOverviewSchema>

// ---------------------------------------------------------------------------
// OpenHoldItem
// ---------------------------------------------------------------------------

export const OpenHoldItemSchema = z.object({
  holdId: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  storageLocationId: z.string().describe('[classification: source-field]'),
  holdReason: z.enum(['quality-hold', 'customer-hold', 'production-hold', 'regulatory-hold', 'damaged', 'expired', 'investigation']).describe('[classification: source-field]'),
  holdQuantity: z.number().min(0).describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  raisedAt: z.string().datetime().describe('[classification: source-field]'),
  raisedBy: z.string().optional().describe('[classification: source-field]'),
  ageHours: z.number().min(0).describe('[classification: application-derived]'),
  linkedWorkspaceId: z.string().optional().describe('[classification: application-derived]'),
})

export type OpenHoldItem = z.infer<typeof OpenHoldItemSchema>

// ---------------------------------------------------------------------------
// GoodsMovementEvent
// ---------------------------------------------------------------------------

export const GoodsMovementEventSchema = z.object({
  movementId: z.string().describe('[classification: source-field]'),
  timestamp: z.string().datetime().describe('[classification: source-field]'),
  movementType: z.enum(['goods-receipt', 'goods-issue', 'transfer-order', 'stock-transfer', 'return', 'adjustment']).describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  quantity: z.number().describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  sourceLocation: z.string().optional().describe('[classification: source-field]'),
  destinationLocation: z.string().optional().describe('[classification: source-field]'),
  referenceDocument: z.string().optional().describe('[classification: source-field]'),
  postedBy: z.string().optional().describe('[classification: source-field]'),
})

export type GoodsMovementEvent = z.infer<typeof GoodsMovementEventSchema>

// ---------------------------------------------------------------------------
// ReplenishmentNeed
// ---------------------------------------------------------------------------

export const ReplenishmentNeedSchema = z.object({
  needId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  storageLocationId: z.string().describe('[classification: source-field]'),
  currentStockQuantity: z.number().min(0).describe('[classification: source-field]'),
  reorderPoint: z.number().min(0).describe('[classification: source-field]'),
  targetQuantity: z.number().min(0).describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  urgency: z.enum(['critical', 'high', 'medium', 'low']).describe('[classification: application-heuristic]'),
  openPurchaseOrderId: z.string().optional().describe('[classification: source-field]'),
  expectedDelivery: z.string().datetime().optional().describe('[classification: source-field]'),
})

export type ReplenishmentNeed = z.infer<typeof ReplenishmentNeedSchema>

// ---------------------------------------------------------------------------
// LocationCapacity
// ---------------------------------------------------------------------------

export const LocationCapacitySchema = z.object({
  locationId: z.string().describe('[classification: source-field]'),
  locationName: z.string().describe('[classification: source-field]'),
  zoneId: z.string().describe('[classification: source-field]'),
  zoneName: z.string().describe('[classification: source-field]'),
  totalCapacityUnits: z.number().min(0).describe('[classification: source-derived]'),
  usedCapacityUnits: z.number().min(0).describe('[classification: source-derived]'),
  utilizationPercent: z.number().min(0).max(100).describe('[classification: source-derived]'),
  locationType: z.enum(['bin', 'shelf', 'rack', 'floor', 'bulk-area', 'staging-lane']).describe('[classification: source-field]'),
  isBlocked: z.boolean().describe('[classification: source-field]'),
  blockReason: z.string().optional().describe('[classification: source-field]'),
})

export type LocationCapacity = z.infer<typeof LocationCapacitySchema>

// ---------------------------------------------------------------------------
// NearExpiryBatch
// ---------------------------------------------------------------------------

export const NearExpiryBatchSchema = z.object({
  batchId: z.string().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  storageLocationId: z.string().describe('[classification: source-field]'),
  expiryDate: z.string().datetime().describe('[classification: source-field]'),
  daysUntilExpiry: z.number().describe('[classification: application-derived]'),
  quantity: z.number().min(0).describe('[classification: source-field]'),
  uom: z.string().describe('[classification: source-field]'),
  urgency: z.enum(['expired', 'critical', 'warning', 'caution']).describe('[classification: application-heuristic]'),
  holdStatus: z.enum(['unrestricted', 'quality-hold', 'blocked']).describe('[classification: application-heuristic]'),
})

export type NearExpiryBatch = z.infer<typeof NearExpiryBatchSchema>

// ---------------------------------------------------------------------------
// WarehouseReconciliationException
// ---------------------------------------------------------------------------

export const WarehouseReconciliationExceptionSchema = z.object({
  exceptionId: z.string().describe('[classification: source-field]'),
  exceptionType: z.enum([
    'quantity-mismatch',
    'location-mismatch',
    'status-mismatch',
    'missing-in-wms',
    'missing-in-im',
    'duplicate-posting',
  ]).describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().describe('[classification: source-field]'),
  batchId: z.string().optional().describe('[classification: source-field]'),
  storageLocationId: z.string().describe('[classification: source-field]'),
  imQuantity: z.number().optional().describe('[classification: source-field]'),
  wmsQuantity: z.number().optional().describe('[classification: source-field]'),
  discrepancyQuantity: z.number().optional().describe('[classification: source-derived]'),
  uom: z.string().describe('[classification: source-field]'),
  detectedAt: z.string().datetime().describe('[classification: source-field]'),
  ageHours: z.number().min(0).describe('[classification: application-derived]'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).describe('[classification: source-field]'),
  resolution: z.enum(['open', 'in-progress', 'resolved', 'escalated']).describe('[classification: source-field]'),
})

export type WarehouseReconciliationException = z.infer<typeof WarehouseReconciliationExceptionSchema>

// ---------------------------------------------------------------------------
// Warehouse360Overview
// ---------------------------------------------------------------------------

export const Warehouse360OverviewSchema = z.object({
  plantId: z.string().describe('[classification: source-field]'),
  warehouseId: z.string().describe('[classification: source-field]'),
  inboundDueCount: z.number().int().min(0).describe('[classification: source-derived]'),
  inboundOverdueCount: z.number().int().min(0).describe('[classification: source-derived]'),
  outboundDueCount: z.number().int().min(0).describe('[classification: source-derived]'),
  outboundOverdueCount: z.number().int().min(0).describe('[classification: source-derived]'),
  stagingOpenCount: z.number().int().min(0).describe('[classification: source-derived]'),
  stagingOverdueCount: z.number().int().min(0).describe('[classification: source-derived]'),
  nearExpiryCount: z.number().int().min(0).describe('[classification: source-derived]'),
  reconciliationExceptionCount: z.number().int().min(0).describe('[classification: source-derived]'),
  blockedStockCount: z.number().int().min(0).describe('[classification: source-derived]'),
  source: z.string().optional().describe('[classification: source-field]'),
  warnings: z.array(z.string()).optional().describe('[classification: application-derived]'),
})

export type Warehouse360Overview = z.infer<typeof Warehouse360OverviewSchema>

// ---------------------------------------------------------------------------
// Warehouse360InboundItem
// ---------------------------------------------------------------------------

export const Warehouse360InboundItemSchema = z.object({
  documentType: z.enum(['PO', 'STO', 'unknown']).describe('[classification: source-field]'),
  purchaseOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  stockTransportOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  itemId: z.string().nullable().optional().describe('[classification: source-field]'),
  vendorId: z.string().nullable().optional().describe('[classification: source-field]'),
  supplyingPlantId: z.string().nullable().optional().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().nullable().optional().describe('[classification: source-field]'),
  batchId: z.string().nullable().optional().describe('[classification: source-field]'),
  plantId: z.string().nullable().optional().describe('[classification: source-field]'),
  storageLocation: z.string().nullable().optional().describe('[classification: source-field]'),
  warehouseNumber: z.string().nullable().optional().describe('[classification: source-field]'),
  expectedDate: z.string().nullable().optional().describe('[classification: source-field]'),
  receivedDate: z.string().nullable().optional().describe('[classification: source-field]'),
  quantity: z.number().nullable().optional().describe('[classification: source-field]'),
  unitOfMeasure: z.string().nullable().optional().describe('[classification: source-field]'),
  status: z.string().nullable().optional().describe('[classification: source-field]'),
  exceptionReason: z.string().nullable().optional().describe('[classification: source-field]'),
})

export type Warehouse360InboundItem = z.infer<typeof Warehouse360InboundItemSchema>

// ---------------------------------------------------------------------------
// Warehouse360OutboundItem
// ---------------------------------------------------------------------------

export const Warehouse360OutboundItemSchema = z.object({
  deliveryId: z.string().nullable().optional().describe('[classification: source-field]'),
  deliveryItemId: z.string().nullable().optional().describe('[classification: source-field]'),
  customerId: z.string().nullable().optional().describe('[classification: source-field]'),
  salesOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().nullable().optional().describe('[classification: source-field]'),
  batchId: z.string().nullable().optional().describe('[classification: source-field]'),
  plantId: z.string().nullable().optional().describe('[classification: source-field]'),
  storageLocation: z.string().nullable().optional().describe('[classification: source-field]'),
  warehouseNumber: z.string().nullable().optional().describe('[classification: source-field]'),
  plannedGoodsIssueDate: z.string().nullable().optional().describe('[classification: source-field]'),
  actualGoodsIssueDate: z.string().nullable().optional().describe('[classification: source-field]'),
  quantity: z.number().nullable().optional().describe('[classification: source-field]'),
  unitOfMeasure: z.string().nullable().optional().describe('[classification: source-field]'),
  status: z.string().nullable().optional().describe('[classification: source-field]'),
  exceptionReason: z.string().nullable().optional().describe('[classification: source-field]'),
})

export type Warehouse360OutboundItem = z.infer<typeof Warehouse360OutboundItemSchema>

// ---------------------------------------------------------------------------
// Warehouse360StagingItem
// ---------------------------------------------------------------------------

export const Warehouse360StagingItemSchema = z.object({
  processOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  reservationId: z.string().nullable().optional().describe('[classification: source-field]'),
  reservationItemId: z.string().nullable().optional().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  materialDescription: z.string().nullable().optional().describe('[classification: source-field]'),
  batchId: z.string().nullable().optional().describe('[classification: source-field]'),
  plantId: z.string().nullable().optional().describe('[classification: source-field]'),
  storageLocation: z.string().nullable().optional().describe('[classification: source-field]'),
  warehouseNumber: z.string().nullable().optional().describe('[classification: source-field]'),
  requirementDate: z.string().nullable().optional().describe('[classification: source-field]'),
  requiredQuantity: z.number().nullable().optional().describe('[classification: source-field]'),
  stagedQuantity: z.number().nullable().optional().describe('[classification: source-field]'),
  openQuantity: z.number().nullable().optional().describe('[classification: source-derived]'),
  unitOfMeasure: z.string().nullable().optional().describe('[classification: source-field]'),
  stagingStatus: z.string().nullable().optional().describe('[classification: source-field]'),
  exceptionReason: z.string().nullable().optional().describe('[classification: source-field]'),
})

export type Warehouse360StagingItem = z.infer<typeof Warehouse360StagingItemSchema>

// ---------------------------------------------------------------------------
// Warehouse360ExceptionItem
// ---------------------------------------------------------------------------

export const Warehouse360ExceptionItemSchema = z.object({
  exceptionType: z.string().nullable().optional().describe('[classification: source-field]'),
  severity: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional().describe('[classification: source-field]'),
  materialId: z.string().describe('[classification: source-field]'),
  batchId: z.string().nullable().optional().describe('[classification: source-field]'),
  plantId: z.string().nullable().optional().describe('[classification: source-field]'),
  storageLocation: z.string().nullable().optional().describe('[classification: source-field]'),
  warehouseNumber: z.string().nullable().optional().describe('[classification: source-field]'),
  quantity: z.number().nullable().optional().describe('[classification: source-field]'),
  unitOfMeasure: z.string().nullable().optional().describe('[classification: source-field]'),
  expiryDate: z.string().nullable().optional().describe('[classification: source-field]'),
  daysToExpiry: z.number().nullable().optional().describe('[classification: application-derived]'),
  documentId: z.string().nullable().optional().describe('[classification: source-field]'),
  processOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  deliveryId: z.string().nullable().optional().describe('[classification: source-field]'),
  purchaseOrderId: z.string().nullable().optional().describe('[classification: source-field]'),
  reason: z.string().nullable().optional().describe('[classification: source-field]'),
  recommendedReviewAction: z.string().nullable().optional().describe('[classification: application-heuristic]'),
})

export type Warehouse360ExceptionItem = z.infer<typeof Warehouse360ExceptionItemSchema>
