import type { CSSProperties } from 'react'
import { StagingPickingWavesPanel } from '../panels/staging-picking-waves-panel.js'
import { StagingPickTasksPanel } from '../panels/staging-pick-tasks-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

export interface PickingWavesViewProps {
  readonly request: ProductionStagingAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function PickingWavesView({ request }: PickingWavesViewProps) {
  return (
    <div style={GRID}>
      <StagingPickingWavesPanel request={request} />
      <StagingPickTasksPanel request={request} />
    </div>
  )
}
