import type { CSSProperties } from 'react'
import { MaintenanceBacklogPanel } from '../panels/maintenance-backlog-panel.js'
import { OpenWorkOrdersPanel } from '../panels/open-work-orders-panel.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface BacklogViewProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

export function BacklogView({ request }: BacklogViewProps) {
  return (
    <div style={GRID}>
      <MaintenanceBacklogPanel request={request} />
      <OpenWorkOrdersPanel request={request} />
    </div>
  )
}
