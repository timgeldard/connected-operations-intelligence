import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { MassBalanceSummary, MassBalanceMovement } from '@connectio/data-contracts'
import { BatchHeaderPanel } from '../panels/batch-header-panel.js'
import { TraceGraphPanel } from '../panels/trace-graph-panel.js'
import { RiskSignalsPanel } from '../panels/risk-signals-panel.js'
import { useMassBalanceSummary } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { QueriedAtLabel } from '../components/QueriedAtLabel.js'

/** Static registration for the inline mass balance panel. */
const massBalanceRegistration: EvidencePanelRegistration = {
  panelId: 'mass-balance',
  displayName: 'Mass Balance',
  description: 'Input vs output quantity comparison with variance and unresolved movement count.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.94, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Props for MassBalanceView. */
export interface MassBalanceViewProps {
  /** Adapter request context forwarded to all panels. */
  readonly request: Trace2AdapterRequest
}

/**
 * Mass Balance view for the Trace Investigation workspace.
 *
 * @remarks
 * Renders the inline mass balance panel (defined here as it is unique to
 * this view) along with batch header, trace graph, and risk signals.
 */
export function MassBalanceView({ request }: MassBalanceViewProps) {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <BatchHeaderPanel request={request} />
        <MassBalancePanel request={request} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        <TraceGraphPanel request={request} />
        <RiskSignalsPanel request={request} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline MassBalancePanel (used only in this view)
// ---------------------------------------------------------------------------

/** Props for the inline MassBalancePanel. */
interface MassBalancePanelProps {
  readonly request: Trace2AdapterRequest
}

/**
 * Inline evidence panel for mass balance data.
 *
 * @remarks
 * The panel is defined here rather than in the shared panels directory
 * because mass balance is only shown in this view. It follows the same
 * EvidencePanel + useEvidencePanel pattern as all other panels.
 */
function MassBalancePanel({ request }: MassBalancePanelProps) {
  const { data: result, isLoading } = useMassBalanceSummary(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: massBalanceRegistration.panelId,
    staleAfterSeconds: massBalanceRegistration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) markReady()
    else if (result && !result.ok) markError()
  }, [isLoading, result, markReady, markError])

  const data: MassBalanceSummary | null = result?.ok ? result.data : null
  const varianceHigh = data ? Math.abs(data.variancePercent) > 5 : false

  return (
    <EvidencePanel
      registration={massBalanceRegistration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <MBStat label="Input" value={`${data.inputQuantity.toLocaleString()} ${data.uom}`} />
            <MBStat label="Output" value={`${data.outputQuantity.toLocaleString()} ${data.uom}`} />
            <MBStat
              label="Variance"
              value={`${data.variancePercent.toFixed(1)}%`}
              highlight={varianceHigh}
            />
            <MBStat label="Confidence" value={`${Math.round(data.confidence * 100)}%`} />
          </div>
          {data.unresolvedMovements > 0 && (
            <div
              style={{
                padding: '6px 10px',
                background: '#FFFBEB',
                border: '1px solid #D97706',
                borderRadius: 4,
                fontSize: 12,
                color: '#92400E',
                fontWeight: 600,
              }}
              role="status"
            >
              {data.unresolvedMovements} unresolved movement(s) — balance may be incomplete
            </div>
          )}
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
            Movement category mapping is incomplete. Live data includes SAP categories (STO Receipt, STO Transfer, Write-Off, Other (NNN)) that are not yet directionally classified — these are counted as unresolved. Do not treat the variance figure as a verified mass-balance result.
          </div>
          {data.movements && data.movements.length > 0 && (
            <MovementsTable movements={data.movements} />
          )}
          <QueriedAtLabel fetchedAt={lastRefreshedAt} style={{ marginTop: 4 }} />
        </div>
      )}
    </EvidencePanel>
  )
}

// ---------------------------------------------------------------------------
// Movements table
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  production: '#2563EB',
  shipment: '#D97706',
  consumption: '#7C3AED',
  adjustment: '#6B7280',
}

function MovementsTable({ movements }: { movements: readonly MassBalanceMovement[] }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        Movements ({movements.length})
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {['Date', 'Category', 'Delta', 'Balance', 'Reference'].map(h => (
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
            {movements.map((m, i) => {
              const catColor = CATEGORY_COLORS[m.category] ?? '#6B7280'
              const deltaPositive = m.delta >= 0
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--shell-line)' }}>
                  <td style={{ padding: '4px 6px', color: '#374151', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {m.date}
                  </td>
                  <td style={{ padding: '4px 6px' }}>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      color: catColor,
                      letterSpacing: '0.04em',
                    }}>
                      {m.category}
                    </span>
                  </td>
                  <td style={{ padding: '4px 6px', fontWeight: 600, color: deltaPositive ? '#059669' : '#DC2626', whiteSpace: 'nowrap' }}>
                    {deltaPositive ? '+' : ''}{m.delta.toLocaleString()} {m.uom}
                  </td>
                  <td style={{ padding: '4px 6px', color: '#374151', whiteSpace: 'nowrap' }}>
                    {m.runningBalance.toLocaleString()} {m.uom}
                  </td>
                  <td style={{ padding: '4px 6px', color: '#6B7280', fontFamily: 'monospace', fontSize: 10 }}>
                    {m.reference ?? '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Single labelled stat in the mass balance grid. */
function MBStat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', background: 'var(--shell-surface)', borderRadius: 4, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}
