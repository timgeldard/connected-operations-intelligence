import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ProductionHistoryRow, ProductionHistorySummary } from '@connectio/data-contracts'
import { useProductionHistory } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration for the production history panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'production-history',
  displayName: 'Production History',
  description: 'Recent production batches for the same material — supports isolated-vs-systemic assessment.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'materialId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.92, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for ProductionHistoryPanel. */
export interface ProductionHistoryPanelProps {
  /** Adapter request context — must include materialId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel showing recent production batches for the investigation's material.
 *
 * Sourced from gold_batch_production_history_v (live Databricks slice). Quality status
 * is shown raw: Pass / Fail / Unknown. The panel intentionally does not assign business
 * meaning to "Fail" (no release decision implied).
 */
export function ProductionHistoryPanel({ request }: ProductionHistoryPanelProps) {
  const { data: result, isLoading } = useProductionHistory(request)
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

  const data: ProductionHistorySummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            <PHStat label="Batches" value={data.totalBatches} />
            <PHStat label="Pass" value={data.passCount} color="#059669" />
            <PHStat label="Fail" value={data.failCount} color={data.failCount > 0 ? '#DC2626' : undefined} />
            <PHStat label="Unknown" value={data.unknownCount} color="#6B7280" />
          </div>
          {data.totalBatches === 0 && (
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--shell-surface)',
                border: '1px solid var(--shell-line)',
                borderRadius: 4,
                fontSize: 12,
                color: 'var(--shell-fg-3)',
              }}
              role="status"
            >
              No recent production batches found for this material. The material may not be manufactured on-site (raw-input materials and purchased finished goods do not appear in production history).
            </div>
          )}
          {data.rows.length > 0 && <HistoryTable rows={data.rows} />}
          <div
            style={{
              padding: '6px 10px',
              background: 'var(--shell-surface)',
              border: '1px dashed var(--shell-line)',
              borderRadius: 4,
              fontSize: 11,
              color: 'var(--shell-fg-3)',
            }}
          >
            Quality status is the gold view's Pass/Fail label. A &quot;Fail&quot; row does not imply a release decision was made — full QM usage-decision evidence requires the QM source (TRACE-P1-012).
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function HistoryTable({ rows }: { rows: readonly ProductionHistoryRow[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            {['Date', 'Batch', 'Plant', 'Process Order', 'Quantity', 'Quality'].map(h => (
              <th
                key={h}
                style={{
                  padding: '4px 6px',
                  textAlign: 'left',
                  fontSize: 9,
                  fontWeight: 600,
                  color: '#9CA3AF',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid var(--shell-line)',
                  whiteSpace: 'nowrap',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={`${r.batchId}-${r.processOrderId ?? ''}`} style={{ borderBottom: '1px solid var(--shell-line)' }}>
              <td style={{ padding: '4px 6px', color: '#374151', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {r.postingDate ?? '—'}
              </td>
              <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: 'var(--shell-fg)' }}>{r.batchId}</td>
              <td style={{ padding: '4px 6px', color: '#374151' }}>{r.plantId ?? '—'}</td>
              <td style={{ padding: '4px 6px', color: '#6B7280', fontFamily: 'monospace', fontSize: 10 }}>
                {r.processOrderId ?? '—'}
              </td>
              <td style={{ padding: '4px 6px', color: 'var(--shell-fg)', whiteSpace: 'nowrap' }}>
                {r.quantity.toLocaleString()} {r.uom ?? ''}
              </td>
              <td style={{ padding: '4px 6px' }}>
                <QualityPill status={r.qualityStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function QualityPill({ status }: { status: ProductionHistoryRow['qualityStatus'] }) {
  const color =
    status === 'pass' ? '#059669' :
    status === 'fail' ? '#DC2626' :
    '#6B7280'
  const label =
    status === 'pass' ? 'Pass' :
    status === 'fail' ? 'Fail' :
    'Unknown'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 6px',
      fontSize: 10,
      fontWeight: 600,
      borderRadius: 3,
      color,
      border: `1px solid ${color}`,
    }}>
      {label}
    </span>
  )
}

function PHStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--shell-fg)' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
    </div>
  )
}
