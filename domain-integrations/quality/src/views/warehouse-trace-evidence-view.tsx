// eslint-disable-next-line @nx/enforce-module-boundaries
import { WarehouseHoldStatusPanel } from '@connectio/di-warehouse'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { TraceExposureForReleasePanel, RelatedInvestigationsPanel } from '@connectio/di-traceability'
// eslint-disable-next-line @nx/enforce-module-boundaries
import { SPCSignalsForReleasePanel } from '@connectio/di-spc'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { WarehouseEvidenceAdapterRequest } from '@connectio/di-warehouse'
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { Trace2AdapterRequest } from '@connectio/di-traceability'
// eslint-disable-next-line @nx/enforce-module-boundaries
import type { SPCSignalsAdapterRequest } from '@connectio/di-spc'

/** Props for WarehouseTraceEvidenceView. */
export interface WarehouseTraceEvidenceViewProps {
  /** Adapter request context for cross-domain warehouse panels. */
  readonly warehouseRequest: WarehouseEvidenceAdapterRequest
  /** Adapter request context for cross-domain traceability panels. */
  readonly traceRequest: Trace2AdapterRequest
  /** Adapter request context for own-domain quality panels. */
  readonly qualityRequest: QualityReleaseAdapterRequest
}

/**
 * Warehouse & Trace Evidence view for the Quality Batch Release workspace.
 *
 * @remarks
 * Provides a consolidated view of stock-level and traceability risk evidence
 * needed during release: warehouse hold status, trace exposure for the specific
 * release case, related investigations from traceability, and SPC signals
 * derived from the warehouse context (using `releaseCaseId` and `batchId`).
 * The SPC request is constructed inline from the warehouse request so the
 * parent workspace only needs to manage three request objects.
 */
export function WarehouseTraceEvidenceView({
  warehouseRequest,
  traceRequest,
  qualityRequest: _qualityRequest,
}: WarehouseTraceEvidenceViewProps) {
  const spcRequest: SPCSignalsAdapterRequest = {
    releaseCaseId: warehouseRequest.releaseCaseId,
    batchId: warehouseRequest.batchId,
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 12,
        padding: 16,
        alignItems: 'start',
      }}
    >
      <WarehouseHoldStatusPanel request={warehouseRequest} />
      <TraceExposureForReleasePanel request={traceRequest} />
      <RelatedInvestigationsPanel request={traceRequest} />
      <SPCSignalsForReleasePanel request={spcRequest} />
    </div>
  )
}
