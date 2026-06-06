import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { BatchLineage } from '../traceabilityClient.js'

/**
 * Static registration record for the Batch Lineage panel.
 *
 * @remarks
 * Lineage graphs are relatively stable; staleness threshold is 10 minutes.
 * `refreshOnFocus` is disabled because re-rendering a large graph on every
 * tab-focus would be visually disruptive.
 */
const registration: EvidencePanelRegistration = {
  panelId: 'batch-lineage',
  displayName: 'Batch Lineage',
  description: 'Parent/child batch relationships in the production graph',
  ownerDomain: 'traceability',
  sourceOwnership: {
    domainId: 'traceability',
    systemName: 'trace2',
    legacyAppId: 'trace2',
  },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['traceability-workspace'],
  requiredContext: [],
  freshnessPolicy: {
    staleAfterSeconds: 600,
    errorAfterSeconds: 1800,
    refreshOnFocus: false,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: null, hidden: true },
  requiredPermissions: [],
}

/** Props accepted by BatchLineagePanel. */
export interface BatchLineagePanelProps {
  /**
   * Pre-fetched lineage data, or null while loading / not yet available.
   * The panel renders placeholder chrome in loading state when null.
   */
  data: BatchLineage | null
}

/**
 * Evidence panel that displays the immediate lineage graph for a single batch.
 *
 * @remarks
 * `useEvidencePanel` begins in `loading` state. The panel transitions to
 * `ready` automatically once `data` is non-null. This component renders a
 * concise text summary; a full interactive graph is out of scope for Phase 1.
 */
export function BatchLineagePanel({ data }: BatchLineagePanelProps) {
  // Phase 1: no data fetching yet; lastRefreshedAt is always null until wired.
  const lastRefreshedAt: string | null = null

  const { displayState, markReady } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  // Transition to ready once data arrives. The panel stays in `loading` state
  // (the hook's initial state) until data is provided — never call markStale()
  // pre-emptively, as stale implies the panel previously had data.
  useEffect(() => {
    if (data !== null) {
      markReady()
    }
  }, [data, markReady])

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
    >
      {data && (
        <div style={{ padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--shell-fg)' }}>
            Batch <strong>{data.batchId}</strong> — {data.materialId}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--shell-fg-2)' }}>
            {data.parentBatches.length} parent(s) &middot;{' '}
            {data.childBatches.length} child(ren) &middot; depth {data.depth}
          </p>
          {data.parentBatches.length > 0 && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--shell-fg-2)' }}>
              Parents: {data.parentBatches.join(', ')}
            </p>
          )}
          {data.childBatches.length > 0 && (
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--shell-fg-2)' }}>
              Children: {data.childBatches.join(', ')}
            </p>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
