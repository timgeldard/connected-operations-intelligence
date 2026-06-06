import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { traceInvestigationRegistration } from './trace-investigation-registration.js'
import { TraceActionsPanel } from './actions/trace-actions-panel.js'
import { OverviewView } from './views/overview-view.js'
import { NetworkOverviewView } from './views/network-overview-view.js'
import { TraceGeniePilotView } from './views/trace-genie-pilot-view.js'
import { TraceTreeView } from './views/trace-tree-view.js'
import { MassBalanceView } from './views/mass-balance-view.js'
import { CustomerExposureView } from './views/customer-exposure-view.js'
import { SupplierExposureView } from './views/supplier-exposure-view.js'
import { TimelineEventsView } from './views/timeline-events-view.js'
import { RecallReadinessView } from './views/recall-readiness-view.js'
import { useTraceInvestigationContext } from './adapters/trace2-queries.js'
import type { Trace2AdapterRequest } from './adapters/trace2-adapter.js'
import { MOCK_INVESTIGATION_ID } from './adapters/trace2-mock-data.js'

/** Valid view identifiers for the Trace Investigation workspace. */
export type TraceInvestigationViewId =
  | 'overview'
  | 'network-overview'
  | 'trace-tree'
  | 'trace-genie-pilot'
  | 'mass-balance'
  | 'customer-exposure'
  | 'supplier-exposure'
  | 'timeline-events'
  | 'recall-readiness'

/** Props for TraceInvestigationWorkspace. */
export interface TraceInvestigationWorkspaceProps {
  /**
   * Active scope context provided by the host shell.
   * Used to pass plant/batch/material context to all child panels.
   */
  readonly scope: ScopeContext
  /**
   * Investigation ID from the URL. Defaults to the mock investigation ID
   * when not provided — enables the workspace to render without a real backend.
   */
  readonly investigationId?: string
  /**
   * Active view tab. Defaults to 'overview'.
   */
  readonly viewId?: string
}

/**
 * Top-level component for the Trace Investigation workspace.
 *
 * @remarks
 * Uses `StandardWorkspaceTemplate` as the mandatory layout wrapper. The
 * active view is determined by `viewId` and rendered inside the template's
 * evidence grid body. The right-hand action sidebar is pre-wired with
 * investigation action flows.
 *
 * All panels source data from the Trace2 adapter via TanStack Query hooks.
 * The adapter request is constructed here and forwarded to every panel —
 * panels do NOT fetch independently without this context.
 *
 * Phase 1: uses realistic mock data. No real backend connection required.
 */
export function TraceInvestigationWorkspace({
  scope,
  investigationId = MOCK_INVESTIGATION_ID,
  viewId = 'overview',
}: TraceInvestigationWorkspaceProps) {
  const request: Trace2AdapterRequest = {
    investigationId,
    batchId: scope.batchId,
    plantId: scope.plantId,
    materialId: scope.materialId,
  }

  const { data: contextResult } = useTraceInvestigationContext(request)
  const context = contextResult?.ok ? contextResult.data : null

  const activeView = resolveView(viewId, request)

  const showActionSidebar =
    viewId !== 'trace-tree' && viewId !== 'trace-genie-pilot' && viewId !== 'network-overview'

  return (
    <StandardWorkspaceTemplate
      registration={traceInvestigationRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'overview'}
      actionSidebar={showActionSidebar ? <TraceActionsPanel context={context} /> : undefined}
    >
      {activeView}
    </StandardWorkspaceTemplate>
  )
}

/**
 * Maps a viewId string to the corresponding React view component.
 *
 * @param viewId - The raw view ID string from the URL.
 * @param request - Adapter request context forwarded to the view's panels.
 * @returns The view component, or the Overview as the default fallback.
 */
function resolveView(viewId: string, request: Trace2AdapterRequest): React.ReactNode {
  switch (viewId as TraceInvestigationViewId) {
    case 'overview':
      return <OverviewView request={request} />
    case 'network-overview':
      return <NetworkOverviewView request={request} />
    case 'trace-tree':
      return <TraceTreeView request={request} />
    case 'trace-genie-pilot':
      return <TraceGeniePilotView request={request} />
    case 'mass-balance':
      return <MassBalanceView request={request} />
    case 'customer-exposure':
      return <CustomerExposureView request={request} />
    case 'supplier-exposure':
      return <SupplierExposureView request={request} />
    case 'timeline-events':
      return <TimelineEventsView request={request} />
    case 'recall-readiness':
      return <RecallReadinessView request={request} />
    default:
      return <OverviewView request={request} />
  }
}

/** Type guard for valid TraceInvestigationViewId values. */
function isValidViewId(viewId: string): viewId is TraceInvestigationViewId {
  const valid: TraceInvestigationViewId[] = [
    'overview',
    'network-overview',
    'trace-tree',
    'trace-genie-pilot',
    'mass-balance',
    'customer-exposure',
    'supplier-exposure',
    'timeline-events',
    'recall-readiness',
  ]
  return valid.includes(viewId as TraceInvestigationViewId)
}
