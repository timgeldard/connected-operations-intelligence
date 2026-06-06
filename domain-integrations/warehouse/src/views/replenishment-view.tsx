import type { CSSProperties } from 'react'
import { ReplenishmentNeedsPanel } from '../panels/replenishment-needs-panel.js'
import { StockOverviewPanel } from '../panels/stock-overview-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface ReplenishmentViewProps {
  readonly request: Warehouse360AdapterRequest
}

export function ReplenishmentView({ request }: ReplenishmentViewProps) {
  return (
    <div style={GRID}>
      <ReplenishmentNeedsPanel request={request} />
      <StockOverviewPanel request={request} />
    </div>
  )
}
