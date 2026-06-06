import type { CSSProperties } from 'react'
import { StagingShortfallsPanel } from '../panels/staging-shortfalls-panel.js'
import { StagingAlertsPanel } from '../panels/staging-alerts-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

export interface ShortfallsViewProps {
  readonly request: ProductionStagingAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function ShortfallsView({ request }: ShortfallsViewProps) {
  return (
    <div style={GRID}>
      <StagingShortfallsPanel request={request} />
      <StagingAlertsPanel request={request} />
    </div>
  )
}
