import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { maintenanceReliabilityRegistration } from './maintenance-reliability-registration.js'
import { MaintenanceReliabilityActionsPanel } from './actions/maintenance-reliability-actions-panel.js'
import { useMaintenanceReliabilityContext } from './adapters/maintenance-reliability-queries.js'
import type { MaintenanceReliabilityAdapterRequest } from './adapters/maintenance-reliability-adapter.js'
import { MaintenanceOverviewView } from './views/maintenance-overview-view.js'
import { WorkOrdersView } from './views/work-orders-view.js'
import { PreventiveMaintenanceView } from './views/preventive-maintenance-view.js'
import { EquipmentAvailabilityView } from './views/equipment-availability-view.js'
import { BacklogView } from './views/backlog-view.js'

export type MaintenanceReliabilityViewId =
  | 'overview'
  | 'work-orders'
  | 'preventive-maintenance'
  | 'equipment-availability'
  | 'backlog'

export interface MaintenanceReliabilityWorkspaceProps {
  readonly scope: ScopeContext
  readonly viewId?: string
  readonly onNavigateToView?: (viewId: string) => void
}

export function MaintenanceReliabilityWorkspace({
  scope,
  viewId = 'overview',
  onNavigateToView,
}: MaintenanceReliabilityWorkspaceProps) {
  const request: MaintenanceReliabilityAdapterRequest = {
    plantId: scope.plantId,
    lineId: scope.lineId,
  }

  const { data: contextResult } = useMaintenanceReliabilityContext(request)
  const context = contextResult?.ok ? contextResult.data : null

  return (
    <StandardWorkspaceTemplate
      registration={maintenanceReliabilityRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'overview'}
      actionSidebar={<MaintenanceReliabilityActionsPanel context={context} />}
    >
      {resolveView(viewId, request, onNavigateToView)}
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: MaintenanceReliabilityAdapterRequest, onNavigateToView?: (viewId: string) => void): React.ReactNode {
  switch (viewId as MaintenanceReliabilityViewId) {
    case 'overview':
      return <MaintenanceOverviewView request={request} onNavigateToView={onNavigateToView} />
    case 'work-orders':
      return <WorkOrdersView request={request} />
    case 'preventive-maintenance':
      return <PreventiveMaintenanceView request={request} />
    case 'equipment-availability':
      return <EquipmentAvailabilityView request={request} />
    case 'backlog':
      return <BacklogView request={request} />
    default:
      return <MaintenanceOverviewView request={request} />
  }
}

function isValidViewId(viewId: string): viewId is MaintenanceReliabilityViewId {
  const valid: MaintenanceReliabilityViewId[] = [
    'overview',
    'work-orders',
    'preventive-maintenance',
    'equipment-availability',
    'backlog',
  ]
  return valid.includes(viewId as MaintenanceReliabilityViewId)
}
