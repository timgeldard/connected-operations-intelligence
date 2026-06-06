import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { envmonRegistration } from './envmon-registration.js'
import { EnvMonActionsPanel } from './actions/envmon-actions-panel.js'
import { useEnvMonContext } from './adapters/envmon-queries.js'
import type { EnvMonAdapterRequest } from './adapters/envmon-adapter.js'
import { ScopeOverviewView } from './views/scope-overview-view.js'
import { PlantMonitoringView } from './views/plant-monitoring-view.js'
import { HeatmapView } from './views/heatmap-view.js'
import { AlertsView } from './views/alerts-view.js'
import { SwabVectorsView } from './views/swab-vectors-view.js'
import { TrendsView } from './views/trends-view.js'
import { CorrectiveActionsView } from './views/corrective-actions-view.js'
import { NativeMonitoringView } from './views/native-monitoring-view.js'

export type EnvMonViewId =
  | 'native-monitoring'
  | 'scope-overview'
  | 'plant-monitoring'
  | 'heatmap'
  | 'alerts'
  | 'swab-vectors'
  | 'trends'
  | 'corrective-actions'

export interface EnvMonWorkspaceProps {
  readonly scope: ScopeContext
  readonly regionId?: string
  readonly viewId?: string
}

export function EnvMonWorkspace({
  scope,
  regionId,
  viewId = 'native-monitoring',
}: EnvMonWorkspaceProps) {
  const activeViewId = isValidViewId(viewId) ? viewId : 'native-monitoring'
  const request: EnvMonAdapterRequest = {
    regionId: regionId ?? scope.regionId,
    plantId: scope.plantId,
  }

  const { data: contextResult } = useEnvMonContext(request, {
    enabled: activeViewId !== 'native-monitoring',
  })
  const context = contextResult?.ok ? contextResult.data : null

  return (
    <StandardWorkspaceTemplate
      registration={envmonRegistration}
      scope={scope}
      defaultViewId={activeViewId}
      actionSidebar={activeViewId === 'native-monitoring' ? undefined : <EnvMonActionsPanel context={context} />}
    >
      {resolveView(activeViewId, request)}
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: EnvMonAdapterRequest): React.ReactNode {
  switch (viewId as EnvMonViewId) {
    case 'native-monitoring':
      return <NativeMonitoringView initialPlantId={request.plantId} />
    case 'scope-overview':
      return <ScopeOverviewView request={request} />
    case 'plant-monitoring':
      return <PlantMonitoringView request={request} />
    case 'heatmap':
      return <HeatmapView request={request} />
    case 'alerts':
      return <AlertsView request={request} />
    case 'swab-vectors':
      return <SwabVectorsView request={request} />
    case 'trends':
      return <TrendsView request={request} />
    case 'corrective-actions':
      return <CorrectiveActionsView request={request} />
    default:
      return <ScopeOverviewView request={request} />
  }
}

function isValidViewId(viewId: string): viewId is EnvMonViewId {
  const valid: EnvMonViewId[] = [
    'native-monitoring',
    'scope-overview',
    'plant-monitoring',
    'heatmap',
    'alerts',
    'swab-vectors',
    'trends',
    'corrective-actions',
  ]
  return valid.includes(viewId as EnvMonViewId)
}
