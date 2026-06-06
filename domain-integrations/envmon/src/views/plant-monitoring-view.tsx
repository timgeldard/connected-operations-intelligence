import type { CSSProperties } from 'react'
import { EnvMonSiteSummaryPanel } from '../panels/envmon-site-summary-panel.js'
import { EnvMonZoneStatusPanel } from '../panels/envmon-zone-status-panel.js'
import { EnvMonAlertsPanel } from '../panels/envmon-alerts-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface PlantMonitoringViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function PlantMonitoringView({ request }: PlantMonitoringViewProps) {
  return (
    <div style={GRID}>
      <EnvMonSiteSummaryPanel request={request} />
      <EnvMonZoneStatusPanel request={request} />
      <EnvMonAlertsPanel request={request} />
    </div>
  )
}
