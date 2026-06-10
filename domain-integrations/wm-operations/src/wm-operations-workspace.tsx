import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { wmOperationsRegistration } from './wm-operations-registration.js'
import type { WmOperationsAdapterRequest } from './adapters/wm-operations-adapter.js'
import { StagingWorklistView } from './views/staging-worklist-view.js'
import { OrderReadinessView } from './views/order-readiness-view.js'
import { DispensaryView } from './views/dispensary-view.js'
import { StockExplorerView } from './views/stock-explorer-view.js'
import { EmptyNote, ViewHeader } from './components/kerry.js'
import './theme/kerry-theme.css'

export type WmOperationsViewId =
  | 'staging-worklist'
  | 'order-readiness'
  | 'dispensary'
  | 'stock-explorer'

export interface WmOperationsWorkspaceProps {
  readonly scope: ScopeContext
  readonly viewId?: string
  readonly onNavigateToWorkspace?: (workspaceId: string) => void
}

const VALID_VIEWS: WmOperationsViewId[] = [
  'staging-worklist',
  'order-readiness',
  'dispensary',
  'stock-explorer',
]

function isValidViewId(viewId: string): viewId is WmOperationsViewId {
  return VALID_VIEWS.includes(viewId as WmOperationsViewId)
}

export function WmOperationsWorkspace({
  scope,
  viewId = 'staging-worklist',
}: WmOperationsWorkspaceProps) {
  const request: WmOperationsAdapterRequest = {
    plantId: scope.plantId,
    warehouseId: scope.warehouseId,
  }

  return (
    <StandardWorkspaceTemplate
      registration={wmOperationsRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'staging-worklist'}
    >
      <div className="kerry-wm" data-testid="wm-operations-workspace">
        {scope.plantId || scope.warehouseId ? (
          resolveView(viewId, request)
        ) : (
          <>
            <ViewHeader
              eyebrow="WM Operations"
              title="Select a Plant"
              subtitle="Choose a plant or warehouse in the scope bar to load staging, dispensary, and stock tools."
            />
            <EmptyNote>
              No plant selected. Use the scope bar (or Ctrl+K → “WM Operations”) to pick
              Portbury (C061 · WH 104) or Jackson (P817 · WH 208).
            </EmptyNote>
          </>
        )}
      </div>
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: WmOperationsAdapterRequest) {
  switch (viewId as WmOperationsViewId) {
    case 'order-readiness':
      return <OrderReadinessView request={request} />
    case 'dispensary':
      return <DispensaryView request={request} />
    case 'stock-explorer':
      return <StockExplorerView request={request} />
    case 'staging-worklist':
    default:
      return <StagingWorklistView request={request} />
  }
}
