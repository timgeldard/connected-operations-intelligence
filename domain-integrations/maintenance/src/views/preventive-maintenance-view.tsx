import type { CSSProperties } from 'react'
import { PreventiveMaintenanceSchedulePanel } from '../panels/preventive-maintenance-schedule-panel.js'
import { MaintenanceKpiSummaryPanel } from '../panels/maintenance-kpi-summary-panel.js'
import type { MaintenanceReliabilityAdapterRequest } from '../adapters/maintenance-reliability-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface PreventiveMaintenanceViewProps {
  readonly request: MaintenanceReliabilityAdapterRequest
}

export function PreventiveMaintenanceView({ request }: PreventiveMaintenanceViewProps) {
  return (
    <div style={GRID}>
      <PreventiveMaintenanceSchedulePanel request={request} />
      <MaintenanceKpiSummaryPanel request={request} />
    </div>
  )
}
