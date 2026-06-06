import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ReliabilityMetric } from '@connectio/data-contracts'
import { useReliabilityMetrics } from '../adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'reliability-metrics',
  displayName: 'Reliability Metrics',
  description: 'MTBF, MTTR, failure count, and OEE impact per equipment over the last 90 days.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['maintenance-reliability'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 900, errorAfterSeconds: 3600, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.88, hidden: false },
  requiredPermissions: [{ permissionId: 'maintenance.overview.read', displayName: 'Maintenance Overview Read' }],
}

export interface ReliabilityMetricsPanelProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

const TREND_ICON: Record<string, string> = {
  improving: '↑',
  stable: '→',
  degrading: '↓',
}

const TREND_COLOR: Record<string, string> = {
  improving: '#2E7D32',
  stable: '#005776',
  degrading: '#D32F2F',
}

const ROW: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 64px 64px 48px 64px', gap: 6, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--shell-line)', fontSize: 11 }
const HDR: React.CSSProperties = { ...ROW, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--shell-fg-3)', borderBottom: '2px solid var(--shell-line)' }

export function ReliabilityMetricsPanel({ request }: ReliabilityMetricsPanelProps) {
  const { data: result, isLoading } = useReliabilityMetrics(request)
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

  const metrics: ReliabilityMetric[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {metrics.length === 0 && !isLoading && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No reliability data.</p>
      )}
      {metrics.length > 0 && (
        <div>
          <div style={HDR}>
            <span>Equipment</span>
            <span style={{ textAlign: 'right' }}>MTBF h</span>
            <span style={{ textAlign: 'right' }}>MTTR h</span>
            <span style={{ textAlign: 'right' }}>Fails</span>
            <span style={{ textAlign: 'right' }}>OEE %</span>
          </div>
          {metrics.map(m => (
            <div key={m.equipmentId} style={ROW}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                <span style={{ color: TREND_COLOR[m.trendDirection], fontWeight: 700 }}>{TREND_ICON[m.trendDirection]}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--shell-fg)' }}>{m.equipmentDescription}</span>
              </div>
              <span style={{ textAlign: 'right', color: 'var(--shell-fg-2)' }}>{m.mtbfHours.toFixed(0)}</span>
              <span style={{ textAlign: 'right', color: 'var(--shell-fg-2)' }}>{m.mttrHours.toFixed(1)}</span>
              <span style={{ textAlign: 'right', color: m.failureCount > 2 ? '#D32F2F' : 'var(--shell-fg-2)' }}>{m.failureCount}</span>
              <span style={{ textAlign: 'right', color: m.oeeImpactPercent > 3 ? '#F57C00' : 'var(--shell-fg-2)' }}>{m.oeeImpactPercent.toFixed(1)}</span>
            </div>
          ))}
          <p style={{ margin: '8px 0 0', fontSize: 10, color: 'var(--shell-fg-3)' }}>Last 90 days</p>
        </div>
      )}
    </EvidencePanel>
  )
}
