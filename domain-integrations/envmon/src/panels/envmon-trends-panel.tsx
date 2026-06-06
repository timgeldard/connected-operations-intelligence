import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonTrend } from '@connectio/data-contracts'
import { useEnvMonTrends } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-trends',
  displayName: 'Environmental Trends',
  description: 'Daily trend of environmental monitoring — positive rate, open alerts, and compliance rate over the monitoring period.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 600, errorAfterSeconds: 1800, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonTrendsPanelProps {
  readonly request: EnvMonAdapterRequest
}

function formatShortDate(date: string): string {
  const d = new Date(date)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function complianceColor(rate: number): string {
  if (rate >= 95) return '#2E7D32'
  if (rate >= 85) return '#D97706'
  return '#D32F2F'
}

function barColor(rate: number): string {
  if (rate > 5) return '#D32F2F'
  if (rate > 2) return '#D97706'
  return '#2E7D32'
}

function TrendBarsChart({ trends }: { trends: EnvMonTrend[] }) {
  if (trends.length === 0) return null

  const W = 400
  const H = 90
  const PAD_L = 30
  const PAD_R = 20
  const PAD_T = 8
  const PAD_B = 20
  const plotW = W - PAD_L - PAD_R
  const plotH = H - PAD_T - PAD_B
  const n = trends.length

  const maxRate = Math.max(10, ...trends.map(t => t.positiveRate))
  const yMax = Math.ceil(maxRate / 2) * 2

  const slotW = plotW / n
  const barW = slotW * 0.65

  function toX(i: number) {
    return PAD_L + i * slotW + (slotW - barW) / 2
  }

  function toY(v: number) {
    return PAD_T + (1 - v / yMax) * plotH
  }

  const yTicks = [0, yMax / 2, yMax]
  const showLabel = (i: number) => i % 2 === 0 || i === n - 1

  return (
    <div style={{ padding: '8px 16px 0' }}>
      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        Positive Rate (%) — daily
      </div>
      <div style={{ background: 'var(--shell-surface-2)', borderRadius: 4, overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {/* Y-axis ticks */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line x1={PAD_L - 3} y1={toY(tick)} x2={PAD_L} y2={toY(tick)} stroke="var(--shell-fg-3)" strokeWidth={0.5} />
              <text x={PAD_L - 5} y={toY(tick) + 3} textAnchor="end" fontSize={8} fill="var(--shell-fg-3)">{tick}%</text>
            </g>
          ))}
          {/* Y-axis baseline */}
          <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + plotH} stroke="var(--shell-line)" strokeWidth={0.5} />
          {/* Baseline */}
          <line x1={PAD_L} y1={toY(0)} x2={PAD_L + plotW} y2={toY(0)} stroke="var(--shell-line)" strokeWidth={0.5} />
          {/* 5% action level */}
          {yMax >= 5 && (
            <>
              <line x1={PAD_L} y1={toY(5)} x2={PAD_L + plotW} y2={toY(5)} stroke="#D32F2F" strokeWidth={0.8} strokeDasharray="4 3" />
              <text x={PAD_L + plotW + 2} y={toY(5) + 3} fontSize={7} fill="#D32F2F">5%</text>
            </>
          )}
          {/* Bars */}
          {trends.map((t, i) => {
            const barH = Math.max(1, toY(0) - toY(t.positiveRate))
            return (
              <rect key={t.date} x={toX(i)} y={toY(t.positiveRate)} width={barW} height={barH} fill={barColor(t.positiveRate)} rx={1}>
                <title>{`${formatShortDate(t.date)}: ${t.positiveRate.toFixed(1)}% positive (${t.positiveCount} of ${t.samplesCollected} samples)`}</title>
              </rect>
            )
          })}
          {/* X-axis labels */}
          {trends.map((t, i) =>
            showLabel(i) ? (
              <text key={t.date} x={toX(i) + barW / 2} y={H - 5} textAnchor="middle" fontSize={8} fill="var(--shell-fg-3)">
                {formatShortDate(t.date)}
              </text>
            ) : null,
          )}
        </svg>
      </div>
    </div>
  )
}

export function EnvMonTrendsPanel({ request }: EnvMonTrendsPanelProps) {
  const { data: result, isLoading } = useEnvMonTrends(request)
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

  const trends: EnvMonTrend[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {trends && trends.length > 0 && (
        <div style={{ padding: '4px 0 8px' }}>
          <TrendBarsChart trends={trends} />
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: 0, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--shell-fg-3)', padding: '4px 16px 8px' }}>
              <span>Date</span>
              <span style={{ textAlign: 'right' }}>Samples</span>
              <span style={{ textAlign: 'right' }}>Positives</span>
              <span style={{ textAlign: 'right' }}>Pos. Rate</span>
              <span style={{ textAlign: 'right' }}>Compliance</span>
            </div>
            {trends.map((row) => (
              <div key={row.date} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr', gap: 0, padding: '6px 16px', borderBottom: '1px solid var(--shell-line)', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{formatShortDate(row.date)}</span>
                <span style={{ fontSize: 12, textAlign: 'right', color: 'var(--shell-fg)' }}>{row.samplesCollected}</span>
                <span style={{ fontSize: 12, textAlign: 'right', color: row.positiveCount > 0 ? '#D32F2F' : 'var(--shell-fg)' }}>
                  {row.positiveCount}
                </span>
                <span style={{ fontSize: 12, textAlign: 'right', color: row.positiveRate > 5 ? '#D32F2F' : 'var(--shell-fg)' }}>
                  {Number(row.positiveRate.toFixed(1))}%
                </span>
                <span style={{ fontSize: 12, textAlign: 'right', fontWeight: 600, color: complianceColor(row.complianceRate) }}>
                  {Number(row.complianceRate.toFixed(1))}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {trends && trends.length === 0 && (
        <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--shell-fg-3)' }}>
          No trend data for the selected period.
        </div>
      )}
    </EvidencePanel>
  )
}
