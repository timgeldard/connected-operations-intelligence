import type { CSSProperties } from 'react'
import { MaintenanceKpiSummaryPanel } from '../panels/maintenance-kpi-summary-panel.js'
import { OpenWorkOrdersPanel } from '../panels/open-work-orders-panel.js'
import { EquipmentAvailabilityPanel } from '../panels/equipment-availability-panel.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface MaintenanceOverviewViewProps {
  readonly request: MaintenanceReliabilityAdapterRequest
  readonly onNavigateToView?: (viewId: string) => void
}

export function MaintenanceOverviewView({ request, onNavigateToView }: MaintenanceOverviewViewProps) {
  return (
    <div style={GRID}>
      <MaintenanceKpiSummaryPanel request={request} />
      <OpenWorkOrdersPanel request={request} onWorkOrderClick={() => onNavigateToView?.('work-orders')} />
      <EquipmentAvailabilityPanel request={request} />
    </div>
  )
}
