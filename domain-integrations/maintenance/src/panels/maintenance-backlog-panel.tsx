import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { MaintenanceBacklogItem } from '@connectio/data-contracts'
import { useMaintenanceBacklog } from '../adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'maintenance-backlog',
  displayName: 'Maintenance Backlog',
  description: 'Deferred maintenance items — reason for deferral, estimated hours, priority, and target completion date.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['maintenance-reliability'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'maintenance.overview.read', displayName: 'Maintenance Overview Read' }],
}

export interface MaintenanceBacklogPanelProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

export function MaintenanceBacklogPanel({ request }: MaintenanceBacklogPanelProps) {
  const { data: result, isLoading } = useMaintenanceBacklog(request)
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

  const backlog: MaintenanceBacklogItem[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {backlog.length === 0 && !isLoading && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No backlog items.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {backlog.map(item => (
          <div key={item.backlogId} style={{ borderLeft: `3px solid ${PRIORITY_COLOR[item.priority] ?? '#9E9E9E'}`, paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{item.title}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: PRIORITY_COLOR[item.priority] ?? '#9E9E9E', color: '#fff', fontWeight: 700 }}>{item.priority}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 4 }}>{item.equipmentDescription}</div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2, fontStyle: 'italic' }}>{item.deferredReason}</div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
              <span>{item.estimatedHours}h</span>
              {item.targetCompletionDate && <span>Target: {new Date(item.targetCompletionDate).toLocaleDateString()}</span>}
            </div>
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
