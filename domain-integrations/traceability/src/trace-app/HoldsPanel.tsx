import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { HoldEntry, HoldsLedger } from '@connectio/data-contracts'
import { useHoldsReleases } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'holds-releases',
  displayName: 'Holds & Releases',
  description:
    'Active and resolved quality holds on the batch with reason codes, owners, and resolution audit trail.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['trace'],
  requiredContext: [{ contextKey: 'batchId', scopeLevel: 'batch', required: true }],
  freshnessPolicy: {
    staleAfterSeconds: 300,
    errorAfterSeconds: 900,
    refreshOnFocus: true,
    pollIntervalSeconds: null,
  },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

export interface HoldsPanelProps {
  readonly request: Trace2AdapterRequest
}

export function HoldsPanel({ request }: HoldsPanelProps) {
  const { data: result, isLoading } = useHoldsReleases(request)
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

  const data: HoldsLedger | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 20 }}>
          <QtyByReasonBars rows={data.qtyByReason} />

          <SectionTitle
            label="Active holds"
            extra={`${data.activeHolds.length} pending`}
            tone={data.activeHolds.length > 0 ? 'warn' : 'good'}
          />
          {data.activeHolds.length === 0 ? (
            <EmptyState label="No active holds." />
          ) : (
            <HoldsTable rows={data.activeHolds} active />
          )}

          <SectionTitle label="Resolved holds" extra={`${data.resolvedHolds.length} closed`} />
          {data.resolvedHolds.length === 0 ? (
            <EmptyState label="No resolved holds on record." />
          ) : (
            <HoldsTable rows={data.resolvedHolds} active={false} />
          )}

          <div
            style={{
              marginTop: 16,
              padding: 10,
              fontSize: 11,
              color: 'var(--shell-fg-2)',
              background: 'var(--shell-surface-2, #F8F7F0)',
              borderRadius: 6,
              fontStyle: 'italic',
            }}
          >
            Read-only — release / reject decisions are posted from other workflows.
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function QtyByReasonBars({ rows }: { rows: readonly HoldsLedger['qtyByReason'][number][] }) {
  if (rows.length === 0) return null
  const max = Math.max(...rows.map((r) => r.qty))
  return (
    <div
      style={{
        marginBottom: 20,
        padding: 14,
        background: 'var(--shell-surface-2, #F8F7F0)',
        border: '1px solid var(--shell-line, #E5E3D7)',
        borderRadius: 8,
      }}
    >
      <SectionTitle label="Quantity by reason" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r) => {
          const pct = max > 0 ? (r.qty / max) * 100 : 0
          const color = r.color ?? 'var(--valentia-slate, #005776)'
          return (
            <div key={r.code}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--forest, #143700)' }}>
                  <span style={{ fontFamily: 'monospace', color: 'var(--shell-fg-2)', marginRight: 6 }}>{r.code}</span>
                  {r.label}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.qty.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: 'white', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--shell-line, #E5E3D7)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HoldsTable({ rows, active }: { rows: readonly HoldEntry[]; active: boolean }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 18 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
        <thead>
          <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
            {['Hold', 'Reason', 'Qty', 'Opened', active ? 'Owner' : 'Resolved', 'Status', 'Detail'].map((h) => (
              <Th key={h} align={h === 'Qty' ? 'right' : 'left'}>
                {h}
              </Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => {
            const statusTone =
              h.status === 'pending'
                ? { bg: 'var(--sunrise, #F9C20A)20', fg: '#8a6b00' }
                : h.status === 'released'
                  ? { bg: 'var(--jade, #44CF93)20', fg: '#1a8454' }
                  : { bg: 'var(--sunset, #F24A00)20', fg: 'var(--sunset, #F24A00)' }
            return (
              <tr key={h.id} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--valentia-slate, #005776)', fontWeight: 600 }}>{h.id}</td>
                <td style={{ padding: '9px 12px' }}>{h.reason}</td>
                <td style={{ padding: '9px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                  {h.qty.toLocaleString()}{' '}
                  <span style={{ color: 'var(--shell-fg-2)' }}>{h.uom ?? 'units'}</span>
                </td>
                <td style={{ padding: '9px 12px', fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{h.opened}</td>
                <td style={{ padding: '9px 12px' }}>
                  {active ? h.owner : <span style={{ fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>{h.resolved ?? '—'}</span>}
                </td>
                <td style={{ padding: '9px 12px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      background: statusTone.bg,
                      color: statusTone.fg,
                    }}
                  >
                    {h.status}
                  </span>
                </td>
                <td style={{ padding: '9px 12px', color: 'var(--shell-fg-2)' }}>
                  {active ? h.detail : (h.resolution ?? h.detail)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SectionTitle({ label, extra, tone }: { label: string; extra?: string; tone?: 'warn' | 'good' }) {
  const color =
    tone === 'warn' ? '#8a6b00' : tone === 'good' ? '#1a8454' : 'var(--valentia-slate, #005776)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        paddingBottom: 8,
        marginBottom: 12,
        borderBottom: '1px solid var(--shell-line, #E5E3D7)',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 700, color }}>
        {label}
      </span>
      {extra && (
        <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', fontFamily: 'monospace', marginLeft: 'auto' }}>
          {extra}
        </span>
      )}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--shell-surface-2, #F8F7F0)',
        border: '1px dashed var(--shell-line, #E5E3D7)',
        borderRadius: 8,
        fontSize: 12,
        color: 'var(--shell-fg-2)',
        textAlign: 'center',
        marginBottom: 18,
      }}
    >
      {label}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: '8px 12px',
        fontSize: 10.5,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        color: 'var(--shell-fg-2)',
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  )
}
