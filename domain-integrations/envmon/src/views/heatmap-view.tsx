import type { CSSProperties } from 'react'
import { EnvMonHeatmapPanel } from '../panels/envmon-heatmap-panel.js'
import { EnvMonZoneStatusPanel } from '../panels/envmon-zone-status-panel.js'
import type { EnvMonAdapterRequest } from '../adapters/envmon-adapter.js'

export interface HeatmapViewProps {
  readonly request: EnvMonAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function HeatmapView({ request }: HeatmapViewProps) {
  return (
    <div style={GRID}>
      <EnvMonHeatmapPanel request={request} />
      <EnvMonZoneStatusPanel request={request} />
    </div>
  )
}
