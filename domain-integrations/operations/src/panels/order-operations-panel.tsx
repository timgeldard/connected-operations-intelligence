import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProcessOrderOperation } from '@connectio/data-contracts'
import { useOrderOperations } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'order-operations',
  displayName: 'Operations',
  description: 'Process order operations (phases) with planned/actual durations, status, and exception flags.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

export interface OrderOperationsPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  'confirmed': '#388E3C',
  'in-progress': '#005776',
  'pending': 'var(--shell-fg-3)',
  'skipped': 'var(--shell-fg-3)',
}

const STATUS_ICON: Record<string, string> = {
  'confirmed': '✓',
  'in-progress': '▷',
  'pending': '○',
  'skipped': '⊗',
}

export function OrderOperationsPanel({ request }: OrderOperationsPanelProps) {
  const { data: result, isLoading } = useOrderOperations(request)
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

  const ops: ProcessOrderOperation[] = result?.ok ? result.data : []
  const confirmedCount = ops.filter(o => o.confirmed).length

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {ops.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>No operations recorded for this order.</p>
          ) : (
            <>
              <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginBottom: 10 }}>
                {confirmedCount} of {ops.length} confirmed
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {ops.map(op => {
                  const color = STATUS_COLOR[op.status] ?? 'var(--shell-fg-3)'
                  return (
                    <div key={op.operationId} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: color, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 1,
                      }}>
                        {STATUS_ICON[op.status] ?? '?'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg)' }}>
                            {op.operationNumber} {op.operationText}
                          </span>
                          {op.hasException && (
                            <span style={{ fontSize: 9, color: '#D32F2F', fontWeight: 700, flexShrink: 0 }}>⚠ exception</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 1 }}>
                          {op.workCentre}
                          {op.actualDurationMinutes != null
                            ? ` · ${op.actualDurationMinutes} min actual (${op.plannedDurationMinutes} min planned)`
                            : ` · ${op.plannedDurationMinutes} min planned`}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
