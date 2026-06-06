import { CustomerImpactPanel } from '../panels/customer-impact-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { EventTimelinePanel } from '../panels/event-timeline-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for CustomerExposureView. */
export interface CustomerExposureViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Customer Exposure view for the Trace Investigation workspace.
 *
 * @remarks
 * Focuses on downstream customer and delivery exposure. The CustomerImpactPanel
 * is placed prominently at the top; supporting trace graph, events, and risk signals follow.
 */
export function CustomerExposureView({ request }: CustomerExposureViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      <CustomerImpactPanel request={request} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <TraceGraphPanel request={request} />
        <EventTimelinePanel request={request} />
        <RiskSignalsPanel request={request} />
      </div>
    </div>
  )
}
