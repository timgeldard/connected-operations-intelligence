import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StagingZoneCapacity } from '@connectio/data-contracts'
import { useStagingZoneCapacity } from '../adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'staging-zone-capacity',
  displayName: 'Zone Capacity',
  description: 'Staging zone utilisation and capacity with overflow risk indicators.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'live',
  allowedConsumerWorkspaces: ['production-staging'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.staging.read', displayName: 'Warehouse Staging Read' }],
}

export interface StagingZoneCapacityPanelProps {
  readonly request: ProductionStagingAdapterRequest
}

const STATUS_COLOR: Record<string, string> = {
  full: '#D32F2F',
  blocked: '#D32F2F',
  'high-utilisation': '#F57C00',
  available: '#2E7D32',
}

function capacityBarColor(pct: number): string {
  if (pct >= 90) return '#D32F2F'
  if (pct >= 75) return '#F57C00'
  return '#2E7D32'
}

export function StagingZoneCapacityPanel({ request }: StagingZoneCapacityPanelProps) {
  const { data: result, isLoading } = useStagingZoneCapacity(request)
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

  const zones: StagingZoneCapacity[] | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {zones && (
        <div style={{ padding: '8px 0' }}>
          {zones.map((zone) => {
            const statusColor = STATUS_COLOR[zone.status] ?? 'var(--shell-fg-2)'
            const barColor = capacityBarColor(zone.capacityPercent)
            return (
              <div key={zone.zoneId} style={{ padding: '10px 16px', borderBottom: '1px solid var(--shell-line)', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--shell-fg)', flex: 1 }}>{zone.zoneName}</span>
                  {zone.overflowRisk && (
                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#F57C00', border: '1px solid #F57C00', borderRadius: 4, padding: '1px 5px' }}>Overflow Risk</span>
                  )}
                  <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: statusColor }}>{zone.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, height: 8, background: 'var(--shell-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${zone.capacityPercent}%`, height: '100%', background: barColor, borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: barColor, minWidth: 36 }}>{Math.round(zone.capacityPercent)}%</span>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Staged: {zone.stagedOrders}</span>
                  <span style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>Pending: {zone.pendingOrders}</span>
                  {zone.blockedOrders > 0 && (
                    <span style={{ fontSize: 11, color: '#D32F2F' }}>Blocked: {zone.blockedOrders}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </EvidencePanel>
  )
}
