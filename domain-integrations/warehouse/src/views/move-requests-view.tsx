import type { CSSProperties } from 'react'
import { StagingMoveRequestsPanel } from '../panels/staging-move-requests-panel.js'
import { StagingShortfallsPanel } from '../panels/staging-shortfalls-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

export interface MoveRequestsViewProps {
  readonly request: ProductionStagingAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function MoveRequestsView({ request }: MoveRequestsViewProps) {
  return (
    <div style={GRID}>
      <StagingMoveRequestsPanel request={request} />
      <StagingShortfallsPanel request={request} />
    </div>
  )
}
