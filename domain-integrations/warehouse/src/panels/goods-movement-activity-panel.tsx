import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { GoodsMovementEvent } from '@connectio/data-contracts'
import { useGoodsMovements } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'goods-movement-activity',
  displayName: 'Goods Movement Activity',
  description: 'Recent goods receipts, goods issues, transfer orders, and stock adjustments posted in this warehouse.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'sap-wm', legacyAppId: 'warehouse360' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface GoodsMovementActivityPanelProps {
  readonly request: Warehouse360AdapterRequest
}

const MVT_ICON: Record<string, string> = {
  'goods-receipt': '↓',
  'goods-issue': '↑',
  'transfer-order': '→',
  'stock-transfer': '⇄',
  'return': '↩',
  'adjustment': '±',
}

const MVT_COLOR: Record<string, string> = {
  'goods-receipt': '#2E7D32',
  'goods-issue': '#005776',
  'transfer-order': '#6A1B9A',
  'stock-transfer': '#1565C0',
  'return': '#D97706',
  'adjustment': '#546E7A',
}

export function GoodsMovementActivityPanel({ request }: GoodsMovementActivityPanelProps) {
  const { data: result, isLoading } = useGoodsMovements(request)
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

  const movements: GoodsMovementEvent[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {movements.length === 0 && result?.ok && (
        <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-3)' }}>No recent movements.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {movements.map(mvt => (
          <div key={mvt.movementId} style={{ display: 'grid', gridTemplateColumns: '28px 1fr', gap: 8, alignItems: 'start', paddingBottom: 6, borderBottom: '1px solid var(--shell-line)' }}>
            <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, background: MVT_COLOR[mvt.movementType] ?? '#9E9E9E', color: '#fff', fontWeight: 700, fontSize: 14 }}>
              {MVT_ICON[mvt.movementType] ?? '·'}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{mvt.materialDescription}</div>
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 2 }}>
                <span>{Math.abs(mvt.quantity).toLocaleString()} {mvt.uom}</span>
                {mvt.batchId && <span>Batch: {mvt.batchId}</span>}
                {mvt.referenceDocument && <span style={{ color: 'var(--shell-fg-3)' }}>{mvt.referenceDocument}</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                {new Date(mvt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {mvt.destinationLocation && ` · ${mvt.destinationLocation}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
