import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { LateOrder } from '@connectio/data-contracts'
import { useLateOrders } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'late-orders',
  displayName: 'Late Orders',
  description: 'Process orders late or predicted late for the current plan date.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.88, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface LateOrdersPanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#9E9E9E',
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

function formatDelay(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function worstSeverity(orders: LateOrder[]): string {
  return orders.reduce((best, o) => (SEVERITY_RANK[o.severity] ?? 0) > (SEVERITY_RANK[best] ?? 0) ? o.severity : best, 'low')
}

function LateOrderRow({ order }: { order: LateOrder }) {
  const color = SEVERITY_COLOR[order.severity] ?? '#9E9E9E'
  return (
    <div style={{ borderLeft: `3px solid ${color}`, paddingLeft: 10, paddingTop: 8, paddingBottom: 8, display: 'grid', gap: 3 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{order.processOrderId}</span>
        <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{order.materialDescription}</span>
        <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--shell-surface-2)', color: 'var(--shell-fg-2)', borderRadius: 4, padding: '1px 6px' }}>
          {order.lineOrResource}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color, marginLeft: 'auto' }}>
          +{formatDelay(order.delayMinutes)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
        {formatTime(order.plannedFinish)}
        {order.estimatedFinish && (
          <> &rarr; <span style={{ color: SEVERITY_COLOR[order.severity] ?? 'var(--shell-fg-3)' }}>{formatTime(order.estimatedFinish)}</span></>
        )}
      </div>
      <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>{order.delayReason}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{order.owner}</div>
    </div>
  )
}

export function LateOrdersPanel({ request }: LateOrdersPanelProps) {
  const { data: result, isLoading } = useLateOrders(request)
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

  const data: LateOrder[] | null = result?.ok ? result.data : null

  const sorted = data
    ? [...data].sort((a, b) => {
        const sr = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
        return sr !== 0 ? sr : b.delayMinutes - a.delayMinutes
      })
    : null

  const worst = sorted && sorted.length > 0 ? worstSeverity(sorted) : 'low'
  const summaryColor = SEVERITY_COLOR[worst] ?? 'var(--shell-fg)'

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {sorted && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: summaryColor }}>
            {sorted.length} late {sorted.length === 1 ? 'order' : 'orders'}
          </div>
          <div style={{ display: 'grid', gap: 8, borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            {sorted.map(order => (
              <LateOrderRow key={order.processOrderId} order={order} />
            ))}
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
