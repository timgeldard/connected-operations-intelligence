import type { CSSProperties } from 'react'
import { StagingOrderListPanel } from '../panels/staging-order-list-panel.js'
import { StagingPickTasksPanel } from '../panels/staging-pick-tasks-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

export interface OrderStagingViewProps {
  readonly request: ProductionStagingAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function OrderStagingView({ request }: OrderStagingViewProps) {
  return (
    <div style={GRID}>
      <StagingOrderListPanel request={request} />
      <StagingPickTasksPanel request={request} />
    </div>
  )
}
