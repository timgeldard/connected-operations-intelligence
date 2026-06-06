import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { productionStagingRegistration } from './production-staging-registration.js'
import { ProductionStagingActionsPanel } from './actions/production-staging-actions-panel.js'
import { useProductionStagingContext } from './adapters/production-staging-queries.js'
import type { ProductionStagingAdapterRequest } from './adapters/production-staging-adapter.js'
import { StagingOverviewView } from './views/staging-overview-view.js'
import { OrderStagingView } from './views/order-staging-view.js'
import { ShortfallsView } from './views/shortfalls-view.js'
import { ZoneCapacityView } from './views/zone-capacity-view.js'
import { PickingWavesView } from './views/picking-waves-view.js'
import { MoveRequestsView } from './views/move-requests-view.js'

export type ProductionStagingViewId =
  | 'staging-overview'
  | 'order-staging'
  | 'shortfalls'
  | 'zone-capacity'
  | 'picking-waves'
  | 'move-requests'

export interface ProductionStagingWorkspaceProps {
  readonly scope: ScopeContext
  readonly planDate?: string
  readonly viewId?: string
  readonly onNavigateToWorkspace?: (workspaceId: string) => void
}

export function ProductionStagingWorkspace({
  scope,
  planDate,
  viewId = 'staging-overview',
  onNavigateToWorkspace,
}: ProductionStagingWorkspaceProps) {
  const request: ProductionStagingAdapterRequest = {
    plantId: scope.plantId,
    warehouseId: scope.warehouseId,
    planDate,
  }

  const { data: contextResult } = useProductionStagingContext(request)
  const context = contextResult?.ok ? contextResult.data : null

  return (
    <StandardWorkspaceTemplate
      registration={productionStagingRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'staging-overview'}
      actionSidebar={<ProductionStagingActionsPanel context={context} />}
    >
      {resolveView(viewId, request, onNavigateToWorkspace)}
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: ProductionStagingAdapterRequest, onNavigateToWorkspace?: (workspaceId: string) => void): React.ReactNode {
  switch (viewId as ProductionStagingViewId) {
    case 'staging-overview':
      return <StagingOverviewView request={request} onNavigateToWorkspace={onNavigateToWorkspace} />
    case 'order-staging':
      return <OrderStagingView request={request} />
    case 'shortfalls':
      return <ShortfallsView request={request} />
    case 'zone-capacity':
      return <ZoneCapacityView request={request} />
    case 'picking-waves':
      return <PickingWavesView request={request} />
    case 'move-requests':
      return <MoveRequestsView request={request} />
    default:
      return <StagingOverviewView request={request} />
  }
}

function isValidViewId(viewId: string): viewId is ProductionStagingViewId {
  const valid: ProductionStagingViewId[] = [
    'staging-overview',
    'order-staging',
    'shortfalls',
    'zone-capacity',
    'picking-waves',
    'move-requests',
  ]
  return valid.includes(viewId as ProductionStagingViewId)
}
