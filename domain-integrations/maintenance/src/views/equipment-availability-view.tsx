import type { CSSProperties } from 'react'
import { EquipmentAvailabilityPanel } from '../panels/equipment-availability-panel.js'
import { ReliabilityMetricsPanel } from '../panels/reliability-metrics-panel.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface EquipmentAvailabilityViewProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

export function EquipmentAvailabilityView({ request }: EquipmentAvailabilityViewProps) {
  return (
    <div style={GRID}>
      <EquipmentAvailabilityPanel request={request} />
      <ReliabilityMetricsPanel request={request} />
    </div>
  )
}
