import type { CSSProperties } from 'react'
import { EnvMonSiteSummaryPanel } from '../panels/envmon-site-summary-panel.js'
import { EnvMonAlertsPanel } from '../panels/envmon-alerts-panel.js'
import { EnvMonHeatmapPanel } from '../panels/envmon-heatmap-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface ScopeOverviewViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function ScopeOverviewView({ request }: ScopeOverviewViewProps) {
  return (
    <div style={GRID}>
      <EnvMonSiteSummaryPanel request={request} />
      <EnvMonAlertsPanel request={request} />
      <EnvMonHeatmapPanel request={request} />
    </div>
  )
}
