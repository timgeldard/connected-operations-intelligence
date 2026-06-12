/**
 * @connectio/di-warehouse
 *
 * Domain integration package for the Warehouse workspace.
 * Phase 2: Warehouse evidence adapter consumed by Quality Batch Release workspace.
 * Phase 5: Warehouse 360 Overview workspace.
 */


export { WarehouseEvidenceAdapter, warehouseEvidenceAdapter, toAdapterError } from './adapters/warehouse-evidence-adapter.js'
export type { WarehouseEvidenceAdapterRequest, WarehouseEvidenceAdapterOptions } from './adapters/warehouse-evidence-adapter.js'

export { useWarehouseHoldStatus } from './adapters/warehouse-evidence-queries.js'

// Evidence panels
export { WarehouseHoldStatusPanel } from './panels/warehouse-hold-status-panel.js'
export type { WarehouseHoldStatusPanelProps } from './panels/warehouse-hold-status-panel.js'

// Phase 5 — Warehouse 360 Overview workspace
export { warehouse360Registration } from './warehouse-360-registration.js'

export { Warehouse360Workspace } from './warehouse-360-workspace.js'
export type { Warehouse360WorkspaceProps, Warehouse360ViewId } from './warehouse-360-workspace.js'

export {
  Warehouse360Adapter,
  warehouse360Adapter,
  toWarehouse360AdapterError,
} from './adapters/warehouse-360-adapter.js'
export type {
  Warehouse360AdapterRequest,
  Warehouse360AdapterOptions,
} from './adapters/warehouse-360-adapter.js'

export {
  useWarehouse360Context,
  useWarehouse360Summary,
  useStockOverview,
  useOpenHolds,
  useGoodsMovements,
  useReplenishmentNeeds,
  useLocationCapacities,
  useWarehouseOverview,
  useWarehouseInbound,
  useWarehouseOutbound,
  useWarehouseStaging,
  useWarehouseExceptionItems,
} from './adapters/warehouse-360-queries.js'

export { Warehouse360SummaryPanel } from './panels/warehouse-360-summary-panel.js'
export type { Warehouse360SummaryPanelProps } from './panels/warehouse-360-summary-panel.js'

export { StockOverviewPanel } from './panels/stock-overview-panel.js'
export type { StockOverviewPanelProps } from './panels/stock-overview-panel.js'

export { OpenHoldsPanel } from './panels/open-holds-panel.js'
export type { OpenHoldsPanelProps } from './panels/open-holds-panel.js'

export { GoodsMovementActivityPanel } from './panels/goods-movement-activity-panel.js'
export type { GoodsMovementActivityPanelProps } from './panels/goods-movement-activity-panel.js'

export { ReplenishmentNeedsPanel } from './panels/replenishment-needs-panel.js'
export type { ReplenishmentNeedsPanelProps } from './panels/replenishment-needs-panel.js'

export { LocationCapacityPanel } from './panels/location-capacity-panel.js'
export type { LocationCapacityPanelProps } from './panels/location-capacity-panel.js'

export { WarehouseOverviewView } from './views/warehouse-overview-view.js'
export type { WarehouseOverviewViewProps } from './views/warehouse-overview-view.js'

export { StockStatusView } from './views/stock-status-view.js'
export type { StockStatusViewProps } from './views/stock-status-view.js'

export { HoldsManagementView } from './views/holds-management-view.js'
export type { HoldsManagementViewProps } from './views/holds-management-view.js'

export { GoodsMovementsView } from './views/goods-movements-view.js'
export type { GoodsMovementsViewProps } from './views/goods-movements-view.js'

export { ReplenishmentView } from './views/replenishment-view.js'
export type { ReplenishmentViewProps } from './views/replenishment-view.js'

export { WarehouseCockpitView } from './views/warehouse-cockpit-view.js'
export type { WarehouseCockpitViewProps } from './views/warehouse-cockpit-view.js'

export { Warehouse360ActionsPanel } from './actions/warehouse-360-actions-panel.js'
export type { Warehouse360ActionsPanelProps } from './actions/warehouse-360-actions-panel.js'
