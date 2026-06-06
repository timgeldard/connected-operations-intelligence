import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { TraceRiskSignal } from '@connectio/data-contracts'
import { useRiskSignals } from '../adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

/** Static registration record for the Risk Signals panel. */
const registration: EvidencePanelRegistration = {
  panelId: 'risk-signals',
  displayName: 'Risk Signals',
  description: 'Active risk signals associated with the investigation, with source, confidence, and recommended actions.',
  ownerDomain: 'traceability',
  sourceOwnership: { domainId: 'traceability', systemName: 'trace2', legacyAppId: 'trace2' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['trace-investigation', 'quality-batch-release'],
  requiredContext: [],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'trace.read', displayName: 'Trace Read' }],
}

/** Severity to visual styling mapping. */
const severityStyle: Record<string, { background: string; border: string; textColor: string }> = {
  critical: { background: '#FEF2F2', border: 'var(--sunset, #F24A00)', textColor: 'var(--sunset, #F24A00)' },
  high: { background: '#FFFBEB', border: '#D97706', textColor: '#92400E' },
  medium: { background: '#FEFCE8', border: '#D4A017', textColor: '#78350F' },
  low: { background: '#F0FDFA', border: 'var(--sage, #289BA2)', textColor: 'var(--sage, #289BA2)' },
  info: { background: 'var(--shell-surface)', border: 'var(--shell-line)', textColor: 'var(--shell-fg-2)' },
}

/** Props for RiskSignalsPanel. */
export interface RiskSignalsPanelProps {
  /** Adapter request context providing investigationId and batchId. */
  readonly request: Trace2AdapterRequest
}

/**
 * Evidence panel listing active risk signals for the investigation.
 *
 * @remarks
 * Signals are sorted by severity (critical first). Each signal shows:
 * severity, source, confidence level (as a percentage), description,
 * and recommended action when present.
 * Colour is never the sole severity indicator — severity text is always shown.
 */
export function RiskSignalsPanel({ request }: RiskSignalsPanelProps) {
  const { data: result, isLoading } = useRiskSignals(request)
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

  const severityOrder = ['critical', 'high', 'medium', 'low', 'info']
  const signals: readonly TraceRiskSignal[] =
    result?.ok
      ? [...result.data].sort(
          (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity),
        )
      : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {signals.length > 0 && (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {signals.map(signal => {
            const style = severityStyle[signal.severity] ?? severityStyle['info']
            return (
              <div
                key={signal.signalId}
                style={{
                  padding: '10px 12px',
                  background: style.background,
                  border: `1px solid ${style.border}`,
                  borderRadius: 4,
                  display: 'grid',
                  gap: 4,
                }}
                role="listitem"
                aria-label={`Risk signal: ${signal.title}, severity ${signal.severity}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: style.textColor }}>
                    {/* Text label not just colour — accessibility requirement */}
                    [{signal.severity.toUpperCase()}] {signal.title}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--shell-fg-3)', flexShrink: 0 }}>
                    {Math.round(signal.confidence * 100)}% confidence · {signal.source}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)', lineHeight: 1.5 }}>
                  {signal.description}
                </p>
                {signal.recommendedAction && (
                  <div style={{ borderTop: `1px solid ${style.border}`, paddingTop: 4, fontSize: 11, fontWeight: 600, color: style.textColor }}>
                    → {signal.recommendedAction}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
