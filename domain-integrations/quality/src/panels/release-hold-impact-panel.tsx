import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ReleaseHoldImpact } from '@connectio/data-contracts'
import { useReleaseHoldImpacts } from '../adapters/quality-blockers-queries.js'
import type { QualityBlockersAdapterRequest } from '../adapters/quality-blockers-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'release-hold-impact',
  displayName: 'Release Hold Impact',
  description: 'Batch holds and their operational impact on orders and deliveries.',
  ownerDomain: 'quality',
  sourceOwnership: { domainId: 'quality', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  drillThrough: { label: 'Open Batch Release', targetWorkspaceId: 'quality-batch-release', targetViewId: 'batch-decision', contextScopes: ['batch'] },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface ReleaseHoldImpactPanelProps {
  readonly request: QualityBlockersAdapterRequest
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const SEVERITY_COLOUR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#FF9800',
  medium: '#FFC107',
  low: '#9E9E9E',
}

const RELEASE_STATUS_COLOUR: Record<string, string> = {
  active: '#D32F2F',
  'pending-release': '#FFC107',
  escalated: '#FF9800',
  released: '#4CAF50',
}

export function ReleaseHoldImpactPanel({ request }: ReleaseHoldImpactPanelProps) {
  const { data: result, isLoading } = useReleaseHoldImpacts(request)
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

  const data: readonly ReleaseHoldImpact[] | null = result?.ok ? result.data : null
  const sorted = data ? [...data].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)) : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {sorted && (
        <div style={{ padding: '8px 0' }}>
          {sorted.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--shell-fg-3)' }}>
              No release holds affecting this plan
            </div>
          ) : (
            sorted.map((hold) => (
              <div
                key={hold.holdId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr auto',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--shell-line)',
                  alignItems: 'start',
                }}
              >
                <HoldSeverityBadge severity={hold.severity} />

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--shell-fg)' }}>{hold.batchId}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{hold.materialDescription}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {hold.holdReason}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    <span>{hold.blockedQuantity.toLocaleString()} KG</span>
                    {hold.affectedOrders.length > 0 && (
                      <span>{hold.affectedOrders.length} order{hold.affectedOrders.length !== 1 ? 's' : ''}</span>
                    )}
                    <span>{hold.qualityOwner}</span>
                  </div>
                </div>

                <ReleaseStatusBadge status={hold.releaseStatus} />
              </div>
            ))
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function HoldSeverityBadge({ severity }: { severity: string }) {
  const colour = SEVERITY_COLOUR[severity] ?? '#9E9E9E'
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: colour,
        background: `${colour}22`,
        padding: '2px 6px',
        borderRadius: 10,
        whiteSpace: 'nowrap',
        marginTop: 2,
      }}
    >
      {severity}
    </span>
  )
}

function ReleaseStatusBadge({ status }: { status: string }) {
  const colour = RELEASE_STATUS_COLOUR[status] ?? 'var(--shell-fg)'
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        color: colour,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {status.replace(/-/g, ' ')}
    </span>
  )
}
