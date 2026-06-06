import type { CSSProperties } from 'react'
import { SPCProcessContextPanel } from '../panels/spc-process-context-panel.js'
import { CharacteristicCapabilityPanel } from '../panels/characteristic-capability-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import { SPCSandboxBanner } from './chart-overview-view.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

export interface ChartConfigurationReadonlyViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function ChartConfigurationReadonlyView({ request }: ChartConfigurationReadonlyViewProps) {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <SPCSandboxBanner />
      <div style={GRID}>
        <SPCProcessContextPanel request={request} />
        <CharacteristicCapabilityPanel request={request} />
      </div>
    </div>
  )
}
