import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProcessOrderGoodsMovement } from '@connectio/data-contracts'
import { useOrderGoodsMovements } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'process-order-goods-movements',
  displayName: 'Goods Movements',
  description:
    'Goods issues (inputs) and goods receipts (outputs) posted against this process order.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 120,
    errorAfterSeconds: 600,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [
    { permissionId: 'operations.order.read', displayName: 'Operations Order Read' },
  ],
}

export interface ProcessOrderGoodsMovementsPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const DIRECTION_COLOR: Record<string, string> = {
  input: '#7B61FF',
  output: '#388E3C',
  unknown: '#888',
}

const DIRECTION_LABEL: Record<string, string> = {
  input: 'GI',
  output: 'GR',
  unknown: '?',
}

export function ProcessOrderGoodsMovementsPanel({ request }: ProcessOrderGoodsMovementsPanelProps) {
  const { data: result, isLoading } = useOrderGoodsMovements(request)
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

  const movements: ProcessOrderGoodsMovement[] = result?.ok ? result.data : []
  const inputCount = movements.filter((m) => m.direction === 'input').length
  const outputCount = movements.filter((m) => m.direction === 'output').length
  const unknownCount = movements.filter((m) => m.direction === 'unknown').length

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {movements.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>
              No goods movements posted against this order.
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 10, color: '#7B61FF', fontWeight: 600 }}>
                  {inputCount} issue{inputCount !== 1 ? 's' : ''} (input)
                </span>
                <span style={{ fontSize: 10, color: '#388E3C', fontWeight: 600 }}>
                  {outputCount} receipt{outputCount !== 1 ? 's' : ''} (output)
                </span>
                {unknownCount > 0 && (
                  <span style={{ fontSize: 10, color: '#888', fontWeight: 600 }}>
                    {unknownCount} unclassified
                  </span>
                )}
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {movements.map((mov) => {
                  const color = DIRECTION_COLOR[mov.direction] ?? 'var(--shell-fg-3)'
                  return (
                    <div
                      key={mov.movementId}
                      style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
                    >
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#fff',
                          background: color,
                          borderRadius: 3,
                          padding: '2px 5px',
                          flexShrink: 0,
                          marginTop: 1,
                          minWidth: 20,
                          textAlign: 'center',
                        }}
                      >
                        {DIRECTION_LABEL[mov.direction]}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg)' }}>
                          {mov.materialDescription}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--shell-fg-2)', marginTop: 1 }}>
                          {mov.quantity != null
                            ? `${mov.quantity.toLocaleString()} ${mov.uom ?? ''}`.trim()
                            : '—'}
                          {mov.batchId && (
                            <span style={{ fontFamily: 'monospace', marginLeft: 4 }}>
                              {mov.batchId}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 1 }}>
                          {mov.postedAt ? new Date(mov.postedAt).toLocaleString() : '-'}
                          {mov.storageLocation && ` · ${mov.storageLocation}`}
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
