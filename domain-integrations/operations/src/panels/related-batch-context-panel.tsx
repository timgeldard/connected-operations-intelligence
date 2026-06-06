import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { RelatedBatchContext } from '@connectio/data-contracts'
import { useRelatedBatchContext } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'related-batch-context',
  displayName: 'Related Batches',
  description: 'Input components, output batch, and co-products related to this process order — trace risk, quality status, and stock status.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

export interface RelatedBatchContextPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const RISK_COLOR: Record<string, string> = {
  'none': '#388E3C',
  'potential': '#D97706',
  'confirmed': '#D32F2F',
}

const STATUS_COLOR: Record<string, string> = {
  'released': '#388E3C',
  'under-review': '#D97706',
  'awaiting-review': 'var(--shell-fg-2)',
  'on-hold': '#D32F2F',
  'rejected': '#D32F2F',
}

const RELATIONSHIP_LABEL: Record<string, string> = {
  'output': 'Output',
  'input-component': 'Input',
  'co-product': 'Co-Product',
  'by-product': 'By-Product',
  'rework': 'Rework',
}

export function RelatedBatchContextPanel({ request }: RelatedBatchContextPanelProps) {
  const { data: result, isLoading } = useRelatedBatchContext(request)
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

  const batches: RelatedBatchContext[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {batches.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>No related batches found.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {batches.map(batch => (
                <div
                  key={batch.batchId}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--shell-surface-2)',
                    borderRadius: 4,
                    borderLeft: `3px solid ${RISK_COLOR[batch.traceRisk] ?? 'var(--shell-line)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)', fontFamily: 'monospace' }}>{batch.batchId}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--shell-fg-3)', textTransform: 'uppercase', background: 'var(--shell-surface)', padding: '1px 5px', borderRadius: 2 }}>
                      {RELATIONSHIP_LABEL[batch.relationshipType] ?? batch.relationshipType}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-3)', marginTop: 1, fontFamily: 'monospace' }}>{batch.materialId}</div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: STATUS_COLOR[batch.qualityStatus] ?? 'var(--shell-fg-3)', fontWeight: 600, textTransform: 'uppercase' }}>{batch.qualityStatus}</span>
                    <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase' }}>{batch.stockStatus}</span>
                    {batch.traceRisk !== 'none' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: RISK_COLOR[batch.traceRisk], textTransform: 'uppercase' }}>Trace {batch.traceRisk}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
