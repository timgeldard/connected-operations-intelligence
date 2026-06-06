import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SPCSummary } from '@connectio/data-contracts'
import { useSPCSummary } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'spc-summary',
  displayName: 'SPC Summary',
  description: 'Plant-level SPC summary — charts monitored, active signals, out-of-control count, warning count, and highest severity.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface SPCSummaryPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function SPCSummaryPanel({ request }: SPCSummaryPanelProps) {
  const { data: result, isLoading } = useSPCSummary(request)
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

  const data: SPCSummary | null = result?.ok ? result.data : null

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
            <Metric label="Charts Monitored" value={data.chartsMonitored} />
            <Metric label="Active Signals" value={data.activeSignals} highlight={data.activeSignals > 0} />
            <Metric label="Out of Control" value={data.outOfControlSignals} highlight={data.outOfControlSignals > 0} />
            <Metric label="Warning" value={data.warningSignals} soft={data.warningSignals > 0} />
            <Metric label="At Risk" value={data.characteristicsAtRisk} highlight={data.characteristicsAtRisk > 0} />
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <SeverityBadge severity={data.highestSeverity} />
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              Confidence {Math.round(data.confidence * 100)}%
            </span>
          </div>

          {data.recommendedAction && (
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', background: 'var(--shell-surface-2)', padding: '8px 10px', borderRadius: 4, borderLeft: '3px solid var(--sunset, #F24A00)' }}>
              {data.recommendedAction}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function Metric({ label, value, highlight = false, soft = false }: { label: string; value: number; highlight?: boolean; soft?: boolean }) {
  const color = highlight ? 'var(--sunset, #F24A00)' : soft ? '#D97706' : 'var(--shell-fg)'
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = { critical: '#D32F2F', high: 'var(--sunset, #F24A00)', medium: '#D97706', low: '#388E3C' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: colors[severity] ?? 'var(--shell-fg)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 6px', border: `1px solid ${colors[severity] ?? 'var(--shell-line)'}`, borderRadius: 3 }}>
      {severity}
    </span>
  )
}
