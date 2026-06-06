import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { StockOverview } from '@connectio/data-contracts'
import { useStockOverview } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'exception-stock-summary',
  displayName: 'Exception Stock Summary',
  description: 'Blocked locations and per-zone hold percentage — highlights stock under exception or restriction.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 300, errorAfterSeconds: 900, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.9, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

export interface ExceptionStockSummaryPanelProps {
  readonly request: Warehouse360AdapterRequest
}

function LocationTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 72, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--shell-fg)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

function holdColor(holdPct: number): string | undefined {
  if (holdPct >= 10) return '#D32F2F'
  if (holdPct >= 5) return '#F57C00'
  return undefined
}

function capacityColor(capPct: number): string | undefined {
  if (capPct >= 90) return '#D32F2F'
  if (capPct >= 75) return '#F57C00'
  return undefined
}

export function ExceptionStockSummaryPanel({ request }: ExceptionStockSummaryPanelProps) {
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
        <div style={{ padding: '12px 16px', display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <LocationTile label="Total Locations" value={data.totalStorageLocations} />
            <LocationTile label="Occupied" value={data.occupiedLocations} />
            <LocationTile label="Blocked" value={data.blockedLocations} color={data.blockedLocations > 0 ? '#D32F2F' : undefined} />
          </div>

          {data.zones.length > 0 && (
            <div style={{ borderTop: '1px solid var(--shell-line)', paddingTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', marginBottom: 8 }}>
                Zone breakdown
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                {data.zones.map((zone) => (
                  <div key={zone.zoneId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ flex: 1, color: 'var(--shell-fg-2)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {zone.zoneName}
                    </span>
                    <span style={{ fontWeight: 600, color: capacityColor(zone.capacityPercent) ?? 'var(--shell-fg)', minWidth: 48, textAlign: 'right' }}>
                      {zone.capacityPercent}% cap
                    </span>
                    <span style={{ fontWeight: 600, color: holdColor(zone.holdPercent) ?? 'var(--shell-fg-3)', minWidth: 54, textAlign: 'right' }}>
                      {zone.holdPercent.toFixed(1)}% hold
                    </span>
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
