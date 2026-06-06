import { MaterialSupplierExposurePanel } from '../panels/material-supplier-exposure-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { RelatedInvestigationsPanel } from '../panels/related-investigations-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for SupplierExposureView. */
export interface SupplierExposureViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Supplier Exposure view for the Trace Investigation workspace.
 *
 * @remarks
 * Focuses on upstream supplier lot exposure and open actions.
 * Supplier exposure panel leads; trace graph and related investigations
 * provide supporting context.
 */
export function SupplierExposureView({ request }: SupplierExposureViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      <MaterialSupplierExposurePanel request={request} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <TraceGraphPanel request={request} />
        <RelatedInvestigationsPanel request={request} />
        <RiskSignalsPanel request={request} />
      </div>
    </div>
  )
}
