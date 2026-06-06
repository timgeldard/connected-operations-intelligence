import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonSiteSummary } from '@connectio/data-contracts'
import { useEnvMonSiteSummary } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-site-summary',
  displayName: 'Site Environmental Summary',
  description: 'Plant-level environmental monitoring KPIs — compliance rate, positive rate, open alerts, corrective actions.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.92, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonSiteSummaryPanelProps {
  readonly request: EnvMonAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  'non-compliant': '#D32F2F',
  elevated: '#F57C00',
  compliant: '#2E7D32',
  unknown: '#9E9E9E',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

function KpiTile({ label, value, suffix = '', color }: { label: string; value: number; suffix?: string; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 72, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--shell-fg)', lineHeight: 1 }}>{value}{suffix}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

export function EnvMonSiteSummaryPanel({ request }: EnvMonSiteSummaryPanelProps) {
  const { data: result, isLoading } = useEnvMonSiteSummary(request)
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

  const data: EnvMonSiteSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{data.plantName}</span>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: STATUS_COLOR[data.riskStatus] ?? 'var(--shell-fg-2)',
              border: `1px solid ${STATUS_COLOR[data.riskStatus] ?? 'var(--shell-line)'}`,
              borderRadius: 4, padding: '2px 7px',
            }}>
              {data.riskStatus}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <KpiTile label="Compliance" value={Math.round(data.complianceRate)} suffix="%" color={data.complianceRate >= 95 ? '#2E7D32' : '#F57C00'} />
            <KpiTile label="Positive Rate" value={Number(data.positiveRate.toFixed(1))} suffix="%" color={data.positiveRate > 5 ? '#D32F2F' : '#2E7D32'} />
            <KpiTile label="Open Alerts" value={data.zonesWithAlerts} color={data.zonesWithAlerts > 0 ? '#F57C00' : '#2E7D32'} />
            <KpiTile label="Actions Open" value={data.openCorrectiveActions} color={data.openCorrectiveActions > 0 ? '#D97706' : '#2E7D32'} />
          </div>

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              {data.zonesMonitored} zones monitored
            </span>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              color: SEVERITY_COLOR[data.highestSeverity] ?? 'var(--shell-fg-2)',
            }}>
              Highest: {data.highestSeverity}
            </span>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
