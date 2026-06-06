import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { BatchHeaderSummary } from '@connectio/data-contracts'
import { useBatchHeaderSummary } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { QueriedAtLabel } from '../components/QueriedAtLabel.js'

/** Static registration record for the Batch Header panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'batch-header',
  displayName: 'Batch Header',
  description: 'Core identity for the investigated batch: material, plant, stock and release status.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'traceability-workspace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.99, hidden: false },
  drillThrough: { label: 'Open in Trace2', targetWorkspaceId: 'traceability-workspace', targetViewId: 'trace', contextScopes: ['batch'] },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for BatchHeaderPanel. */
export interface BatchHeaderPanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel displaying core batch identity metadata.
 *
 * @remarks
 * Data is fetched via the Trace2 source adapter using TanStack Query.
 * The panel transitions from `loading` to `ready` when query data arrives,
 * or to `error` when the adapter returns a failure result.
 */
export function BatchHeaderPanel({ request }: BatchHeaderPanelProps) {
  const { data: result, isLoading } = useBatchHeaderSummary(request)
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

  const data: BatchHeaderSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <BatchHeaderField label="Material" value={`${data.materialId} — ${data.materialDescription}`} />
            <BatchHeaderField label="Batch" value={data.batchId} />
            <BatchHeaderField label="Plant" value={`${data.plantId} ${data.plantName}`} />
            {data.processOrderId && <BatchHeaderField label="Process Order" value={data.processOrderId} />}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            <BatchHeaderStatusField label="Stock Status" value={data.stockStatus} />
            <BatchHeaderStatusField label="Quality Status" value={data.qualityStatus} />
            <BatchHeaderStatusField label="Release Status" value={data.releaseStatus} highlight={data.releaseStatus === 'blocked' || data.releaseStatus === 'not-released'} />
          </div>
          {data.qualityStatus === 'unknown' && (
            <div style={{ fontSize: 11, color: 'var(--amber, #C07000)', marginTop: 4 }}>
              Quality decision source not yet verified — unknown must not be interpreted as accepted or rejected.
            </div>
          )}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {data.quantity != null && (
              <BatchHeaderField label="Total Stock" value={`${data.quantity.toLocaleString()} ${data.uom ?? ''}`} />
            )}
            {data.manufactureDate && (
              <BatchHeaderField label="Manufactured" value={new Date(data.manufactureDate).toLocaleDateString()} />
            )}
            {data.expiryDate && (
              <BatchHeaderField label="Expiry" value={new Date(data.expiryDate).toLocaleDateString()} />
            )}
          </div>
          {(data.unrestricted != null || data.blocked != null || data.qualityInspection != null || data.restricted != null || data.transit != null) && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              {data.unrestricted != null && (
                <BatchHeaderField label="Unrestricted" value={`${data.unrestricted.toLocaleString()} ${data.uom ?? ''}`} />
              )}
              {data.qualityInspection != null && (
                <BatchHeaderStockField label="QI Hold" value={`${data.qualityInspection.toLocaleString()} ${data.uom ?? ''}`} highlight={data.qualityInspection > 0} />
              )}
              {data.blocked != null && (
                <BatchHeaderStockField label="Blocked" value={`${data.blocked.toLocaleString()} ${data.uom ?? ''}`} highlight={data.blocked > 0} />
              )}
              {data.restricted != null && (
                <BatchHeaderField label="Restricted" value={`${data.restricted.toLocaleString()} ${data.uom ?? ''}`} />
              )}
              {data.transit != null && (
                <BatchHeaderField label="In Transit" value={`${data.transit.toLocaleString()} ${data.uom ?? ''}`} />
              )}
            </div>
          )}
          <QueriedAtLabel fetchedAt={lastRefreshedAt} style={{ marginTop: 4 }} />
        </div>
      )}
    </EvidencePanel>
  )
}

/** Single labelled field within the batch header. */
function BatchHeaderField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'var(--shell-fg)', fontWeight: 500 }}>{value}</div>
    </div>
  )
}

/** Stock quantity field with optional amber highlight when the quantity is non-zero. */
function BatchHeaderStockField({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: highlight ? 'var(--amber, #C07000)' : 'var(--shell-fg)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

/** Status field with optional highlight for blocked/not-released states. */
function BatchHeaderStatusField({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)',
          textTransform: 'capitalize',
        }}
      >
        {value.replace(/-/g, ' ')}
      </div>
    </div>
  )
}
