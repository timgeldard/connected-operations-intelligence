import { EventTimelinePanel } from '../panels/event-timeline-panel.js'
import { RelatedInvestigationsPanel } from '../panels/related-investigations-panel.js'
import { CoAReleaseStatusPanel } from '../panels/coa-release-status-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Props for TimelineEventsView. */
export interface TimelineEventsViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Timeline & Events view for the Trace Investigation workspace.
 *
 * @remarks
 * The full event timeline is the dominant panel; CoA release status,
 * related investigations, and risk signals provide supporting context for
 * understanding the sequence of quality decisions and actions.
 */
export function TimelineEventsView({ request }: TimelineEventsViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      {/* Full-width event timeline */}
      <EventTimelinePanel request={request} />
      {/* Supporting context panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <RelatedInvestigationsPanel request={request} />
        <CoAReleaseStatusPanel request={request} />
        <RiskSignalsPanel request={request} />
      </div>
    </div>
  )
}
