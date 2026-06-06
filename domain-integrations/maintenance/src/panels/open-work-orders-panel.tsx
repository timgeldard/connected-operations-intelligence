import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { WorkOrder } from '@connectio/data-contracts'
import { useWorkOrders } from '../adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'open-work-orders',
  displayName: 'Open Work Orders',
  description: 'Active work orders by priority — corrective, preventive, emergency, and inspection tasks.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['maintenance-reliability'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'maintenance.overview.read', displayName: 'Maintenance Overview Read' }],
}

export interface OpenWorkOrdersPanelProps {
  readonly request: MaintenanceReliabilityAdapterRequest
  readonly onWorkOrderClick?: (workOrderId: string) => void
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

const STATUS_COLOR: Record<string, string> = {
  'in-progress': '#005776',
  'open': '#1565C0',
  'on-hold': '#9E9E9E',
  'completed': '#2E7D32',
}

const IMPACT_LABEL: Record<string, string> = {
  'line-down': 'Line Down',
  'reduced-capacity': 'Reduced Cap.',
  'no-impact': 'No Impact',
  'risk-only': 'Risk Only',
}

export function OpenWorkOrdersPanel({ request, onWorkOrderClick }: OpenWorkOrdersPanelProps) {
  const { data: result, isLoading } = useWorkOrders(request)
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

  const orders: WorkOrder[] = (result?.ok ? result.data : []).filter(o => o.status !== 'completed' && o.status !== 'cancelled')

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {orders.length === 0 && !isLoading && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No open work orders.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {orders.map(wo => (
          <button
            key={wo.workOrderId}
            onClick={() => onWorkOrderClick?.(wo.workOrderId)}
            style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: onWorkOrderClick ? 'pointer' : 'default', borderLeft: `3px solid ${PRIORITY_COLOR[wo.priority] ?? '#9E9E9E'}`, paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{wo.title}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: STATUS_COLOR[wo.status] ?? '#9E9E9E', color: '#fff', whiteSpace: 'nowrap', fontWeight: 600 }}>{wo.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-2)', flexWrap: 'wrap' }}>
              <span>{wo.equipmentDescription}</span>
              <span style={{ color: PRIORITY_COLOR[wo.priority] }}>{wo.priority}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
              <span>{wo.estimatedHours}h estimated</span>
              <span>{IMPACT_LABEL[wo.productionImpact]}</span>
              {wo.assignedTechnician && <span>{wo.assignedTechnician}</span>}
            </div>
          </button>
        ))}
      </div>
    </EvidencePanel>
  )
}
