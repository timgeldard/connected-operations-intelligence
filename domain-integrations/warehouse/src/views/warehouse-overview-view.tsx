import type { CSSProperties } from 'react'
import { Warehouse360SummaryPanel } from '../panels/warehouse-360-summary-panel.js'
import { StockOverviewPanel } from '../panels/stock-overview-panel.js'
import { OpenHoldsPanel } from '../panels/open-holds-panel.js'
import { ExceptionStockSummaryPanel } from '../panels/exception-stock-summary-panel.js'
import { InboundOutboundSummaryPanel } from '../panels/inbound-outbound-summary-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface WarehouseOverviewViewProps {
  readonly request: Warehouse360AdapterRequest
  readonly onHoldNavigate?: (workspaceId: string) => void
}

export function WarehouseOverviewView({ request, onHoldNavigate }: WarehouseOverviewViewProps) {
  return (
    <div style={GRID}>
      <Warehouse360SummaryPanel request={request} />
      <ExceptionStockSummaryPanel request={request} />
      <InboundOutboundSummaryPanel request={request} />
      <StockOverviewPanel request={request} />
      <OpenHoldsPanel request={request} onHoldNavigate={onHoldNavigate} />
    </div>
  )
}
