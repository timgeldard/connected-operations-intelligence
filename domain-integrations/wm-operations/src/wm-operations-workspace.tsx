import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { wmOperationsRegistration } from './wm-operations-registration.js'
import type { WmOperationsAdapterRequest } from './adapters/wm-operations-adapter.js'
import { StagingWorklistView } from './views/staging-worklist-view.js'
import { OrderReadinessView } from './views/order-readiness-view.js'
import { DispensaryView } from './views/dispensary-view.js'
import { StockExplorerView } from './views/stock-explorer-view.js'
import { OutboundView } from './views/outbound-view.js'
import { OperatorsView } from './views/operators-view.js'
import { HandoverView } from './views/handover-view.js'
import { InboundView } from './views/inbound-view.js'
import { StockHealthView } from './views/stock-health-view.js'
import { ReconView } from './views/recon-view.js'
import { CampaignsView } from './views/campaigns-view.js'
import { TrendsView } from './views/trends-view.js'
import { BinCapacityView } from './views/bin-capacity-view.js'
import { MovementsView } from './views/movements-view.js'
import { SlowMoversView } from './views/slow-movers-view.js'
import { MovementControlView } from './views/movement-control-view.js'
import { StagingPaceView } from './views/staging-pace-view.js'
import { ProductionHealthView } from './views/production-health-view.js'
import { QmCommandCentreView } from './views/qm-command-centre-view.js'
import { QmDispositionQueueView } from './views/qm-disposition-queue-view.js'
import { EmptyNote, ViewHeader } from './components/kerry.js'
import './theme/kerry-theme.css'

export type WmOperationsViewId =
  | 'staging-worklist'
  | 'order-readiness'
  | 'dispensary'
  | 'stock-explorer'
  | 'outbound'
  | 'operators'
  | 'handover'
  | 'inbound'
  | 'stock-health'
  | 'recon'
  | 'campaigns'
  | 'trends'
  | 'bin-capacity'
  | 'movements'
  | 'slow-movers'
  | 'movement-control'
  | 'staging-pace'
  | 'production-health'
  | 'qm-command-centre'
  | 'qm-disposition-queue'

export interface WmOperationsWorkspaceProps {
  readonly scope: ScopeContext
  readonly viewId?: string
  /** Shell URL-state setter for switching views (useWorkspaceShellState.setView). */
  readonly onNavigateToView?: (viewId: string) => void
  readonly onNavigateToWorkspace?: (workspaceId: string) => void
  /** Opens the Process Order Review workspace scoped to one order (shell sets scope + workspace). */
  readonly onOpenProcessOrder?: (orderId: string) => void
}

const VIEW_GROUPS: Array<{ label: string; views: Array<{ id: WmOperationsViewId; label: string }> }> = [
  {
    label: 'Execute',
    views: [
      { id: 'staging-worklist', label: 'Staging & Picking' },
      { id: 'outbound', label: 'Outbound' },
      { id: 'dispensary', label: 'Dispensary' },
      { id: 'campaigns', label: 'Campaigns' },
    ],
  },
  {
    label: 'Plan',
    views: [
      { id: 'order-readiness', label: 'Order Readiness' },
      { id: 'staging-pace', label: 'Staging Pace' },
      { id: 'inbound', label: 'Inbound' },
    ],
  },
  {
    label: 'Inventory',
    views: [
      { id: 'stock-explorer', label: 'Stock & Bins' },
      { id: 'stock-health', label: 'Stock Health' },
      { id: 'slow-movers', label: 'Slow Movers' },
      { id: 'bin-capacity', label: 'Bin Capacity' },
    ],
  },
  {
    label: 'Control',
    views: [
      { id: 'handover', label: 'Handover' },
      { id: 'recon', label: 'Reconciliation' },
      { id: 'movement-control', label: 'Movement Control' },
      { id: 'qm-command-centre', label: 'QM Command Centre' },
      { id: 'qm-disposition-queue', label: 'Disposition Queue' },
    ],
  },
  {
    label: 'Insight',
    views: [
      { id: 'operators', label: 'Operators' },
      { id: 'trends', label: 'Trends' },
      { id: 'movements', label: 'Goods Movements' },
      { id: 'production-health', label: 'Production Health' },
    ],
  },
]

const VALID_VIEWS: Array<{ id: WmOperationsViewId; label: string }> = VIEW_GROUPS.flatMap(g => g.views)

function isValidViewId(viewId: string): viewId is WmOperationsViewId {
  return VALID_VIEWS.some(v => v.id === viewId)
}

/** Kerry-styled view switcher — the shell's WorkspaceTabs only update provider-local
 * state, so content navigation must go through the shell URL setter. */
function ViewNav({
  activeViewId,
  onNavigate,
  live,
  onToggleLive,
  lastRefresh,
}: {
  readonly activeViewId: string
  readonly onNavigate?: (viewId: string) => void
  readonly live: boolean
  readonly onToggleLive: () => void
  readonly lastRefresh: string | null
}) {
  if (!onNavigate) return null
  const activeGroup = VIEW_GROUPS.find(g => g.views.some(v => v.id === activeViewId)) ?? VIEW_GROUPS[0]
  return (
    <nav aria-label="WM Operations views" style={{ marginBottom: 18 }}>
      <div className="kw-viewnav" style={{ marginBottom: 8 }}>
        {VIEW_GROUPS.map(group => (
          <button
            key={group.label}
            type="button"
            className={`kw-viewnav-tab kw-viewnav-group${group === activeGroup ? ' kw-viewnav-tab--active' : ''}`}
            onClick={() => onNavigate(group.views[0].id)}
          >
            {group.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastRefresh && <span className="kw-eyebrow">as of {lastRefresh}</span>}
          <button
            type="button"
            className={`kw-viewnav-tab${live ? ' kw-viewnav-tab--active' : ''}`}
            title="Refresh all data every 60 seconds (wall-screen mode)"
            aria-pressed={live}
            onClick={onToggleLive}
          >
            {live ? 'Live 60s' : 'Live off'}
          </button>
        </span>
      </div>
      <div className="kw-viewnav">
        {activeGroup.views.map(view => (
          <button
            key={view.id}
            type="button"
            className={`kw-viewnav-tab${view.id === activeViewId ? ' kw-viewnav-tab--active' : ''}`}
            onClick={() => onNavigate(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>
    </nav>
  )
}

export function WmOperationsWorkspace({
  scope,
  viewId = 'staging-worklist',
  onNavigateToView,
  onOpenProcessOrder,
}: WmOperationsWorkspaceProps) {
  const request: WmOperationsAdapterRequest = {
    plantId: scope.plantId,
    warehouseId: scope.warehouseId,
  }
  const activeViewId = isValidViewId(viewId) ? viewId : 'staging-worklist'
  const queryClient = useQueryClient()
  const [live, setLive] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<string | null>(null)
  useEffect(() => {
    if (!live) return
    const refresh = () => {
      queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith('wm-ops') })
      setLastRefresh(new Date().toLocaleTimeString())
    }
    refresh()
    const id = setInterval(refresh, 60_000)
    return () => clearInterval(id)
  }, [live, queryClient])

  return (
    <StandardWorkspaceTemplate
      registration={wmOperationsRegistration}
      scope={scope}
      defaultViewId={activeViewId}
    >
      <div className="kerry-wm" data-testid="wm-operations-workspace">
        <ViewNav activeViewId={activeViewId} onNavigate={onNavigateToView} live={live} onToggleLive={() => setLive(v => !v)} lastRefresh={lastRefresh} />
        {scope.plantId || scope.warehouseId ? (
          resolveView(activeViewId, request, onNavigateToView, onOpenProcessOrder)
        ) : (
          <>
            <ViewHeader
              eyebrow="WM Operations"
              title="Select a Plant"
              subtitle="Choose a plant or warehouse in the scope bar to load staging, dispensary, and stock tools."
            />
            <EmptyNote>
              No plant selected. Use the scope bar or Ctrl+K — onboarded plants appear in the command palette.
            </EmptyNote>
          </>
        )}
      </div>
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: WmOperationsAdapterRequest, onNavigateToView?: (viewId: string) => void, onOpenProcessOrder?: (orderId: string) => void) {
  switch (viewId as WmOperationsViewId) {
    case 'order-readiness':
      return <OrderReadinessView request={request} onNavigateToView={onNavigateToView} onOpenProcessOrder={onOpenProcessOrder} />
    case 'dispensary':
      return <DispensaryView request={request} />
    case 'stock-explorer':
      return <StockExplorerView request={request} />
    case 'outbound':
      return <OutboundView request={request} />
    case 'operators':
      return <OperatorsView request={request} />
    case 'handover':
      return <HandoverView request={request} />
    case 'inbound':
      return <InboundView request={request} />
    case 'stock-health':
      return <StockHealthView request={request} />
    case 'recon':
      return <ReconView request={request} />
    case 'campaigns':
      return <CampaignsView request={request} />
    case 'trends':
      return <TrendsView request={request} />
    case 'bin-capacity':
      return <BinCapacityView request={request} />
    case 'movements':
      return <MovementsView request={request} />
    case 'slow-movers':
      return <SlowMoversView request={request} />
    case 'movement-control':
      return <MovementControlView request={request} />
    case 'staging-pace':
      return <StagingPaceView request={request} />
    case 'production-health':
      return <ProductionHealthView request={request} onOpenProcessOrder={onOpenProcessOrder} />
    case 'qm-command-centre':
      return <QmCommandCentreView request={request} onOpenProcessOrder={onOpenProcessOrder} />
    case 'qm-disposition-queue':
      return <QmDispositionQueueView request={request} onOpenProcessOrder={onOpenProcessOrder} />
    case 'staging-worklist':
    default:
      return <StagingWorklistView request={request} onOpenProcessOrder={onOpenProcessOrder} />
  }
}
