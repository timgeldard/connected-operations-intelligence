import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingMoveRequest } from '@connectio/data-contracts'
import { useStagingMoveRequests } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-move-requests',
  displayName: 'Move Requests',
  description: 'Open internal transfer requests supporting staging readiness for today\'s production orders.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingMoveRequestsPanelProps {
  readonly request: ProductionStagingAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  completed: '#2E7D32',
  'in-transit': '#1976D2',
  assigned: '#7B1FA2',
  open: '#F57C00',
  cancelled: '#9E9E9E',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#9E9E9E',
}

export function StagingMoveRequestsPanel({ request }: StagingMoveRequestsPanelProps) {
  const { data: result, isLoading } = useStagingMoveRequests(request)
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

  const moveRequests: StagingMoveRequest[] | null = result?.ok ? result.data : null
  const open = moveRequests?.filter(r => r.status !== 'completed' && r.status !== 'cancelled') ?? null

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
              No open move requests
            </div>
          ) : (
            open.map((req) => {
              const statusColor = STATUS_COLOR[req.status] ?? 'var(--shell-fg-2)'
              const priorityColor = PRIORITY_COLOR[req.priority] ?? 'var(--shell-fg-2)'
              return (
                <div key={req.requestId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: priorityColor, border: `1px solid ${priorityColor}`, borderRadius: 4, padding: '1px 6px' }}>
                      {req.priority}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{req.materialDescription}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: statusColor }}>{req.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                    {req.fromLocation} → {req.toLocation} · {req.quantity} {req.uom}
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{req.requestId}</span>
                    {req.assignedTo && (
                      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{req.assignedTo}</span>
                    )}
                    {req.processOrderId && (
                      <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{req.processOrderId}</span>
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
