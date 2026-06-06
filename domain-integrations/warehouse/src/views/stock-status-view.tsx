import type { CSSProperties } from 'react'
import { StockOverviewPanel } from '../panels/stock-overview-panel.js'
import { LocationCapacityPanel } from '../panels/location-capacity-panel.js'
import { NearExpiryStockPanel } from '../panels/near-expiry-stock-panel.js'
import { WarehouseReconciliationExceptionsPanel } from '../panels/warehouse-reconciliation-exceptions-panel.js'
import type { Warehouse360AdapterRequest } from '../adapters/warehouse-360-adapter.js'
import { useWarehouseExceptions } from '../adapters/warehouse-360-queries.js'

const GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: 12,
  padding: 16,
  alignItems: 'start',
}

export interface StockStatusViewProps {
  readonly request: Warehouse360AdapterRequest
}

export function StockStatusView({ request }: StockStatusViewProps) {
  const exceptionsQuery = useWarehouseExceptions(request)

  return (
    <div style={GRID}>
      <StockOverviewPanel request={request} />
      <NearExpiryStockPanel request={request} />
      <WarehouseReconciliationExceptionsPanel
        result={exceptionsQuery.data}
        isLoading={exceptionsQuery.isLoading}
      />
      <LocationCapacityPanel request={request} />
    </div>
  )
}
