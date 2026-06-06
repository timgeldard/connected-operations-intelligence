import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceExposureSummary } from '@connectio/data-contracts'

/**
 * Static registration record for the Trace Exposure Summary panel.
 *
 * @remarks
 * Data is considered stale after 5 minutes and enters error state after
 * 15 minutes. `refreshOnFocus` is enabled so users returning to the tab
 * always see a fresh request triggered.
 */
const registration: EvidencePanelRegistration = {
  panelId: 'trace-exposure-summary',
  displayName: 'Trace Exposure Summary',
  description: 'Summary of batch exposure across supply-chain nodes',
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
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.97, hidden: false },
  requiredPermissions: [],
}

/** Props accepted by TraceExposureSummaryPanel. */
export interface TraceExposureSummaryPanelProps {
  /**
   * Pre-fetched exposure summary, or null while loading / not yet available.
   * The panel renders placeholder chrome in loading state when null.
   */
  data: TraceExposureSummary | null
}

/**
 * Evidence panel that displays the exposure summary for a single batch.
 *
 * @remarks
 * `useEvidencePanel` begins in `loading` state. The panel transitions to
 * `ready` automatically once `data` is non-null, and back to `loading` when
 * `data` is cleared. Errors should be reflected by passing null and calling
 * the parent's error handler — the panel itself does not perform fetching.
 */
export function TraceExposureSummaryPanel({ data }: TraceExposureSummaryPanelProps) {
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
            {data.affectedBatches} batch(es) affected &middot; Risk:{' '}
            <strong>{data.riskLevel}</strong>
          </p>
          {data.affectedCustomers != null && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--shell-fg-2)' }}>
              {data.affectedCustomers} customer(s) exposed
            </p>
          )}
          {data.affectedSuppliers != null && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--shell-fg-2)' }}>
              {data.affectedSuppliers} supplier(s) in scope
            </p>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
