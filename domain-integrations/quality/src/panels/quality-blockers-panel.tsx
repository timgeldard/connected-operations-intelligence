import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { QualityBlocker } from '@connectio/data-contracts'
import { useQualityBlockers } from '../adapters/quality-blockers-queries.js'
import type { QualityBlockersAdapterRequest } from '../adapters/quality-blockers-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'quality-blockers',
  displayName: 'Quality Blockers',
  description: 'Quality blockers — holds, SPC alarms, deviations, and inspection lots — affecting plan execution.',
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

export interface QualityBlockersPanelProps {
  readonly request: QualityBlockersAdapterRequest
}

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

const SEVERITY_COLOUR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#FF9800',
  medium: '#FFC107',
  low: '#9E9E9E',
}

const TYPE_LABEL: Record<string, string> = {
  'inspection-lot': 'Inspection Lot',
  'release-hold': 'Release Hold',
  deviation: 'Deviation',
  'spc-alarm': 'SPC Alarm',
  'coa-incomplete': 'CoA Incomplete',
  other: 'Other',
}

export function QualityBlockersPanel({ request }: QualityBlockersPanelProps) {
  const { data: result, isLoading } = useQualityBlockers(request)
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

  const data: readonly QualityBlocker[] | null = result?.ok ? result.data : null
  const sorted = data ? [...data].sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)) : null
  const highestSeverity = sorted?.[0]?.severity ?? null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {sorted && (
        <div style={{ padding: '8px 0' }}>
          <div style={{ padding: '6px 16px 10px', borderBottom: '1px solid var(--shell-line)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: highestSeverity ? SEVERITY_COLOUR[highestSeverity] : 'var(--shell-fg)' }}>
              {sorted.length} quality blocker{sorted.length !== 1 ? 's' : ''}
            </span>
          </div>

          {sorted.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--shell-fg-3)' }}>
              No quality blockers for this plan
            </div>
          ) : (
            sorted.map((blocker) => (
              <div
                key={blocker.blockerId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--shell-line)',
                  alignItems: 'start',
                }}
              >
                <SeverityBadge severity={blocker.severity} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {TYPE_LABEL[blocker.type] ?? blocker.type}
                    </span>
                    {blocker.batchId && (
                      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{blocker.batchId}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', marginTop: 2 }}>
                    {blocker.materialDescription}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {blocker.description}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-3)' }}>
                    <span>{blocker.owner}</span>
                    {blocker.dueAt && (
                      <span style={{ color: isDueUrgent(blocker.dueAt) ? '#D32F2F' : 'var(--shell-fg-3)' }}>
                        Due {new Date(blocker.dueAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
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

function isDueUrgent(dueAt: string): boolean {
  return (new Date(dueAt).getTime() - Date.now()) < 24 * 60 * 60 * 1000
}
