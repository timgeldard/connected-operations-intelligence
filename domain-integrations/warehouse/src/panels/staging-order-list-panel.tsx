import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingOrderSummary } from '@connectio/data-contracts'
import { useStagingOrderSummaries } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-order-list',
  displayName: 'Staging Orders',
  description: 'Process orders for today\'s plan with staging status, required vs staged quantity, and urgency.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingOrderListPanelProps {
  readonly request: ProductionStagingAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  blocked: '#D32F2F',
  'not-staged': '#F57C00',
  partial: '#D97706',
  staged: '#2E7D32',
  'not-required': '#9E9E9E',
}

const URGENCY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#9E9E9E',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export function StagingOrderListPanel({ request }: StagingOrderListPanelProps) {
  const { data: result, isLoading } = useStagingOrderSummaries(request)
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

  const orders: StagingOrderSummary[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {orders && (
        <div style={{ padding: '8px 0' }}>
          {orders.map((order) => {
            const statusColor = STATUS_COLOR[order.status] ?? 'var(--shell-fg-2)'
            const urgencyColor = URGENCY_COLOR[order.urgency] ?? 'var(--shell-fg-2)'
            const pct = order.requiredQuantity > 0
              ? Math.round((order.stagedQuantity / order.requiredQuantity) * 100)
              : 100
            return (
              <div key={order.processOrderId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: urgencyColor, border: `1px solid ${urgencyColor}`, borderRadius: 4, padding: '1px 6px' }}>
                    {order.urgency}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{order.materialDescription}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: statusColor }}>{order.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 6, background: 'var(--shell-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: statusColor, borderRadius: 3, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', whiteSpace: 'nowrap' }}>
                    {order.stagedQuantity}/{order.requiredQuantity} {order.uom}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{order.processOrderId}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{order.lineOrResource}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Start: {formatTime(order.plannedStart)}</span>
                  {order.blockerReason && (
                    <span style={{ fontSize: 11, color: '#D32F2F' }}>{order.blockerReason}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
