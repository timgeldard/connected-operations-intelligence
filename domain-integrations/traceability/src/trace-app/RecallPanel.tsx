import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { RecallReadiness } from '@connectio/data-contracts'
import { useRecallReadiness } from './trace-app-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'
import { Card, CardContent } from '@connectio/design-system'


const registration: EvidencePanelRegistration = {
  panelId: 'recall-readiness',
  displayName: 'Recall & Exposure',
  description:
    'Cross-plant customer exposure with delivery-level detail, geographic spread, and recall recommendation. Plant context is intentionally ignored.',
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

export interface RecallPanelProps {
  readonly request: Trace2AdapterRequest
}

const STATUS_TONES = {
  'delivery-evidence': { bg: 'var(--stone)', fg: 'var(--status-neutral)' },
  delivered: { bg: 'color-mix(in srgb, var(--status-good) 12%, white)', fg: 'var(--status-good)' },
  'in-transit': { bg: 'color-mix(in srgb, var(--status-info) 12%, white)', fg: 'var(--status-info)' },
  recalled: { bg: 'color-mix(in srgb, var(--status-bad) 12%, white)', fg: 'var(--status-bad)' },
  blocked: { bg: 'color-mix(in srgb, var(--status-warn) 12%, white)', fg: 'var(--status-warn)' },
  unknown: { bg: 'var(--stone)', fg: 'var(--status-neutral)' },
} as const

const STATUS_LABELS: Record<keyof typeof STATUS_TONES, string> = {
  'delivery-evidence': 'Dispatched',
  delivered: 'Delivered',
  'in-transit': 'In transit',
  recalled: 'Recalled',
  blocked: 'Blocked',
  unknown: 'Unknown',
}

export function RecallPanel({ request }: RecallPanelProps) {
  const { data: result, isLoading } = useRecallReadiness(request)
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

  const data: RecallReadiness | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: 24, fontFamily: 'var(--font-sans)' }}>
          {/* Recommendation Banner */}
          <div
            style={{
              marginBottom: 20,
              padding: 14,
              background: data.recommendationStatus === 'recommended' ? 'color-mix(in srgb, var(--status-bad) 10%, white)' : 'color-mix(in srgb, var(--status-good) 10%, white)',
              borderLeft: `4px solid ${data.recommendationStatus === 'recommended' ? 'var(--status-bad)' : 'var(--status-good)'}`,
              borderRadius: 'var(--radius-sm)',
              color: 'var(--forest)',
              fontSize: 'var(--fs-13)',
              fontWeight: 'var(--fw-medium)',
            }}
          >
            {data.recommendationStatus === 'recommended' ? (
              <span>⚠️ Action Required: Recall recommended for this batch. Escalate to the Quality Operations team immediately.</span>
            ) : (
              <span>✅ Status Verified: Batch released and within specification bounds. No recall recommended.</span>
            )}
          </div>

          {/* Metric KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <MetricCard label="Customers Impacted" value={data.totals.customers} />
            <MetricCard label="Countries Shipped" value={data.totals.countries} />
            <MetricCard label="Deliveries Dispatched" value={data.totals.deliveries} />
            <MetricCard label="Total Volume Shipped" value={data.totals.shipped.toLocaleString()} unit={data.totals.uom} />
          </div>

          {/* Geographic Spread */}
          <SectionTitle label="Geographic Spread" extra={`${data.countries.length} countries`} />
          <div
            style={{
              padding: 20,
              background: 'var(--stone)',
              border: '1px solid var(--stroke)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {data.countries.map((c) => (
              <div key={c.code}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 'var(--fs-13)', fontWeight: 'var(--fw-semibold)', color: 'var(--forest)' }}>
                    {c.code} · {c.name}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-12)', color: 'var(--forest)', fontWeight: 'var(--fw-medium)' }}>
                    {c.qty.toLocaleString()}{' '}
                    <span style={{ color: 'var(--fg-muted)' }}>· {(c.pct * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--white)', borderRadius: 'var(--radius-full)', overflow: 'hidden', border: '1px solid var(--stroke-soft)' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${c.pct * 100}%`,
                      background: 'var(--brand)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Deliveries Table */}
          <SectionTitle label="Dispatched Deliveries" extra={`${data.deliveries.length} of ${data.totals.deliveries} visible`} />
          <div style={{ overflowX: 'auto', border: '1px solid var(--stroke)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-13)' }}>
              <thead>
                <tr style={{ background: 'var(--stone)', borderBottom: '1px solid var(--stroke)' }}>
                  {['Delivery', 'Customer', 'Country', 'Date', 'Qty', 'Status', 'Doc'].map((h) => (
                    <Th key={h} align={h === 'Qty' ? 'right' : 'left'}>
                      {h}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.deliveries.map((d) => {
                  const tone = STATUS_TONES[d.status] ?? STATUS_TONES.unknown
                  return (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--stroke-soft)', background: 'var(--white)' }}>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--brand)', fontWeight: 'var(--fw-semibold)' }}>{d.id}</td>
                      <td style={{ padding: '12px 14px', color: 'var(--forest)' }}>{d.customer}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--forest)' }}>{d.country}</td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{d.date}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--forest)', fontWeight: 'var(--fw-medium)' }}>
                        {d.qty.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            padding: '2px 8px',
                            borderRadius: 'var(--radius-full)',
                            fontSize: 11,
                            fontWeight: 'var(--fw-semibold)',
                            background: tone.bg,
                            color: tone.fg,
                          }}
                        >
                          {STATUS_LABELS[d.status] ?? d.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>{d.doc}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}

function MetricCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <Card style={{ padding: 18, borderRadius: 'var(--radius-md)', border: '1px solid var(--stroke)', background: 'var(--white)', boxShadow: 'var(--shadow-sm)' }}>
      <CardContent style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: 'var(--ls-upper)', fontFamily: 'var(--font-mono)' }}>{label}</span>
        <span style={{ fontSize: 'var(--fs-24)', fontWeight: 'var(--fw-extrabold)', color: 'var(--forest)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'baseline', gap: 4 }}>
          {value}
          {unit && <span style={{ fontSize: 'var(--fs-14)', fontWeight: 'var(--fw-semibold)', color: 'var(--fg-muted)' }}>{unit}</span>}
        </span>
      </CardContent>
    </Card>
  )
}

function SectionTitle({ label, extra }: { label: string; extra?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        paddingBottom: 8,
        marginBottom: 14,
        borderBottom: '1px solid var(--stroke)',
      }}
    >
      <span className="t-eyebrow" style={{ margin: 0 }}>
        {label}
      </span>
      {extra && (
        <span style={{ fontSize: 'var(--fs-11)', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
          {extra}
        </span>
      )}
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
        padding: '10px 14px',
        fontSize: 10.5,
        letterSpacing: 'var(--ls-upper)',
        textTransform: 'uppercase',
        color: 'var(--fg-muted)',
        fontWeight: 'var(--fw-semibold)',
        fontFamily: 'var(--font-mono)',
      }}
    >
      {children}
    </th>
  )
}
