import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonCorrectiveAction } from '@connectio/data-contracts'
import { useEnvMonCorrectiveActions } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-corrective-actions',
  displayName: 'Corrective Actions',
  description: 'Open environmental corrective and preventive actions (CAPAs) with status, assignee, and due date.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonCorrectiveActionsPanelProps {
  readonly request: EnvMonAdapterRequest
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

const STATUS_COLOR: Record<string, string> = {
  overdue: '#D32F2F',
  open: '#F57C00',
  'in-progress': '#1976D2',
  'pending-verification': '#7B1FA2',
  closed: '#2E7D32',
}

export function EnvMonCorrectiveActionsPanel({ request }: EnvMonCorrectiveActionsPanelProps) {
  const { data: result, isLoading } = useEnvMonCorrectiveActions(request)
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

  const actions: EnvMonCorrectiveAction[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {actions && (
        <div style={{ padding: '8px 0' }}>
          {actions.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--shell-fg-3)', fontSize: 13 }}>
              No open corrective actions
            </div>
          ) : (
            actions.map((action) => {
              const severityColor = SEVERITY_COLOR[action.severity] ?? 'var(--shell-fg-2)'
              const statusColor = STATUS_COLOR[action.status] ?? 'var(--shell-fg-2)'
              return (
                <div key={action.actionId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: severityColor, border: `1px solid ${severityColor}`, borderRadius: 4, padding: '1px 6px' }}>
                      {action.severity}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{action.title}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{action.zoneName} · {action.actionType}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: statusColor, textTransform: 'uppercase' }}>{action.status}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Due: {action.dueDate}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{action.assignee}</span>
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
