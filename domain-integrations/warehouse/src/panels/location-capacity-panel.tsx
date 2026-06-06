import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { LocationCapacity } from '@connectio/data-contracts'
import { useLocationCapacities } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'location-capacity',
  displayName: 'Location Capacity',
  description: 'Key storage location utilisation — bins, racks, staging lanes, and bulk areas with capacity and block status.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface LocationCapacityPanelProps {
  readonly request: Warehouse360AdapterRequest
}

function CapBar({ value, blocked }: { value: number; blocked: boolean }) {
  const color = blocked ? '#D32F2F' : value > 90 ? '#F57C00' : value > 75 ? '#D97706' : '#2E7D32'
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--shell-surface-2)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 4 }} />
    </div>
  )
}

export function LocationCapacityPanel({ request }: LocationCapacityPanelProps) {
  const { data: result, isLoading } = useLocationCapacities(request)
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

  const locations: LocationCapacity[] = result?.ok ? result.data : []

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {locations.map(loc => (
          <div key={loc.locationId} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 8, borderBottom: '1px solid var(--shell-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--shell-fg)' }}>{loc.locationName}</span>
              {loc.isBlocked && (
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#D32F2F', color: '#fff', fontWeight: 700 }}>BLOCKED</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <CapBar value={loc.utilizationPercent} blocked={loc.isBlocked} />
              <span style={{ fontSize: 11, color: 'var(--shell-fg-2)', whiteSpace: 'nowrap' }}>{loc.utilizationPercent.toFixed(0)}%</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--shell-fg-3)' }}>
              {loc.zoneName} · {loc.locationType}
              {loc.blockReason && ` · ${loc.blockReason}`}
            </div>
          </div>
        ))}
      </div>
    </EvidencePanel>
  )
}
