import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { YieldVarianceSummary } from '@connectio/data-contracts'
import { useYieldVarianceSummary } from '../adapters/operations-plan-risk-queries.js'
import type { OperationsPlanRiskAdapterRequest } from '../adapters/operations-plan-risk-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'yield-variance',
  displayName: 'Yield Variance',
  description: 'Yield losses, scrap, and rework risk for in-process orders.',
  ownerDomain: 'operations',
  sourceOwnership: { domainId: 'operations', systemName: 'poh', legacyAppId: 'poh' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['operations-plan-risk'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.85, hidden: false },
  requiredPermissions: [{ permissionId: 'operations.plan.read', displayName: 'Operations Plan Read' }],
}

export interface YieldVariancePanelProps {
  readonly request: OperationsPlanRiskAdapterRequest
}

const SEVERITY_BORDER: Record<string, string> = {
  critical: '#D32F2F',
  high: '#F57C00',
  medium: '#FBC02D',
  low: '#9E9E9E',
}

const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }

function worstSeverity(items: YieldVarianceSummary[]): string | null {
  if (items.length === 0) return null
  return items.reduce((acc, item) =>
    (SEVERITY_ORDER[item.severity] ?? 9) < (SEVERITY_ORDER[acc.severity] ?? 9) ? item : acc
  ).severity
}

export function YieldVariancePanel({ request }: YieldVariancePanelProps) {
  const { data: result, isLoading } = useYieldVarianceSummary(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) { markReady() } else if (result && !result.ok) { markError() }
  }, [isLoading, result, markReady, markError])

  const data: YieldVarianceSummary[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel registration={registration} displayState={displayState} errorMessage={!result?.ok ? result?.error.message : undefined}>
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 8 }}>
          {data.length === 0 ? (
            <span style={{ fontSize: 13, color: 'var(--shell-fg-3)' }}>No yield variances recorded</span>
          ) : (
            <>
              {worstSeverity(data) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)' }}>Worst severity</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: SEVERITY_BORDER[worstSeverity(data)!] ?? 'var(--shell-fg)', textTransform: 'capitalize' }}>
                    {worstSeverity(data)}
                  </span>
                </div>
              )}
              {data.map((item) => (
                <div
                  key={item.processOrderId}
                  style={{
                    borderLeft: `3px solid ${SEVERITY_BORDER[item.severity] ?? 'var(--shell-line)'}`,
                    paddingLeft: 10,
                    paddingTop: 6,
                    paddingBottom: 6,
                    borderBottom: '1px solid var(--shell-line)',
                    display: 'grid',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)' }}>{item.processOrderId}</span>
                    <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>{item.materialId}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{item.lineOrResource}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, color: 'var(--shell-fg-2)' }}>
                      {item.plannedYieldPercent.toFixed(1)}% <span style={{ color: 'var(--shell-fg-3)' }}>→</span> {item.actualYieldPercent.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.variancePercent < 0 ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>
                      {item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Scrap {item.scrapQuantity.toLocaleString()}</span>
                    <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Rework {item.reworkQuantity.toLocaleString()}</span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)', fontStyle: 'italic' }}>{item.lossReason}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
