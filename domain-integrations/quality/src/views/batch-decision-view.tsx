import { ReleaseSummaryPanel } from '../panels/release-summary-panel.js'
import { QualityResultsPanel } from '../panels/quality-results-panel.js'
import { CoAReadinessPanel } from '../panels/coa-readiness-panel.js'
import { DeviationsPanel } from '../panels/deviations-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Props for BatchDecisionView. */
export interface BatchDecisionViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Batch Decision view for the Quality Batch Release workspace.
 *
 * @remarks
 * Assembles the four panels a quality manager needs when making a release
 * decision: the consolidated release summary spanning full width to give
 * immediate pass/fail context, followed by quality inspection results, CoA
 * readiness, and active deviations side-by-side in the auto-fill grid.
 * Together they answer: "Is this batch safe to release right now?"
 */
export function BatchDecisionView({ request }: BatchDecisionViewProps) {
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
        <ReleaseSummaryPanel request={request} />
      </div>
      <QualityResultsPanel request={request} />
      <CoAReadinessPanel request={request} />
      <DeviationsPanel request={request} />
    </div>
  )
}
