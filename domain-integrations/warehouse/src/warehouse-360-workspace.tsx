import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { warehouse360Registration } from './warehouse-360-registration.js'
import { Warehouse360ActionsPanel } from './actions/warehouse-360-actions-panel.js'
import { useWarehouse360Context } from './adapters/warehouse-360-queries.js'
import type { Warehouse360AdapterRequest } from './adapters/warehouse-360-adapter.js'
import { WarehouseOverviewView } from './views/warehouse-overview-view.js'
import { StockStatusView } from './views/stock-status-view.js'
import { HoldsManagementView } from './views/holds-management-view.js'
import { GoodsMovementsView } from './views/goods-movements-view.js'
import { ReplenishmentView } from './views/replenishment-view.js'
import { WarehouseCockpitView } from './views/warehouse-cockpit-view.js'
import { WarehouseInitialState } from './components/WarehouseInitialState.js'

export type Warehouse360ViewId =
  | 'warehouse-cockpit'
  | 'warehouse-overview'
  | 'stock-status'
  | 'holds-management'
  | 'goods-movements'
  | 'replenishment'

export interface Warehouse360WorkspaceProps {
  readonly scope: ScopeContext
  readonly viewId?: string
  readonly onNavigateToWorkspace?: (workspaceId: string) => void
}

export function Warehouse360Workspace({
  scope,
  viewId = 'warehouse-cockpit',
  onNavigateToWorkspace,
}: Warehouse360WorkspaceProps) {
  const request: Warehouse360AdapterRequest = {
    warehouseId: scope.warehouseId,
    plantId: scope.plantId,
    storageLocationId: scope.storageLocationId,
  }

  const { data: contextResult } = useWarehouse360Context(request)
  const context = contextResult?.ok ? contextResult.data : null

  if (!scope.warehouseId) {
    return (
      <StandardWorkspaceTemplate
        registration={warehouse360Registration}
        scope={scope}
        defaultViewId="warehouse-cockpit"
      >
        <WarehouseInitialState 
          adapterMode={import.meta.env.VITE_ADAPTER_MODE || 'mock'} 
          onLoadCandidate={() => {
            // In a real shell this would update the scope
            console.info('UAT Candidate Load Requested: WH-LISTOWEL-01 / IE10 / 1001')
          }} 
        />
      </StandardWorkspaceTemplate>
    )
  }

  return (
    <StandardWorkspaceTemplate
      registration={warehouse360Registration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'warehouse-cockpit'}
      actionSidebar={<Warehouse360ActionsPanel context={context} />}
    >
      {resolveView(viewId, request, onNavigateToWorkspace)}
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: Warehouse360AdapterRequest, onNavigateToWorkspace?: (workspaceId: string) => void): React.ReactNode {
  switch (viewId as Warehouse360ViewId) {
    case 'warehouse-cockpit':
      return <WarehouseCockpitView request={request} onHoldNavigate={onNavigateToWorkspace} />
    case 'warehouse-overview':
      return <WarehouseOverviewView request={request} onHoldNavigate={onNavigateToWorkspace} />
    case 'stock-status':
      return <StockStatusView request={request} />
    case 'holds-management':
      return <HoldsManagementView request={request} onHoldNavigate={onNavigateToWorkspace} />
    case 'goods-movements':
      return <GoodsMovementsView request={request} />
    case 'replenishment':
      return <ReplenishmentView request={request} />
    default:
      return <WarehouseCockpitView request={request} onHoldNavigate={onNavigateToWorkspace} />
  }
}

function isValidViewId(viewId: string): viewId is Warehouse360ViewId {
  const valid: Warehouse360ViewId[] = [
    'warehouse-cockpit',
    'warehouse-overview',
    'stock-status',
    'holds-management',
    'goods-movements',
    'replenishment',
  ]
  return valid.includes(viewId as Warehouse360ViewId)
}
