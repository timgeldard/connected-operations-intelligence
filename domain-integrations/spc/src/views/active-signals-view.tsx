import type { CSSProperties } from 'react'
import { ActiveSPCSignalsPanel } from '../panels/active-spc-signals-panel.js'
import { SPCProcessContextPanel } from '../panels/spc-process-context-panel.js'
import type { SPCMonitoringAdapterRequest } from '../adapters/spc-monitoring-adapter.js'
import { SPCSandboxBanner } from './chart-overview-view.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  alignItems: 'start',
}

export interface ActiveSignalsViewProps {
  readonly request: SPCMonitoringAdapterRequest
}

export function ActiveSignalsView({ request }: ActiveSignalsViewProps) {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <SPCSandboxBanner />
      <div style={GRID}>
        <ActiveSPCSignalsPanel request={request} />
        <SPCProcessContextPanel request={request} />
      </div>
    </div>
  )
}
