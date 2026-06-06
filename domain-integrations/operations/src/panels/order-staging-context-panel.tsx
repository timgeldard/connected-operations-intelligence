import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { OrderStagingContext } from '@connectio/data-contracts'
import { useOrderStagingContext } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'order-staging-context',
  displayName: 'Staging Context',
  description: 'Component staging readiness for this process order — staged vs required, missing components, open transfer requirements.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'wms', legacyAppId: 'warehouse360' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

export interface OrderStagingContextPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const STAGING_COLOR: Record<string, string> = {
  'fully-staged': '#388E3C',
  'partial': '#D97706',
  'blocked': '#D32F2F',
  'not-started': 'var(--shell-fg-3)',
  'not-required': 'var(--shell-fg-3)',
}

export function OrderStagingContextPanel({ request }: OrderStagingContextPanelProps) {
  const { data: result, isLoading } = useOrderStagingContext(request)
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

  const data: OrderStagingContext | null = result?.ok ? result.data : null

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
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>Staging Status</span>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: STAGING_COLOR[data.stagingStatus] ?? 'var(--shell-fg)',
              border: `1px solid ${STAGING_COLOR[data.stagingStatus] ?? 'var(--shell-line)'}`,
              padding: '2px 6px', borderRadius: 3,
            }}>
              {data.stagingStatus.replace(/-/g, ' ')}
            </span>
          </div>

          <StagingBar staged={data.componentsStaged} required={data.componentsRequired} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatRow label="Components Required" value={String(data.componentsRequired)} />
            <StatRow label="Staged" value={String(data.componentsStaged)} />
            <StatRow label="Missing" value={String(data.missingComponents)} highlight={data.missingComponents > 0} />
            <StatRow label="Blocked" value={String(data.blockedComponents)} highlight={data.blockedComponents > 0} />
            <StatRow label="Open Transfer Reqs" value={String(data.openTransferRequirements)} highlight={data.openTransferRequirements > 0} />
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function StagingBar({ staged, required }: { staged: number; required: number }) {
  const pct = required > 0 ? (staged / required) * 100 : 0
  const color = pct >= 100 ? '#388E3C' : pct >= 60 ? '#D97706' : '#D32F2F'
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>Components staged</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{staged} / {required}</span>
      </div>
      <div style={{ height: 6, background: 'var(--shell-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  )
}

function StatRow({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: highlight ? 700 : 400, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}
