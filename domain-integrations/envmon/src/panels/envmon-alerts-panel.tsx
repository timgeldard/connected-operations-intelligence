import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonAlert } from '@connectio/data-contracts'
import { useEnvMonAlerts } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-alerts',
  displayName: 'Environmental Alerts',
  description: 'Active environmental monitoring alerts sorted by severity, including organism, zone, and corrective action status.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonAlertsPanelProps {
  readonly request: EnvMonAdapterRequest
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  investigating: 'Investigating',
  'corrective-action': 'CA Open',
  resolved: 'Resolved',
  escalated: 'Escalated',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function EnvMonAlertsPanel({ request }: EnvMonAlertsPanelProps) {
  const { data: result, isLoading } = useEnvMonAlerts(request)
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

  const alerts: EnvMonAlert[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {alerts && (
        <div style={{ padding: '8px 0' }}>
          {alerts.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No active alerts
            </div>
          ) : (
            alerts.map((alert) => {
              const color = SEVERITY_COLOR[alert.severity] ?? 'var(--shell-fg-2)'
              return (
                <div key={alert.alertId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color, border: `1px solid ${color}`, borderRadius: 4, padding: '1px 6px' }}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{alert.organism}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{STATUS_LABEL[alert.status] ?? alert.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{alert.zoneName} · {alert.testType}</div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{formatDate(alert.detectedAt)} · {alert.owner}</div>
                </div>
              )
            })
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
