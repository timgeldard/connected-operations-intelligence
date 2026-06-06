import type { CSSProperties } from 'react'
import { OpenHoldsPanel } from '../panels/open-holds-panel.js'
import { Warehouse360SummaryPanel } from '../panels/warehouse-360-summary-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface HoldsManagementViewProps {
  readonly request: Warehouse360AdapterRequest
  readonly onHoldNavigate?: (workspaceId: string) => void
}

export function HoldsManagementView({ request, onHoldNavigate }: HoldsManagementViewProps) {
  return (
    <div style={GRID}>
      <OpenHoldsPanel request={request} onHoldNavigate={onHoldNavigate} />
      <Warehouse360SummaryPanel request={request} />
    </div>
  )
}
