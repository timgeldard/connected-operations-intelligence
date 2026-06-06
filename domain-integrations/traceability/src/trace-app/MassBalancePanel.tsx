import { useEffect, useMemo } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { MassBalanceLedger, MassBalanceEvent } from '@connectio/data-contracts'
import { useMassBalance } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'mass-balance',
  displayName: 'Mass Balance',
  description:
    'SAP MSEG-derived ledger of production, consumption, dispatch, and adjustment movements with daily running on-hand. Variance reconciliation surfaced as a KPI.',
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

export interface MassBalancePanelProps {
  readonly request: Trace2AdapterRequest
}

const CODE_COLORS: Record<MassBalanceEvent['code'], string> = {
  '101': 'var(--jade, #44CF93)',
  '261': 'var(--sage, #289BA2)',
  '601': 'var(--valentia-slate, #005776)',
  '701': 'var(--sunrise, #F9C20A)',
  Z01: 'var(--shell-fg-2)',
}

const CODE_LABELS: Record<MassBalanceEvent['code'], string> = {
  '101': 'Production',
  '261': 'Consumption',
  '601': 'Dispatch',
  '701': 'Adjustment',
  Z01: 'Extension',
}

export function MassBalancePanel({ request }: MassBalancePanelProps) {
  const { data: result, isLoading } = useMassBalance(request)
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

  const data: MassBalanceLedger | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 20 }}>
          <KpiRow ledger={data} />
          <RunningChart events={data.events} />
          <EventLedger events={data.events} ledger={data} />
        </div>
      )}
    </EvidencePanel>
  )
}

function KpiRow({ ledger }: { ledger: MassBalanceLedger }) {
  const { kpi } = ledger
  const reconciled = Math.abs(kpi.variance) < 0.1
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 0,
        marginBottom: 20,
        border: '1px solid var(--shell-line, #E5E3D7)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--shell-surface-2, #F8F7F0)',
      }}
    >
      <Kpi
        label="Produced"
        value={kpi.produced}
        sub={`${kpi.postings.production} postings`}
        tone="good"
        uom={kpi.uom}
      />
      <Kpi
        label="Consumed"
        value={kpi.consumed}
        sub={`${kpi.postings.consumption} postings`}
        uom={kpi.uom}
      />
      <Kpi
        label="Shipped"
        value={kpi.shipped}
        sub={`${kpi.postings.dispatch} postings`}
        uom={kpi.uom}
      />
      <Kpi
        label="Adjusted"
        value={kpi.adjusted}
        sub={`${kpi.postings.adjustment} postings`}
        uom={kpi.uom}
      />
      <Kpi label="On hand" value={kpi.current} sub="Current" tone="brand" uom={kpi.uom} />
      <Kpi
        label="Variance"
        value={kpi.variance}
        sub={reconciled ? 'Reconciled' : 'Unexplained'}
        tone={reconciled ? 'good' : 'warn'}
        uom={kpi.uom}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  sub,
  tone,
  uom,
}: {
  label: string
  value: number
  sub: string
  tone?: 'good' | 'warn' | 'brand'
  // MassBalanceKpi.uom is `z.string().nullable()` — do NOT default `null` to
  // 'KG' (or any other unit). Render an em-dash instead so the user sees that
  // the source did not supply a unit.
  uom: string | null
}) {
  const color =
    tone === 'good'
      ? '#1a8454'
      : tone === 'warn'
        ? '#8a6b00'
        : tone === 'brand'
          ? 'var(--valentia-slate, #005776)'
          : 'var(--forest, #143700)'
  return (
    <div style={{ padding: 14, borderRight: '1px solid var(--shell-line, #E5E3D7)' }}>
      <div
        style={{
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          fontWeight: 700,
          color: 'var(--shell-fg-2)',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>
        {value > 0 ? '+' : ''}
        {value.toLocaleString()}
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg-2)', marginLeft: 4 }}>
          {uom ?? '—'}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 4 }}>{sub}</div>
    </div>
  )
}

function RunningChart({ events }: { events: readonly MassBalanceEvent[] }) {
  if (events.length === 0) return null
  const cums = events.map((e) => e.cum)
  const min = Math.min(0, ...cums)
  const max = Math.max(...cums)
  const range = max - min || 1
  const width = 800
  const height = 160
  const padX = 16
  const padY = 12
  const innerW = width - padX * 2
  const innerH = height - padY * 2
  const x = (i: number) => padX + (i / Math.max(1, events.length - 1)) * innerW
  const y = (v: number) => padY + (1 - (v - min) / range) * innerH

  const path = events.map((e, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(e.cum)}`).join(' ')
  const zeroY = y(0)

  return (
    <div
      style={{
        marginBottom: 20,
        padding: 12,
        background: 'var(--shell-surface-2, #F8F7F0)',
        border: '1px solid var(--shell-line, #E5E3D7)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--valentia-slate, #005776)',
          }}
        >
          Running on hand
        </span>
        <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', fontFamily: 'monospace' }}>
          {events.length} movements
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 160, display: 'block' }}
      >
        <line
          x1={padX}
          x2={width - padX}
          y1={zeroY}
          y2={zeroY}
          stroke="var(--shell-line, #E5E3D7)"
          strokeDasharray="3 3"
        />
        <path d={path} fill="none" stroke="var(--valentia-slate, #005776)" strokeWidth={2} />
        {events.map((e, i) => (
          <circle
            key={e.d}
            cx={x(i)}
            cy={y(e.cum)}
            r={2.5}
            fill={CODE_COLORS[e.code]}
            stroke="white"
            strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  )
}

type GroupedEvent = {
  key: string
  date: string
  code: MassBalanceEvent['code']
  delta: number
}

function EventLedger({
  events,
  ledger,
}: {
  events: readonly MassBalanceEvent[]
  ledger: MassBalanceLedger
}) {
  const groups = useMemo<GroupedEvent[]>(() => {
    const map = new Map<string, GroupedEvent>()
    for (const e of events) {
      const date = e.date ?? ''
      const key = `${date}::${e.code}`
      const existing = map.get(key)
      if (existing) {
        existing.delta += e.delta
      } else {
        map.set(key, { key, date, code: e.code, delta: e.delta })
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.date < b.date) return -1
      if (a.date > b.date) return 1
      return a.code.localeCompare(b.code)
    })
  }, [events])

  return (
    <div>
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
        <span
          style={{
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontWeight: 700,
            color: 'var(--valentia-slate, #005776)',
          }}
        >
          Movement summary
        </span>
        <span
          style={{
            fontSize: 11,
            color: 'var(--shell-fg-2)',
            fontFamily: 'monospace',
            marginLeft: 'auto',
          }}
        >
          {ledger.dateStart} → {ledger.dateEnd}
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: 'var(--shell-surface-2, #F8F7F0)' }}>
              <Th>Date</Th>
              <Th>Movement</Th>
              <Th align="right">Net qty</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key} style={{ borderBottom: '1px solid var(--shell-line, #E5E3D7)' }}>
                <td
                  style={{
                    padding: '7px 12px',
                    fontFamily: 'monospace',
                    color: 'var(--shell-fg-2)',
                  }}
                >
                  {g.date || '—'}
                </td>
                <td style={{ padding: '7px 12px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      color: CODE_COLORS[g.code],
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: CODE_COLORS[g.code],
                        display: 'inline-block',
                      }}
                    />
                    {CODE_LABELS[g.code]}
                  </span>
                </td>
                <td
                  style={{
                    padding: '7px 12px',
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: g.delta < 0 ? '#c63b00' : '#1a8454',
                    fontWeight: 600,
                  }}
                >
                  {g.delta > 0 ? '+' : ''}
                  {g.delta.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
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
