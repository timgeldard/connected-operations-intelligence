import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SPCSignalSummary } from '@connectio/data-contracts'
import { useSPCSignals } from '../adapters/spc-signals-queries.js'
import type { SPCSignalsAdapterRequest } from '../adapters/spc-signals-adapter.js'

/** Static registration record for the SPC Signals panel (release context). */
const registration: EvidencePanelRegistration = {
  panelId: 'spc-signals-for-release',
  displayName: 'SPC Signals',
  description: 'Active and recently resolved SPC control chart alarms for the batch process order.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['quality-batch-release'],
  requiredContext: [{ contextKey: 'processOrderId', scopeLevel: 'process-order', required: false }],
  freshnessPolicy: { staleAfterSeconds: 120, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'quality.read', displayName: 'Quality Read' }],
}

/** Props for SPCSignalsForReleasePanel. */
export interface SPCSignalsForReleasePanelProps {
  /** Adapter request context providing batchId and processOrderId. */
  readonly request: SPCSignalsAdapterRequest
}

/**
 * Evidence panel displaying SPC control chart alarms relevant to a batch release decision.
 *
 * @remarks
 * Owned by the SPC domain; consumed exclusively by the quality-batch-release workspace.
 * Shows active alarm count, individual alarms with severity and rule violated, and
 * resolved alarms from the same batch's production run.
 */
export function SPCSignalsForReleasePanel({ request }: SPCSignalsForReleasePanelProps) {
  const { data: result, isLoading } = useSPCSignals(request)
  const lastRefreshedAt = result?.ok ? result.fetchedAt : null
  const { displayState, markReady, markError } = useEvidencePanel({
    panelId: registration.panelId,
    staleAfterSeconds: registration.freshnessPolicy.staleAfterSeconds,
    lastRefreshedAt,
  })

  useEffect(() => {
    if (isLoading) return
    if (result?.ok) {
      markReady()
    } else if (result && !result.ok) {
      markError()
    }
  }, [isLoading, result, markReady, markError])

  const data: SPCSignalSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <SPCMetric label="Active Alarms" value={data.activeAlarmCount} highlight={data.activeAlarmCount > 0} />
            <SPCMetric label="Critical Alarms" value={data.criticalAlarmCount} highlight={data.criticalAlarmCount > 0} />
            <SPCMetric label="Resolved" value={data.resolvedAlarmCount} />
          </div>

          {data.alarms.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 6 }}>
                Alarms
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                {data.alarms.map((alarm) => (
                  <div
                    key={alarm.alarmId}
                    style={{
                      fontSize: 12,
                      padding: '6px 8px',
                      background: 'var(--shell-surface-2)',
                      borderRadius: 4,
                      borderLeft: `3px solid ${alarm.status === 'active' ? '#D32F2F' : '#9E9E9E'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: 'var(--shell-fg)' }}>{alarm.parameter}</span>
                      <SeverityBadge severity={alarm.severity} status={alarm.status} />
                    </div>
                    <div style={{ color: 'var(--shell-fg-2)', marginTop: 2 }}>{alarm.ruleViolated}</div>
                    <div style={{ color: 'var(--shell-fg-3)', marginTop: 2, fontSize: 11 }}>
                      Chart: {alarm.chartType.toUpperCase()} · Fired: {new Date(alarm.firedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}

function SPCMetric({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--shell-fg-3)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? 'var(--sunset, #F24A00)' : 'var(--shell-fg)' }}>
        {value}
      </div>
    </div>
  )
}

function SeverityBadge({ severity, status }: { severity: string; status: string }) {
  const colour = status === 'resolved' ? '#9E9E9E' : severity === 'critical' ? '#D32F2F' : severity === 'major' ? 'var(--sunset, #F24A00)' : '#FF9800'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: colour, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {status === 'resolved' ? 'Resolved' : severity}
    </span>
  )
}
