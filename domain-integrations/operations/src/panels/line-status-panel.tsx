import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { LineStatus } from '@connectio/data-contracts'
import { useLineStatus } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'line-status',
  displayName: 'Line Status',
  description: 'Current status and risk level for each production line or resource.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.92, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

const STATUS_COLOUR: Record<string, string> = {
  running: '#2E7D32',
  idle: 'var(--shell-fg-3)',
  changeover: '#005776',
  downtime: '#D32F2F',
  'planned-stop': 'var(--shell-fg-3)',
  unknown: 'var(--shell-fg-3)',
}

const RISK_COLOUR: Record<string, string> = {
  none: '#2E7D32',
  low: '#2E7D32',
  medium: '#D97706',
  high: '#F24A00',
  critical: '#D32F2F',
}

function oeeColor(oee: number): string {
  if (oee >= 85) return '#2E7D32'
  if (oee >= 70) return '#D97706'
  return '#D32F2F'
}

function LineCard({ line }: { line: LineStatus }) {
  return (
    <div style={{ background: 'var(--shell-surface-2)', border: '1px solid var(--shell-line)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--shell-fg)' }}>{line.lineName}</div>
          <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 1 }}>{line.lineId}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOUR[line.status] ?? 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.06em', border: `1px solid ${STATUS_COLOUR[line.status] ?? 'var(--shell-line)'}`, borderRadius: 3, padding: '1px 5px' }}>
          {line.status.replace(/-/g, ' ')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>OEE</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: oeeColor(line.oee), lineHeight: 1 }}>{line.oee.toFixed(1)}%</div>
        </div>
        <div style={{ flex: 1 }}>
          {line.downtimeMinutes > 0 && (
            <div style={{ fontSize: 11, color: '#D32F2F', fontWeight: 600 }}>{line.downtimeMinutes} min down</div>
          )}
          {line.status === 'running' && line.currentMaterial && (
            <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{line.currentMaterial}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOUR[line.riskLevel] ?? 'var(--shell-fg-3)', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: RISK_COLOUR[line.riskLevel] ?? 'var(--shell-fg-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {line.riskLevel}
          </span>
        </div>
      </div>
    </div>
  )
}

export interface LineStatusPanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

export function LineStatusPanel({ request }: LineStatusPanelProps) {
  const { data: result, isLoading } = useLineStatus(request)
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

  const data: LineStatus[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px' }}>
          {data.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--shell-fg-3)', padding: '8px 0' }}>No line status data available.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {data.map((line) => (
                <LineCard key={line.lineId} line={line} />
              ))}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
