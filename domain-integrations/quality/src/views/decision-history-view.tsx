import { DecisionHistoryPanel } from '../panels/decision-history-panel.js'
import { DeviationsPanel } from '../panels/deviations-panel.js'
import { ReleaseSummaryPanel } from '../panels/release-summary-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Props for DecisionHistoryView. */
export interface DecisionHistoryViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Decision History view for the Quality Batch Release workspace.
 *
 * @remarks
 * Presents the full audit trail of release decisions for a batch case across
 * the complete grid width, paired with the active deviations and the release
 * summary for context. Use this view when reviewing why a previous decision
 * was made, preparing for an audit, or investigating a release dispute.
 */
export function DecisionHistoryView({ request }: DecisionHistoryViewProps) {
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
      <div style={{ gridColumn: '1 / -1' }}>
        <DecisionHistoryPanel request={request} />
      </div>
      <DeviationsPanel request={request} />
      <ReleaseSummaryPanel request={request} />
    </div>
  )
}
