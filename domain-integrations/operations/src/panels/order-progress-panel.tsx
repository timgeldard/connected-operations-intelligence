import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { OrderProgressSummary } from '@connectio/data-contracts'
import { useOrderProgressSummary } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'order-progress',
  displayName: 'Order Progress',
  description: 'Process order execution progress — operations complete, confirmations, current operation, delay, and risk level.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.order.read', displayName: 'Operations Order Read' }],
}

export interface OrderProgressPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const RISK_COLOR: Record<string, string> = {
  'on-track': '#388E3C',
  'at-risk': '#D97706',
  'delayed': 'var(--sunset, #F24A00)',
  'blocked': '#D32F2F',
}

export function OrderProgressPanel({ request }: OrderProgressPanelProps) {
  const { data: result, isLoading } = useOrderProgressSummary(request)
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

  const data: OrderProgressSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: RISK_COLOR[data.riskLevel] ?? 'var(--shell-fg)' }}>
              {Math.round(data.progressPercent)}%
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: RISK_COLOR[data.riskLevel] ?? 'var(--shell-fg)',
              border: `1px solid ${RISK_COLOR[data.riskLevel] ?? 'var(--shell-line)'}`,
              padding: '2px 8px', borderRadius: 3,
            }}>
              {data.riskLevel.replace(/-/g, ' ')}
            </span>
          </div>

          <ProgressBar value={data.progressPercent} color={RISK_COLOR[data.riskLevel] ?? '#005776'} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Stat label="Ops Complete" value={`${data.operationsComplete} / ${data.operationsTotal}`} />
            <Stat label="Confirmations" value={`${data.confirmationsComplete} done, ${data.openConfirmations} open`} />
            {data.delayMinutes > 0 && <Stat label="Delay" value={`${data.delayMinutes} min`} highlight />}
            <Stat label="Confidence" value={`${Math.round(data.confidence * 100)}%`} />
          </div>

          {data.currentOperation && (
            <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              Current: <strong style={{ color: 'var(--shell-fg)' }}>{data.currentOperation}</strong>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 6, background: 'var(--shell-surface-2)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: 3, transition: 'width 0.3s ease' }} />
    </div>
  )
}

function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>{value}</div>
    </div>
  )
}
