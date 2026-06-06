import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SPCRelatedBatch } from '@connectio/data-contracts'
import { useSPCRelatedBatches } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'spc-related-batches',
  displayName: 'Related Batches',
  description: 'Batches associated with active SPC signals — release status, signal count, and release impact.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: false }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface SPCRelatedBatchesPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

const IMPACT_COLOR: Record<string, string> = {
  blocking: '#D32F2F',
  risk: '#D97706',
  none: '#388E3C',
}

const STATUS_COLOR: Record<string, string> = {
  'under-review': '#D97706',
  'awaiting-review': 'var(--shell-fg-2)',
  'released': '#388E3C',
  'on-hold': '#D32F2F',
  'rejected': '#D32F2F',
}

export function SPCRelatedBatchesPanel({ request }: SPCRelatedBatchesPanelProps) {
  const { data: result, isLoading } = useSPCRelatedBatches(request)
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

  const batches: SPCRelatedBatch[] = result?.ok ? result.data : []

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
                    borderLeft: `3px solid ${IMPACT_COLOR[batch.releaseImpact] ?? 'var(--shell-line)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{batch.batchId}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: IMPACT_COLOR[batch.releaseImpact], textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {batch.releaseImpact}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 2 }}>{batch.materialId}</div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: STATUS_COLOR[batch.status] ?? 'var(--shell-fg-3)', fontWeight: 600, textTransform: 'uppercase' }}>{batch.status}</span>
                    <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{batch.relatedSignalCount} signal{batch.relatedSignalCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--shell-fg-3)' }}>
            Click a batch in Batch Release workspace for full release evidence.
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
