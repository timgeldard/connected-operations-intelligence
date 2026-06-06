import { useEffect } from 'react'
import { EvidencePanel, useEvidencePanel } from '@connectio/evidence-panel-runtime'
import type { EvidencePanelRegistration } from '@connectio/product-model'
import type { MaintenanceKpiSummary } from '@connectio/data-contracts'
import { useMaintenanceKpiSummary } from '../adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const registration: EvidencePanelRegistration = {
  panelId: 'maintenance-kpi-summary',
  displayName: 'Maintenance Summary',
  description: 'Key maintenance KPIs — open work orders, overdue PM, equipment availability vs target, and backlog hours.',
  ownerDomain: 'maintenance',
  sourceOwnership: { domainId: 'maintenance', systemName: 'cmms', legacyAppId: 'cmms' },
  lifecycle: 'pilot',
  allowedConsumerWorkspaces: ['maintenance-reliability'],
  requiredContext: [{ contextKey: 'plantId', scopeLevel: 'plant', required: true }],
  freshnessPolicy: { staleAfterSeconds: 180, errorAfterSeconds: 600, refreshOnFocus: true, pollIntervalSeconds: null },
  confidencePolicy: { level: 0.92, hidden: false },
  requiredPermissions: [{ permissionId: 'maintenance.overview.read', displayName: 'Maintenance Overview Read' }],
}

export interface MaintenanceKpiSummaryPanelProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

function Tile({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ flex: '1 1 0', minWidth: 72, background: 'var(--shell-surface-2)', borderRadius: 6, padding: '10px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--shell-fg)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--shell-fg-3)', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

export function MaintenanceKpiSummaryPanel({ request }: MaintenanceKpiSummaryPanelProps) {
  const { data: result, isLoading } = useMaintenanceKpiSummary(request)
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

  const data: MaintenanceKpiSummary | null = result?.ok ? result.data : null

  return (
    <EvidencePanel
      registration={registration}
      displayState={displayState}
      errorMessage={!result?.ok ? result?.error.message : undefined}
    >
      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tile label="Open WOs" value={data.openWorkOrders} />
            <Tile label="Overdue" value={data.overdueWorkOrders} color={data.overdueWorkOrders > 0 ? '#D32F2F' : undefined} />
            <Tile label="Critical" value={data.criticalWorkOrders} color={data.criticalWorkOrders > 0 ? '#D97706' : undefined} />
            <Tile label="Done Shift" value={data.completedThisShift} color="#2E7D32" />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tile label="PM Overdue" value={data.overduePreventiveMaintenance} color={data.overduePreventiveMaintenance > 0 ? '#F57C00' : undefined} />
            <Tile label="Availability" value={`${data.equipmentAvailabilityPercent.toFixed(0)}%`} color={data.equipmentAvailabilityPercent < data.targetAvailabilityPercent ? '#D32F2F' : '#2E7D32'} />
            <Tile label="Target %" value={`${data.targetAvailabilityPercent.toFixed(0)}%`} />
            <Tile label="Backlog h" value={`${data.maintenanceBacklogHours}h`} color={data.maintenanceBacklogHours > 40 ? '#D97706' : undefined} />
          </div>
        </div>
      )}
    </EvidencePanel>
  )
}
