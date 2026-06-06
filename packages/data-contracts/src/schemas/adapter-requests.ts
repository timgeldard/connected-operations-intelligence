/**
 * Shared request interfaces for domain-integration adapters.
 * 
 * @remarks
 * These are placed in a shared package to prevent circular dependencies
 * between domain integrations (e.g., di-quality needing di-operations types).
 */

/** Request context for Manufacturing Operations evidence. */
export interface OperationsEvidenceAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly processOrderId?: string
  readonly batchId?: string
  readonly releaseCaseId?: string
}

/** Request context for Quality Blockers evidence. */
export interface QualityBlockersAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly processOrderIds?: readonly string[]
}

/** Request context for Traceability (Trace2) evidence. */
export interface Trace2AdapterRequest {
  readonly investigationId?: string
  readonly batchId?: string
  readonly plantId?: string
}

/** Request context for Warehouse 360 evidence. */
export interface WarehouseEvidenceAdapterRequest {
  readonly plantId?: string
  readonly planDate?: string
  readonly batchId?: string
  readonly releaseCaseId?: string
}

/** Request context for Process Order Review (POH) domain. */
export interface ProcessOrderReviewAdapterRequest {
  readonly processOrderId?: string
  readonly plantId?: string
  readonly lineId?: string
  readonly batchId?: string
  readonly materialId?: string
}
