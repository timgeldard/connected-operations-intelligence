import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { NearExpiryBatch } from '@connectio/data-contracts'
import { useNearExpiryStock } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'near-expiry-stock',
  displayName: 'Near-Expiry Stock',
  description: 'Batches approaching or past their expiry date — requires immediate review or disposal.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

const URGENCY_COLOR: Record<NearExpiryBatch['urgency'], string> = {
  expired: '#D32F2F',
  critical: '#F57C00',
  warning: '#D97706',
  caution: '#388E3C',
}

const URGENCY_LABEL: Record<NearExpiryBatch['urgency'], string> = {
  expired: 'EXPIRED',
  critical: 'CRITICAL',
  warning: 'WARNING',
  caution: 'CAUTION',
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `${days}d remaining`
}

export interface NearExpiryStockPanelProps {
  readonly request: Warehouse360AdapterRequest
}

export function NearExpiryStockPanel({ request }: NearExpiryStockPanelProps) {
  const { data: result, isLoading } = useNearExpiryStock(request)
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

  const batches: NearExpiryBatch[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {batches.length === 0 && result?.ok && (
        <div
          role="status"
          style={{ padding: '16px', color: 'var(--shell-fg-3)', fontSize: 13 }}
        >
          No near-expiry batches found.
        </div>
      )}

      {batches.length > 0 && (
        <div style={{ display: 'grid', gap: 6, padding: '12px 16px' }}>
          {batches.map((batch) => (
            <div
              key={batch.batchId}
              style={{
                borderLeft: `3px solid ${URGENCY_COLOR[batch.urgency]}`,
                paddingLeft: 10,
                paddingTop: 6,
                paddingBottom: 6,
                display: 'grid',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--shell-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {batch.materialDescription}
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: URGENCY_COLOR[batch.urgency], textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
                  {URGENCY_LABEL[batch.urgency]}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                {batch.batchId} · {batch.quantity} {batch.uom} · {batch.storageLocationId}
              </div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
                {daysLabel(batch.daysUntilExpiry)}
                {batch.holdStatus !== 'unrestricted' && (
                  <span style={{ marginLeft: 8, color: '#D32F2F' }}>· {batch.holdStatus}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </EvidencePanel>
  )
}
