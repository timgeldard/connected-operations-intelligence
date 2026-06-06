import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { RelatedInvestigation } from '@connectio/data-contracts'
import { useRelatedInvestigations } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the Related Investigations panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'related-investigations',
  displayName: 'Related Investigations',
  description: 'Other open or historical investigations linked by batch, material, supplier, or customer.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'quality-batch-release'],
  requiredContext: [],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: true },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Severity badge colour mapping. */
const severityColour: Record<string, string> = {
  critical: 'var(--sunset, #F24A00)',
  high: '#D97706',
  medium: '#D4A017',
  low: 'var(--sage, #289BA2)',
}

/** Props for RelatedInvestigationsPanel. */
export interface RelatedInvestigationsPanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel listing investigations related to the current investigation.
 *
 * @remarks
 * Each row links the investigation ID, title, status, severity, and
 * relation reason. In Phase 1 clicking an investigation row does not
 * navigate — drill-through will be wired in Phase 2.
 */
export function RelatedInvestigationsPanel({ request }: RelatedInvestigationsPanelProps) {
  const { data: result, isLoading } = useRelatedInvestigations(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const investigations: readonly RelatedInvestigation[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {investigations.length > 0 && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {investigations.map(inv => (
            <div
              key={inv.investigationId}
              style={{
                padding: '8px 10px',
                background: 'var(--shell-surface)',
                border: '1px solid var(--shell-line)',
                borderRadius: 4,
                display: 'grid',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-3)', fontFamily: 'monospace' }}>
                  {inv.investigationId}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: severityColour[inv.severity] ?? 'var(--shell-fg-3)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    flexShrink: 0,
                  }}
                  aria-label={`Severity: ${inv.severity}`}
                >
                  {inv.severity}
                </span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--shell-fg)' }}>{inv.title}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge text={inv.status.replace(/-/g, ' ')} />
                <Badge text={inv.relatedBy.replace(/-/g, ' ')} muted />
                {inv.owner && <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{inv.owner}</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>
                Opened {new Date(inv.openedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </EvidencePanel>
  )
}

/** Small inline badge used for status and relation-type labels. */
function Badge({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: 3,
        background: muted ? 'transparent' : 'var(--shell-rail-active, var(--valentia-slate, #005776))',
        color: muted ? 'var(--shell-fg-3)' : '#fff',
        border: muted ? '1px solid var(--shell-line)' : 'none',
        textTransform: 'capitalize',
      }}
    >
      {text}
    </span>
  )
}
