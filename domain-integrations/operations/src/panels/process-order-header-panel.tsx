import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProcessOrderHeader } from '@connectio/data-contracts'
import { useProcessOrderHeader } from '../adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from '../adapters/process-order-review-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'process-order-header',
  displayName: 'Process Order',
  description:
    'Process order header — material, batch, quantities, planned and actual dates, and order status.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['process-order-review'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [
    { permissionId: 'operations.order.read', displayName: 'Operations Order Read' },
  ],
}

export interface ProcessOrderHeaderPanelProps {
  readonly request: ProcessOrderReviewAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  'in-process': '#005776',
  released: '#388E3C',
  confirmed: '#388E3C',
  'partially-confirmed': '#D97706',
  created: 'var(--shell-fg-3)',
  closed: 'var(--shell-fg-3)',
  cancelled: '#D32F2F',
}

export function ProcessOrderHeaderPanel({ request }: ProcessOrderHeaderPanelProps) {
  const { data: result, isLoading } = useProcessOrderHeader(request)
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

  const data: ProcessOrderHeader | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 10 }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--shell-fg)' }}>
                {data.processOrderId}
              </div>
              <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 1 }}>
                {data.materialDescription}
              </div>
              <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', fontFamily: 'monospace' }}>
                {data.materialId}
              </div>
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: STATUS_COLOR[data.orderStatus] ?? 'var(--shell-fg)',
                border: `1px solid ${STATUS_COLOR[data.orderStatus] ?? 'var(--shell-line)'}`,
                padding: '2px 6px',
                borderRadius: 3,
              }}
            >
              {data.orderStatus ? data.orderStatus.replace(/-/g, ' ') : 'UNKNOWN'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <StatRow
              label="Planned Qty"
              value={
                data.plannedQuantity != null
                  ? `${data.plannedQuantity.toLocaleString()} ${data.uom ?? ''}`.trim()
                  : '—'
              }
            />
            <StatRow
              label="Confirmed Qty"
              value={
                data.confirmedQuantity != null
                  ? `${data.confirmedQuantity.toLocaleString()} ${data.uom ?? ''}`.trim()
                  : '—'
              }
            />
            <StatRow
              label="Planned Start"
              value={data.plannedStart ? new Date(data.plannedStart).toLocaleString() : '-'}
            />
            <StatRow
              label="Planned Finish"
              value={data.plannedFinish ? new Date(data.plannedFinish).toLocaleString() : '-'}
            />
            {data.actualStart && (
              <StatRow label="Actual Start" value={new Date(data.actualStart).toLocaleString()} />
            )}
            {data.batchId && <StatRow label="Batch" value={data.batchId} mono />}
            <StatRow label="Plant" value={data.plantId} />
            {request.lineId && <StatRow label="Line" value={request.lineId} mono />}
            <StatRow
              label="Order Type"
              value={data.orderType ? data.orderType.replace(/-/g, ' ') : 'UNKNOWN'}
            />
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function StatRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--shell-fg-3)',
          marginBottom: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--shell-fg)',
          fontFamily: mono ? 'monospace' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}
