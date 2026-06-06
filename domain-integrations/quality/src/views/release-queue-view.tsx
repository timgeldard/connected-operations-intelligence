import { ReleaseQueuePanel } from '../panels/release-queue-panel.js'
import { ReleaseSummaryPanel } from '../panels/release-summary-panel.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Props for ReleaseQueueView. */
export interface ReleaseQueueViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: QualityReleaseAdapterRequest
  /** Called when the user selects a release case from the queue. */
  readonly onSelectCase?: (releaseCaseId: string) => void
  /** Currently active release case ID for highlighting in the queue. */
  readonly activeCaseId?: string
}

/**
 * Release Queue view for the Quality Batch Release workspace.
 *
 * @remarks
 * Presents the prioritised release queue spanning the full grid width so the
 * complete list is visible at a glance, paired with the release summary panel
 * that shows aggregate readiness metrics for the active case. Selecting a row
 * in the queue raises `onSelectCase` to update the active case context in the
 * parent workspace shell.
 */
export function ReleaseQueueView({ request, onSelectCase, activeCaseId }: ReleaseQueueViewProps) {
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
        <ReleaseQueuePanel
          request={request}
          onSelectCase={onSelectCase}
          activeCaseId={activeCaseId}
        />
      </div>
      <ReleaseSummaryPanel request={request} />
    </div>
  )
}
