import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import { CustomerImpactPanel } from '../panels/customer-impact-panel.js'
import { CoAReleaseStatusPanel } from '../panels/coa-release-status-panel.js'
import { RelatedInvestigationsPanel } from '../panels/related-investigations-panel.js'
import { EventTimelinePanel } from '../panels/event-timeline-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for RecallReadinessView. */
export interface RecallReadinessViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Recall Readiness view for the Trace Investigation workspace.
 *
 * @remarks
 * This view assembles all panels relevant to a recall readiness assessment:
 * active risk signals, customer exposure and blocked deliveries, CoA release
 * decisions, related investigations, and the event timeline for audit trail.
 * Together they answer the question: "What is our recall posture right now?"
 */
export function RecallReadinessView({ request }: RecallReadinessViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      {/* Risk signals — top priority in a recall assessment */}
      <RiskSignalsPanel request={request} />
      {/* Customer and quality decision panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <CustomerImpactPanel request={request} />
        <CoAReleaseStatusPanel request={request} />
        <RelatedInvestigationsPanel request={request} />
      </div>
      {/* Audit trail */}
      <EventTimelinePanel request={request} />
    </div>
  )
}
