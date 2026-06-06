import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ReplenishmentNeed } from '@connectio/data-contracts'
import { useReplenishmentNeeds } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'replenishment-needs',
  displayName: 'Replenishment Needs',
  description: 'Materials at or below reorder point — current vs reorder quantity, urgency, and open purchase orders.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface ReplenishmentNeedsPanelProps {
  readonly request: Warehouse360AdapterRequest
}

const URGENCY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

export function ReplenishmentNeedsPanel({ request }: ReplenishmentNeedsPanelProps) {
  const { data: result, isLoading } = useReplenishmentNeeds(request)
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

  const needs: ReplenishmentNeed[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {needs.length === 0 && result?.ok && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No replenishment needs.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {needs.map(need => (
          <div key={need.needId} style={{ borderLeft: `3px solid ${URGENCY_COLOR[need.urgency] ?? '#9E9E9E'}`, paddingLeft: 10, paddingTop: 4, paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{need.materialDescription}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: URGENCY_COLOR[need.urgency] ?? '#9E9E9E', color: '#fff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{need.urgency}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: 'var(--shell-fg-2)' }}>
              <span>Stock: {need.currentStockQuantity.toLocaleString()} / ROP: {need.reorderPoint.toLocaleString()} {need.uom}</span>
            </div>
            {need.openPurchaseOrderId && (
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                PO: {need.openPurchaseOrderId}
                {need.expectedDelivery && ` · ETA ${new Date(need.expectedDelivery).toLocaleDateString()}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
