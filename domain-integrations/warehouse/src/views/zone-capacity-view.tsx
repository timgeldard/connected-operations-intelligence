import type { CSSProperties } from 'react'
import { StagingZoneCapacityPanel } from '../panels/staging-zone-capacity-panel.js'
import { StagingOrderListPanel } from '../panels/staging-order-list-panel.js'
import type { ProductionStagingAdapterRequest } from '../adapters/production-staging-adapter.js'

export interface ZoneCapacityViewProps {
  readonly request: ProductionStagingAdapterRequest
}

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export function ZoneCapacityView({ request }: ZoneCapacityViewProps) {
  return (
    <div style={GRID}>
      <StagingZoneCapacityPanel request={request} />
      <StagingOrderListPanel request={request} />
    </div>
  )
}
