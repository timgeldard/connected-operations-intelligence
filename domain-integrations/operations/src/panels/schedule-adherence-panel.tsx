import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { ScheduleAdherenceSummary } from '@connectio/data-contracts'
import { useScheduleAdherenceSummary } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'schedule-adherence',
  displayName: 'Schedule Adherence',
  description: 'Plan adherence summary — on-time orders, delays, and adherence percentage.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.85, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

function adherenceColor(pct: number): string {
  if (pct >= 90) return '#2E7D32'
  if (pct >= 75) return '#D97706'
  return '#D32F2F'
}

function formatPlanDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function MetricTile({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'var(--shell-surface-2)', borderRadius: 5, border: '1px solid var(--shell-line)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: color ?? 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}

function AdherenceBar({ percent }: { percent: number }) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div style={{ height: 6, background: 'var(--shell-line)', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${clamped}%`, background: adherenceColor(percent), borderRadius: 3, transition: 'width 0.3s ease' }} />
    </div>
  )
}

export interface ScheduleAdherencePanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

export function ScheduleAdherencePanel({ request }: ScheduleAdherencePanelProps) {
  const { data: result, isLoading } = useScheduleAdherenceSummary(request)
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

  const data: ScheduleAdherenceSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: adherenceColor(data.adherencePercent) }}>
              {data.adherencePercent.toFixed(1)}%
            </div>
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)', marginTop: 4 }}>
              adherence &mdash; {formatPlanDate(data.planDate)}
            </div>
          </div>

          <AdherenceBar percent={data.adherencePercent} />

          <div style={{ display: 'flex', gap: 6 }}>
            <MetricTile label="Total" value={data.totalOrders} />
            <MetricTile label="On Time" value={data.onTimeOrders} color="#2E7D32" />
            <MetricTile label="Late" value={data.lateOrders} color={data.lateOrders > 0 ? '#D32F2F' : 'var(--shell-fg)'} />
            <MetricTile label="At Risk" value={data.atRiskOrders} color={data.atRiskOrders > 0 ? '#D97706' : 'var(--shell-fg)'} />
          </div>

          <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
              Avg delay: <span style={{ fontWeight: 700, color: data.averageDelayMinutes > 0 ? '#D97706' : 'var(--shell-fg)' }}>{data.averageDelayMinutes} min</span>
            </div>
            {data.worstLine && (
              <div style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                Worst line: <span style={{ fontWeight: 700, color: 'var(--shell-fg)' }}>{data.worstLine}</span>
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              Confidence: {(data.confidence * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
