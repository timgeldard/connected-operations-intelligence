import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { OrderQualityContext } from '@connectio/data-contracts'
import { useOrderQualityContext } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'order-quality-context',
  displayName: 'Quality Context',
  description: 'Quality status for this process order — inspection lot, usage decision, deviations, SPC signals, and release blockers.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'sap-qm', legacyAppId: 'qm' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

export interface OrderQualityContextPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const QA_STATUS_COLOR: Record<string, string> = {
  'passed': '#388E3C',
  'conditionally-released': '#D97706',
  'in-inspection': '#005776',
  'failed': '#D32F2F',
  'on-hold': '#D32F2F',
  'not-inspected': 'var(--shell-fg-3)',
}

export function OrderQualityContextPanel({ request }: OrderQualityContextPanelProps) {
  const { data: result, isLoading } = useOrderQualityContext(request)
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

  const data: OrderQualityContext | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Quality Status</span>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: QA_STATUS_COLOR[data.qualityStatus] ?? 'var(--shell-fg)',
              border: `1px solid ${QA_STATUS_COLOR[data.qualityStatus] ?? 'var(--shell-line)'}`,
              padding: '2px 6px', borderRadius: 3,
            }}>
              {data.qualityStatus.replace(/-/g, ' ')}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {data.inspectionLotId && <InfoRow label="Inspection Lot" value={data.inspectionLotId} />}
            {data.releaseCaseId && <InfoRow label="Release Case" value={data.releaseCaseId} />}
            <InfoRow label="Failed Chars" value={String(data.failedCharacteristics)} highlight={data.failedCharacteristics > 0} />
            <InfoRow label="Open Deviations" value={String(data.openDeviations)} highlight={data.openDeviations > 0} />
            <InfoRow label="SPC Signals" value={String(data.spcSignals)} highlight={data.spcSignals > 0} />
          </div>

          {data.releaseBlockers.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#D32F2F', marginBottom: 6 }}>Release Blockers</div>
              <div style={{ display: 'grid', gap: 4 }}>
                {data.releaseBlockers.map((blocker, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'var(--shell-fg-2)', padding: '4px 8px', background: 'var(--shell-surface-2)', borderLeft: '3px solid #D32F2F', borderRadius: 2 }}>
                    {blocker}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function InfoRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}
