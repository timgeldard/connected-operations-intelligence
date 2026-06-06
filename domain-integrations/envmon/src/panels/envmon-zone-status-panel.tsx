import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { EnvMonZone } from '@connectio/data-contracts'
import { useEnvMonZones } from '../adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'envmon-zone-status',
  displayName: 'Zone Status',
  description: 'Status and alert count for each monitored environmental zone in the plant.',
  ownerDomain: 'envmon',
  sourceOwnership: { domainId: 'envmon', systemName: 'lims', legacyAppId: 'lims' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['envmon-monitoring'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'envmon.monitoring.read', displayName: 'Environmental Monitoring Read' }],
}

export interface EnvMonZoneStatusPanelProps {
  readonly request: EnvMonAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  'corrective-action': '#D32F2F',
  alert: '#F57C00',
  overdue: '#D97706',
  suspended: '#9E9E9E',
  compliant: '#2E7D32',
}

const HYGIENE_LABEL: Record<string, string> = {
  'zone-1': 'Z1',
  'zone-2': 'Z2',
  'zone-3': 'Z3',
  'zone-4': 'Z4',
}

export function EnvMonZoneStatusPanel({ request }: EnvMonZoneStatusPanelProps) {
  const { data: result, isLoading } = useEnvMonZones(request)
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

  const zones: EnvMonZone[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {zones && (
        <div style={{ padding: '8px 0' }}>
          {zones.map((zone) => {
            const color = STATUS_COLOR[zone.status] ?? 'var(--shell-fg-2)'
            return (
              <div key={zone.zoneId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: '1px solid var(--shell-line)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: color, borderRadius: 3, padding: '1px 5px', minWidth: 22, textAlign: 'center' }}>
                  {HYGIENE_LABEL[zone.hygieneZone] ?? zone.hygieneZone}
                </span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--shell-fg)', fontWeight: 500 }}>{zone.zoneName}</span>
                <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>{zone.areaType}</span>
                {zone.openAlerts > 0 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: color, border: `1px solid ${color}`, borderRadius: 4, padding: '1px 6px' }}>
                    {zone.openAlerts} alert{zone.openAlerts !== 1 ? 's' : ''}
                  </span>
                )}
                <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color }}>
                  {zone.status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
