import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingReadinessSummary } from '@connectio/data-contracts'
import { useStagingReadinessSummary } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-readiness-summary',
  displayName: 'Staging Readiness',
  description: 'Overall production staging readiness for the plan — orders staged, partial, blocked, and shortfalls open.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingReadinessSummaryPanelProps {
  readonly request: ProductionStagingAdapterRequest
}

const RISK_COLOR: Record<string, string> = {
  blocked: '#D32F2F',
  'at-risk': '#F57C00',
  ready: '#2E7D32',
  unknown: '#9E9E9E',
}

function Tile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 64, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--shell-fg)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

export function StagingReadinessSummaryPanel({ request }: StagingReadinessSummaryPanelProps) {
  const { data: result, isLoading } = useStagingReadinessSummary(request)
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

  const data: StagingReadinessSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>
              {Math.round(data.percentReady)}% Ready
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: RISK_COLOR[data.riskStatus] ?? 'var(--shell-fg-2)',
              border: `1px solid ${RISK_COLOR[data.riskStatus] ?? 'var(--shell-line)'}`,
              borderRadius: 4, padding: '2px 7px',
            }}>
              {data.riskStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tile label="Staged" value={data.fullyStaged} color="#2E7D32" />
            <Tile label="Partial" value={data.partiallyStaged} color="#D97706" />
            <Tile label="Not Staged" value={data.notStaged} color="#F57C00" />
            <Tile label="Blocked" value={data.blocked} color="#D32F2F" />
          </div>

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Shortfalls: <strong style={{ color: data.openShortfalls > 0 ? '#F57C00' : 'var(--shell-fg)' }}>{data.openShortfalls}</strong></span>
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Pick tasks: <strong>{data.pendingPickTasks}</strong></span>
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Move requests: <strong>{data.openMoveRequests}</strong></span>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
