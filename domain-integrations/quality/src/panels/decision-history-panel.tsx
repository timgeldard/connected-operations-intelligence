import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ReleaseDecisionHistoryItem } from '@connectio/data-contracts'
import { useDecisionHistory } from '../adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Static registration record for the Decision History panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'decision-history',
  displayName: 'Decision History',
  description: 'Audit trail of release decisions for the batch — who decided what, when, and why.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.99, hidden: true },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for DecisionHistoryPanel. */
export interface DecisionHistoryPanelProps {
  /** Adapter request context providing releaseCaseId and batchId. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Evidence panel displaying the release decision audit trail.
 */
export function DecisionHistoryPanel({ request }: DecisionHistoryPanelProps) {
  const { data: result, isLoading } = useDecisionHistory(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const data: readonly ReleaseDecisionHistoryItem[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          {data.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--shell-fg-3)', textAlign: 'center', padding: '16px 0' }}>
              No release decisions recorded yet.
            </div>
          ) : (
            data.map((item) => (
              <div
                key={item.decisionId}
                style={{ fontSize: 12, padding: '8px 10px', background: 'var(--shell-surface-2)', borderRadius: 4, borderLeft: `3px solid ${DECISION_COLOUR[item.decision] ?? '#9E9E9E'}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <DecisionBadge decision={item.decision} />
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    {new Date(item.decidedAt).toLocaleString()}
                  </span>
                </div>
                <div style={{ color: 'var(--shell-fg)', marginTop: 4, fontWeight: 500 }}>{item.decidedBy}</div>
                <div style={{ color: 'var(--shell-fg-2)', marginTop: 4 }}>{item.rationale}</div>
                {item.conditions.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: '#FF9800', marginRight: 6 }}>Conditions:</span>
                    {item.conditions.map((c, i) => (
                      <span key={i} style={{ fontSize: 11, marginRight: 8, color: 'var(--shell-fg-2)' }}>{c}</span>
                    ))}
                  </div>
                )}
                {item.attachments.length > 0 && (
                  <div style={{ marginTop: 4, color: 'var(--shell-fg-3)', fontSize: 11 }}>
                    📎 {item.attachments.map((a) => a.name).join(', ')}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

const DECISION_COLOUR: Record<string, string> = {
  released: '#4CAF50',
  'conditional-release': '#FF9800',
  rejected: '#D32F2F',
  'placed-on-hold': '#FF9800',
  escalated: '#9C27B0',
  'retest-requested': '#2196F3',
  'hold-released': '#4CAF50',
}

function DecisionBadge({ decision }: { decision: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: DECISION_COLOUR[decision] ?? 'var(--shell-fg)', textTransform: 'capitalize' }}>
      {decision.replace(/-/g, ' ')}
    </span>
  )
}
