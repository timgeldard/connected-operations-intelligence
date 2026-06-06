import type { CSSProperties } from 'react'
import { GoodsMovementActivityPanel } from '../panels/goods-movement-activity-panel.js'
import { Warehouse360SummaryPanel } from '../panels/warehouse-360-summary-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface GoodsMovementsViewProps {
  readonly request: Warehouse360AdapterRequest
}

export function GoodsMovementsView({ request }: GoodsMovementsViewProps) {
  return (
    <div style={GRID}>
      <GoodsMovementActivityPanel request={request} />
      <Warehouse360SummaryPanel request={request} />
    </div>
  )
}
