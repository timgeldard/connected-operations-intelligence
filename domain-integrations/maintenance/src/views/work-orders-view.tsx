import type { CSSProperties } from 'react'
import { OpenWorkOrdersPanel } from '../panels/open-work-orders-panel.js'
import { MaintenanceBacklogPanel } from '../panels/maintenance-backlog-panel.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface WorkOrdersViewProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

export function WorkOrdersView({ request }: WorkOrdersViewProps) {
  return (
    <div style={GRID}>
      <OpenWorkOrdersPanel request={request} />
      <MaintenanceBacklogPanel request={request} />
    </div>
  )
}
