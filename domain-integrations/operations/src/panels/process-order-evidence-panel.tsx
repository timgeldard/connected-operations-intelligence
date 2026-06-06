import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProcessOrderReleaseEvidence } from '@connectio/data-contracts'
import { useProcessOrderEvidence } from '../adapters/operations-evidence-queries.js'
import type { OperationsEvidenceAdapterRequest } from '../adapters/operations-evidence-adapter.js'

/** Static registration record for the Process Order Evidence panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'process-order-evidence',
  displayName: 'Process Order Evidence',
  description: 'Manufacturing process order conformance data: yield, status, deviations, and NCRs.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'processorderhistory' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: false }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  drillThrough: { label: 'Open in POH', targetWorkspaceId: 'operations-workspace', targetViewId: 'process-orders', contextScopes: ['process-order'] },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for ProcessOrderEvidencePanel. */
export interface ProcessOrderEvidencePanelProps {
  /** Adapter request context providing batchId and processOrderId. */
  readonly request: OperationsEvidenceAdapterRequest
}

/**
 * Evidence panel displaying manufacturing process order conformance for a batch release decision.
 *
 * @remarks
 * Owned by the operations domain; consumed exclusively by the quality-batch-release workspace.
 */
export function ProcessOrderEvidencePanel({ request }: ProcessOrderEvidencePanelProps) {
  const { data: result, isLoading } = useProcessOrderEvidence(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const data: ProcessOrderReleaseEvidence | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <OpsField label="Process Order" value={data.processOrderId} />
            <OpsField label="Status" value={data.orderStatus.replace(/-/g, ' ')} />
            <ConformanceBadge status={data.conformanceStatus} />
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            <OpsField label="Planned Qty" value={`${data.plannedQuantity.toLocaleString()} ${data.uom}`} />
            <OpsField label="Confirmed Qty" value={`${data.confirmedQuantity.toLocaleString()} ${data.uom}`} />
            <OpsMetric label="Yield" value={`${data.yieldPercent.toFixed(1)}%`} highlight={data.yieldPercent < 90} />
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            <OpsMetric label="Open NCRs" value={String(data.openNCRCount)} highlight={data.openNCRCount > 0} />
            <OpsMetric label="Critical Deviations" value={String(data.criticalDeviationCount)} highlight={data.criticalDeviationCount > 0} />
            {data.workCentreId && <OpsField label="Work Centre" value={data.workCentreId} />}
            {data.lineId && <OpsField label="Line" value={data.lineId} />}
          </div>

          {(data.actualStart || data.actualEnd) && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              {data.actualStart && (
                <OpsField label="Start" value={new Date(data.actualStart).toLocaleString()} />
              )}
              {data.actualEnd && (
                <OpsField label="End" value={new Date(data.actualEnd).toLocaleString()} />
              )}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function OpsField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--shell-fg)', fontWeight: 500, textTransform: 'capitalize' }}>{value}</div>
    </div>
  )
}

function OpsMetric({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}

const CONFORMANCE_COLOUR: Record<string, string> = {
  conformant: '#4CAF50',
  'non-conformant': '#D32F2F',
  'pending-review': '#FF9800',
  waived: '#9E9E9E',
}

function ConformanceBadge({ status }: { status: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        Conformance
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: CONFORMANCE_COLOUR[status] ?? 'var(--shell-fg)', textTransform: 'capitalize' }}>
        {status.replace(/-/g, ' ')}
      </div>
    </div>
  )
}
