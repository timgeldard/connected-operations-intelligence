import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StockOverview } from '@connectio/data-contracts'
import { useStockOverview } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'stock-overview',
  displayName: 'Stock Overview',
  description: 'Warehouse stock by zone — lines, capacity utilisation, and hold percentage per zone.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.93, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface StockOverviewPanelProps {
  readonly request: Warehouse360AdapterRequest
}

const ROW: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 60px 80px 70px', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--shell-line)', fontSize: 12 }
const HDR: React.CSSProperties = { ...ROW, fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--shell-fg-3)', borderBottom: '2px solid var(--shell-line)' }

function CapBar({ value }: { value: number }) {
  const color = value > 90 ? '#D32F2F' : value > 75 ? '#F57C00' : '#2E7D32'
  return (
    <div style={{ position: 'relative', height: 8, background: 'var(--shell-surface-2)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${value}%`, background: color, borderRadius: 4 }} />
    </div>
  )
}

export function StockOverviewPanel({ request }: StockOverviewPanelProps) {
  const { data: result, isLoading } = useStockOverview(request)
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

  const data: StockOverview | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={HDR}>
            <span>Zone</span>
            <span style={{ textAlign: 'right' }}>Lines</span>
            <span>Capacity</span>
            <span style={{ textAlign: 'right' }}>Hold %</span>
          </div>
          {data.zones.map(zone => (
            <div key={zone.zoneId} style={ROW}>
              <span style={{ color: 'var(--shell-fg)', fontSize: 12 }}>{zone.zoneName}</span>
              <span style={{ textAlign: 'right', color: 'var(--shell-fg-2)' }}>{zone.stockLines}</span>
              <div>
                <CapBar value={zone.capacityPercent} />
                <span style={{ fontSize: 10, color: 'var(--shell-fg-3)' }}>{zone.capacityPercent}%</span>
              </div>
              <span style={{ textAlign: 'right', color: zone.holdPercent > 10 ? '#D97706' : 'var(--shell-fg-2)' }}>{zone.holdPercent.toFixed(1)}%</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 16, paddingTop: 8, fontSize: 11, color: 'var(--shell-fg-3)' }}>
            <span>Locations: {data.occupiedLocations}/{data.totalStorageLocations}</span>
            <span style={{ color: data.blockedLocations > 0 ? '#D97706' : 'var(--shell-fg-3)' }}>Blocked: {data.blockedLocations}</span>
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
