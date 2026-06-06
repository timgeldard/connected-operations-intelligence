import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { DeviationSummary } from '@connectio/data-contracts'
import { useDeviations } from '../adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from '../adapters/quality-release-adapter.js'

/** Static registration record for the Deviations panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'deviations',
  displayName: 'Deviations',
  description: 'Active and recent deviations associated with the batch and process order, highlighting those that block release.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'sap-qm', legacyAppId: 'connectedquality' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.97, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for DeviationsPanel. */
export interface DeviationsPanelProps {
  /** Adapter request context providing releaseCaseId and batchId. */
  readonly request: QualityReleaseAdapterRequest
}

/**
 * Evidence panel displaying active deviations relevant to a batch release decision.
 */
export function DeviationsPanel({ request }: DeviationsPanelProps) {
  const { data: result, isLoading } = useDeviations(request)
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

  const data: DeviationSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <DevMetric label="Total" value={data.totalDeviationCount} />
            <DevMetric label="Open" value={data.openDeviationCount} highlight={data.openDeviationCount > 0} />
            <DevMetric label="Critical" value={data.criticalDeviationCount} highlight={data.criticalDeviationCount > 0} />
            <DevMetric label="Blocking Release" value={data.blockingReleaseCount} highlight={data.blockingReleaseCount > 0} />
          </div>

          {data.deviations.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.deviations.map((dev) => (
                  <div
                     key={dev.deviationId}
                     style={{
                       fontSize: 12,
                       padding: '6px 8px',
                       background: 'var(--shell-surface-2)',
                       borderRadius: 4,
                       borderLeft: `3px solid ${dev.impactsRelease ? '#D32F2F' : '#9E9E9E'}`,
                     }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, color: 'var(--shell-fg)' }}>{dev.deviationId}</span>
                        <DevSeverityBadge severity={dev.severity} />
                        {dev.impactsRelease && (
                          <span style={{ fontSize: 10, color: '#D32F2F', fontWeight: 700 }}>BLOCKS RELEASE</span>
                        )}
                      </div>
                      <DevStatusChip status={dev.status} />
                    </div>
                    <div style={{ color: 'var(--shell-fg-2)', marginTop: 4 }}>{dev.description}</div>
                    <div style={{ color: 'var(--shell-fg-3)', marginTop: 2, fontSize: 11 }}>
                      {dev.type.charAt(0).toUpperCase() + dev.type.slice(1)} · Raised {new Date(dev.raisedAt).toLocaleDateString()} by {dev.raisedBy}
                      {dev.resolvedAt && ` · Resolved ${new Date(dev.resolvedAt).toLocaleDateString()}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>
            This panel uses simulated mock data. Deviation blocking status is derived from quality records. Review closed or waived deviations to ensure all critical conditions are verified.
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function DevMetric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}

const SEVERITY_COLOUR: Record<string, string> = {
  critical: '#D32F2F',
  major: 'var(--sunset, #F24A00)',
  minor: '#FF9800',
}

function DevSeverityBadge({ severity }: { severity: string }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: SEVERITY_COLOUR[severity] ?? 'var(--shell-fg)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {severity}
    </span>
  )
}

function DevStatusChip({ status }: { status: string }) {
  const colour = status === 'closed' || status === 'waived' ? '#9E9E9E' : status === 'open' ? '#D32F2F' : '#FF9800'
  return (
    <span style={{ fontSize: 10, fontWeight: 600, color: colour, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
      {status.replace(/-/g, ' ')}
    </span>
  )
}
