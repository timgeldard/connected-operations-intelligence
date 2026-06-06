import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ExecutionTimelineItem } from '@connectio/data-contracts'
import { useExecutionTimeline } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'execution-timeline',
  displayName: 'Execution Timeline',
  description: 'Ordered sequence of production events — operations, confirmations, goods movements, deviations, and quality events.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

export interface ExecutionTimelinePanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const EVENT_COLOR: Record<string, string> = {
  'order-released': '#388E3C',
  'operation-started': '#005776',
  'operation-confirmed': '#388E3C',
  'goods-issued': '#7B61FF',
  'deviation-raised': '#D32F2F',
  'quality-inspection': '#D97706',
  'staging-completed': '#388E3C',
  'order-confirmed': '#388E3C',
  'order-closed': 'var(--shell-fg-3)',
  'alert': '#D32F2F',
}

const EVENT_ICON: Record<string, string> = {
  'order-released': '◉',
  'operation-started': '▷',
  'operation-confirmed': '✓',
  'goods-issued': '📦',
  'deviation-raised': '⚠',
  'quality-inspection': '🔬',
  'staging-completed': '✓',
  'order-confirmed': '✓',
  'order-closed': '⊗',
  'alert': '!',
}

export function ExecutionTimelinePanel({ request }: ExecutionTimelinePanelProps) {
  const { data: result, isLoading } = useExecutionTimeline(request)
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

  const items: ExecutionTimelineItem[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>No events recorded for this order.</p>
          ) : (
            <div style={{ display: 'grid', gap: 0 }}>
              {[...items].reverse().map((item, idx) => {
                const color = EVENT_COLOR[item.eventType] ?? 'var(--shell-fg-3)'
                return (
                  <div key={item.eventId} style={{ display: 'flex', gap: 10, paddingBottom: idx < items.length - 1 ? 10 : 0 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                        {EVENT_ICON[item.eventType] ?? '•'}
                      </div>
                      {idx < items.length - 1 && <div style={{ width: 2, flex: 1, background: 'var(--shell-line)', minHeight: 8, marginTop: 2 }} />}
                    </div>
                    <div style={{ paddingBottom: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg)' }}>{item.title}</div>
                      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginBottom: 2 }}>
                        {new Date(item.timestamp).toLocaleString()}
                        {item.actor && ` · ${item.actor}`}
                        {' · '}{item.sourceSystem}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--shell-fg-2)' }}>{item.description}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
