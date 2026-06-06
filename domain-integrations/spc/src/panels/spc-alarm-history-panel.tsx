import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { SPCAlarmHistoryItem } from '@connectio/data-contracts'
import { useSPCAlarmHistory } from '../adapters/spc-monitoring-queries.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'spc-alarm-history',
  displayName: 'SPC Alarm History',
  description: 'Historical SPC alarms — active, acknowledged, resolved, and false-positive with acknowledgement detail.',
  ownerDomain: 'spc',
  sourceOwnership: { domainId: 'spc', systemName: 'spc', legacyAppId: 'spc' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['spc-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: false, pollIntervalSeconds: null },
  confidencePolicy: { level: null, hidden: false },
  requiredPermissions: [{ permissionId: 'spc.read', displayName: 'SPC Read' }],
}

export interface SPCAlarmHistoryPanelProps {
  readonly request: SPCMonitoringAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  active: '#D32F2F',
  acknowledged: '#D97706',
  investigating: 'var(--sunset, #F24A00)',
  resolved: '#388E3C',
  'false-positive': 'var(--shell-fg-3)',
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#D32F2F',
  high: 'var(--sunset, #F24A00)',
  medium: '#D97706',
  low: '#388E3C',
}

export function SPCAlarmHistoryPanel({ request }: SPCAlarmHistoryPanelProps) {
  const { data: result, isLoading } = useSPCAlarmHistory(request)
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

  const items: SPCAlarmHistoryItem[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {result?.ok && (
        <div style={{ padding: '12px 16px' }}>
          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--shell-fg-3)', margin: 0 }}>No alarm history in selected period.</p>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {items.map(item => (
                <div
                  key={item.alarmId}
                  style={{
                    padding: '7px 10px',
                    background: 'var(--shell-surface-2)',
                    borderRadius: 4,
                    borderLeft: `3px solid ${STATUS_COLOR[item.status] ?? 'var(--shell-line)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--shell-fg)' }}>{item.characteristicId}</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: SEVERITY_COLOR[item.severity], textTransform: 'uppercase' }}>{item.severity}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[item.status], textTransform: 'uppercase' }}>{item.status}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--shell-fg-2)', marginTop: 1 }}>{item.rule}</div>
                  <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 2 }}>
                    {new Date(item.timestamp).toLocaleString()}
                    {item.linkedBatchId && ` · Batch: ${item.linkedBatchId}`}
                  </div>
                  {item.acknowledgedBy && (
                    <div style={{ fontSize: 10, color: 'var(--shell-fg-3)', marginTop: 1 }}>
                      Acknowledged by {item.acknowledgedBy}
                      {item.acknowledgedAt && ` at ${new Date(item.acknowledgedAt).toLocaleString()}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </EvidencePanel>
  )
}
