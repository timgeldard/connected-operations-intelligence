import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { OpenHoldItem } from '@connectio/data-contracts'
import { useOpenHolds } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'open-holds',
  displayName: 'Open Holds',
  description: 'Current warehouse holds — material, batch, reason, quantity, age, and linked workspace for resolution.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface OpenHoldsPanelProps {
  readonly request: Warehouse360AdapterRequest
  readonly onHoldNavigate?: (workspaceId: string) => void
}

const REASON_COLOR: Record<string, string> = {
  'quality-hold': '#D32F2F',
  'investigation': '#7B1FA2',
  'expired': '#D97706',
  'customer-hold': '#F57C00',
  'production-hold': '#005776',
  'regulatory-hold': '#1565C0',
  'damaged': '#8D6E63',
}

const REASON_LABEL: Record<string, string> = {
  'quality-hold': 'Quality Hold',
  'investigation': 'Investigation',
  'expired': 'Expired',
  'customer-hold': 'Customer Hold',
  'production-hold': 'Production Hold',
  'regulatory-hold': 'Regulatory Hold',
  'damaged': 'Damaged',
}

export function OpenHoldsPanel({ request, onHoldNavigate }: OpenHoldsPanelProps) {
  const { data: result, isLoading } = useOpenHolds(request)
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

  const holds: OpenHoldItem[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {holds.length === 0 && result?.ok && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No open holds.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {holds.map(hold => (
          <div key={hold.holdId} style={{ borderLeft: `3px solid ${REASON_COLOR[hold.holdReason] ?? '#9E9E9E'}`, paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{hold.materialDescription}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: REASON_COLOR[hold.holdReason] ?? '#9E9E9E', color: '#fff', whiteSpace: 'nowrap', fontWeight: 600 }}>{REASON_LABEL[hold.holdReason] ?? hold.holdReason}</span>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-2)' }}>
              {hold.batchId && <span>Batch: {hold.batchId}</span>}
              <span>{hold.holdQuantity.toLocaleString()} {hold.uom}</span>
              <span style={{ color: hold.ageHours > 24 ? '#D32F2F' : 'var(--shell-fg-3)' }}>{hold.ageHours.toFixed(0)}h old</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>{hold.storageLocationId}</span>
              {hold.linkedWorkspaceId && onHoldNavigate && (
                <button
                  onClick={() => onHoldNavigate(hold.linkedWorkspaceId!)}
                  style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', fontSize: 11, color: 'var(--ocean, #005776)', fontWeight: 600 }}
                >
                  → {hold.linkedWorkspaceId}
                </button>
              )}
              {hold.linkedWorkspaceId && !onHoldNavigate && (
                <span>· → {hold.linkedWorkspaceId}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
