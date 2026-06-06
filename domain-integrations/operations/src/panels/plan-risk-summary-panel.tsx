import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { PlanRiskSummary } from '@connectio/data-contracts'
import { usePlanRiskSummary } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'plan-risk-summary',
  displayName: 'Plan Risk Summary',
  description: 'Headline operational risk picture for the plan — orders on track, at risk, late, and blocked with top risk driver.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface PlanRiskSummaryPanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

const ADHERENCE_TREND = [
  { day: 'Mon', pct: 80 },
  { day: 'Tue', pct: 84 },
  { day: 'Wed', pct: 82 },
  { day: 'Thu', pct: 76 },
  { day: 'Fri', pct: 74 },
  { day: 'Sat', pct: 79 },
  { day: 'Sun', pct: 75 },
]

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#D97706',
  low: '#2E7D32',
}

function formatPlanDate(isoDate: string): string {
  const d = new Date(isoDate)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function MetricTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 64, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 24, fontWeight: 700, color: color ?? 'var(--shell-fg)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)' }}>{label}</span>
    </div>
  )
}

function AdherenceSparkline() {
  const W = 280
  const H = 36
  const PAD_X = 12
  const PAD_Y = 6
  const plotW = W - PAD_X * 2
  const plotH = H - PAD_Y * 2
  const n = ADHERENCE_TREND.length
  const minPct = Math.min(...ADHERENCE_TREND.map(d => d.pct)) - 4
  const maxPct = Math.max(...ADHERENCE_TREND.map(d => d.pct)) + 4
  const range = maxPct - minPct

  function toX(i: number) { return PAD_X + (i / (n - 1)) * plotW }
  function toY(pct: number) { return PAD_Y + (1 - (pct - minPct) / range) * plotH }

  const pts = ADHERENCE_TREND.map((d, i) => `${toX(i)},${toY(d.pct)}`).join(' ')

  return (
    <div style={{ background: 'var(--shell-surface-2)', borderRadius: 4, padding: '6px 0 4px' }}>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', paddingLeft: PAD_X, marginBottom: 2 }}>
        7-day adherence trend
      </div>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <polyline fill="none" stroke="var(--ocean, #005776)" strokeWidth={1.5} points={pts} />
        {ADHERENCE_TREND.map((d, i) => (
          <g key={d.day}>
            <circle cx={toX(i)} cy={toY(d.pct)} r={3} fill="var(--ocean, #005776)" />
            <text x={toX(i)} y={H - 1} textAnchor="middle" fontSize={8} fill="var(--shell-fg-3)">{d.day}</text>
          </g>
        ))}
      </svg>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string }) {
  const color = SEVERITY_COLOR[severity] ?? 'var(--shell-fg-2)'
  return (
    <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, border: `1px solid ${color}`, borderRadius: 4, padding: '2px 7px' }}>
      {severity}
    </span>
  )
}

export function PlanRiskSummaryPanel({ request }: PlanRiskSummaryPanelProps) {
  const { data: result, isLoading } = usePlanRiskSummary(request)
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

  const data: PlanRiskSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontWeight: 500 }}>
              {formatPlanDate(data.planDate)}
            </span>
            <SeverityBadge severity={data.highestSeverity} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <MetricTile label="Planned" value={data.plannedOrders} />
            <MetricTile label="On Track" value={data.ordersOnTrack} color="#2E7D32" />
            <MetricTile label="At Risk" value={data.ordersAtRisk} color="#D97706" />
            <MetricTile label="Late" value={data.ordersLate} color="#F57C00" />
            <MetricTile label="Blocked" value={data.blockedOrders} color="#D32F2F" />
          </div>

          <AdherenceSparkline />

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10, display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', whiteSpace: 'nowrap', paddingTop: 1 }}>Top risk:</span>
              <span style={{ fontSize: 13, color: 'var(--shell-fg)', fontWeight: 500 }}>{data.topRiskReason}</span>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', whiteSpace: 'nowrap', paddingTop: 1 }}>Recommended:</span>
              <span style={{ fontSize: 12, color: 'var(--shell-fg-2)', fontStyle: 'italic' }}>{data.recommendedAction}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              Confidence: {Math.round(data.confidence * 100)}%
            </span>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
