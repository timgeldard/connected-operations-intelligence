import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingAlert } from '@connectio/data-contracts'
import { useStagingAlerts } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-alerts',
  displayName: 'Staging Alerts',
  description: 'Active warehouse staging alerts — shortfalls, blocked orders, zone capacity, and move delays.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingAlertsPanelProps {
  readonly request: ProductionStagingAdapterRequest
  readonly onNavigateToWorkspace?: (workspaceId: string) => void
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#9E9E9E',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  'in-progress': 'In Progress',
  resolved: 'Resolved',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function StagingAlertsPanel({ request, onNavigateToWorkspace }: StagingAlertsPanelProps) {
  const { data: result, isLoading } = useStagingAlerts(request)
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

  const alerts: StagingAlert[] | null = result?.ok ? result.data : null
  const open = alerts?.filter(a => a.status !== 'resolved') ?? null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {open && (
        <div style={{ padding: '8px 0' }}>
          {open.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No active staging alerts
            </div>
          ) : (
            open.map((alert) => {
              const color = SEVERITY_COLOR[alert.severity] ?? 'var(--shell-fg-2)'
              return (
                <div key={alert.alertId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color, border: `1px solid ${color}`, borderRadius: 4, padding: '1px 6px' }}>
                      {alert.severity}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--shell-fg)', flex: 1 }}>{alert.description}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{alert.recommendedAction}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{STATUS_LABEL[alert.status] ?? alert.status}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{formatTime(alert.raisedAt)}</span>
                    {alert.owner && (
                      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{alert.owner}</span>
                    )}
                    {alert.alertType === 'blocked-order' && onNavigateToWorkspace && (
                      <button
                        onClick={() => onNavigateToWorkspace('warehouse-360-overview')}
                        style={{ fontSize: 11, color: 'var(--ocean, #005776)', border: '1px solid var(--ocean, #005776)', borderRadius: 4, padding: '1px 6px', background: 'transparent', cursor: 'pointer' }}
                      >
                        View WH360 Holds
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
