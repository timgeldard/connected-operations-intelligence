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
  /** Shell URL-state setter for switching views (useWorkspaceShellState.setView). */
  readonly onNavigateToView?: (viewId: string) => void
  readonly onNavigateToWorkspace?: (workspaceId: string) => void
}

const VALID_VIEWS: Array<{ id: WmOperationsViewId; label: string }> = [
  { id: 'staging-worklist', label: 'Staging & Picking' },
  { id: 'order-readiness', label: 'Order Readiness' },
  { id: 'dispensary', label: 'Dispensary' },
  { id: 'stock-explorer', label: 'Stock & Bins' },
]

function isValidViewId(viewId: string): viewId is WmOperationsViewId {
  return VALID_VIEWS.some(v => v.id === viewId)
}

/** Kerry-styled view switcher — the shell's WorkspaceTabs only update provider-local
 * state, so content navigation must go through the shell URL setter. */
function ViewNav({
  activeViewId,
  onNavigate,
}: {
  readonly activeViewId: string
  readonly onNavigate?: (viewId: string) => void
}) {
  if (!onNavigate) return null
  return (
    <nav className="kw-viewnav" aria-label="WM Operations views">
      {VALID_VIEWS.map(view => (
        <button
          key={view.id}
          type="button"
          className={`kw-viewnav-tab${view.id === activeViewId ? ' kw-viewnav-tab--active' : ''}`}
          onClick={() => onNavigate(view.id)}
        >
          {view.label}
        </button>
      ))}
    </nav>
  )
}

export function WmOperationsWorkspace({
  scope,
  viewId = 'staging-worklist',
  onNavigateToView,
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
        <ViewNav activeViewId={viewId} onNavigate={onNavigateToView} />
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
