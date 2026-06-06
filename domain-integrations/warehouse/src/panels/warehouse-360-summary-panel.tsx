import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import { SourceConfidenceStrip, type ExtendedSourceMode } from '@connectio/design-system'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { Warehouse360Summary } from '@connectio/data-contracts'
import { useWarehouse360Summary } from '../adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'warehouse-360-summary',
  displayName: 'Warehouse Summary',
  description: 'High-level warehouse KPIs — stock lines, hold status, open movements, capacity utilisation, and replenishment needs.',
  ownerDomain: 'warehouse',
  sourceOwnership: { domainId: 'warehouse', systemName: 'wms', legacyAppId: 'wms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['warehouse-360-overview'],
  requiredContext: [{ contextKey: 'warehouseId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.95, hidden: false },
  requiredPermissions: [{ permissionId: 'warehouse.overview.read', displayName: 'Warehouse Overview Read' }],
}

const validatedSource = (source: unknown): ExtendedSourceMode => {
  if (source === 'mock' || source === 'legacy-api' || source === 'databricks-api') {
    return source
  }
  return 'unknown'
}

export interface Warehouse360SummaryPanelProps {
  readonly request: Warehouse360AdapterRequest
}

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 72, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--shell-fg)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

export function Warehouse360SummaryPanel({ request }: Warehouse360SummaryPanelProps) {
  const { data: result, isLoading } = useWarehouse360Summary(request)
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

  const data: Warehouse360Summary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
      source={result?.source}
    >
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SourceConfidenceStrip
            mode={validatedSource(result?.source)}
            status="loaded"
            fetchedAt={result?.ok ? result.fetchedAt : undefined}
            style={{ border: 'none', background: 'transparent', padding: '0 0 8px 0', marginBottom: '0' }}
          />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tile label="Stock Lines" value={data.totalStockLines} />
            <Tile label="On Hold" value={data.holdLines} color={data.holdLines > 0 ? '#D97706' : undefined} />
            <Tile label="QI Lines" value={data.qualityInspectionLines} color={data.qualityInspectionLines > 0 ? '#005776' : undefined} />
            <Tile label="Transfers" value={data.openTransfers} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tile label="GR Open" value={data.openGoodsReceipts} />
            <Tile label="GI Open" value={data.openGoodsIssues} />
            <Tile label="Replenishment" value={data.activeReplenishmentNeeds} color={data.activeReplenishmentNeeds > 0 ? '#F57C00' : undefined} />
            <Tile label="Capacity %" value={`${data.capacityUtilizationPercent.toFixed(0)}%`} color={data.capacityUtilizationPercent > 90 ? '#D32F2F' : data.capacityUtilizationPercent > 75 ? '#F57C00' : undefined} />
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
