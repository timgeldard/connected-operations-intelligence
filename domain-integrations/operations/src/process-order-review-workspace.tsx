import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { processOrderReviewRegistration } from './process-order-review-registration.js'
import { ProcessOrderReviewActionsPanel } from './actions/process-order-review-actions-panel.js'
import { useProcessOrderReviewContext } from './adapters/process-order-review-queries.js'
import type { ProcessOrderReviewAdapterRequest } from './adapters/process-order-review-adapter.js'
import { OrderHistoryView } from './views/order-history-view.js'
import { OrderOverviewView } from './views/order-overview-view.js'
import { ExecutionTimelineView } from './views/execution-timeline-view.js'
import { PohGeniePilotView } from './views/poh-genie-pilot-view.js'
import { YieldLossesView } from './views/yield-losses-view.js'
import { QualityContextView } from './views/quality-context-view.js'
import { StagingContextView } from './views/staging-context-view.js'
import { RelatedBatchesView } from './views/related-batches-view.js'

export type ProcessOrderReviewViewId =
  | 'order-history'
  | 'order-overview'
  | 'execution-timeline'
  | 'poh-genie-pilot'
  | 'yield-losses'
  | 'quality-context'
  | 'staging-context'
  | 'related-batches'

export interface ProcessOrderReviewWorkspaceProps {
  readonly scope: ScopeContext
  readonly viewId?: string
}

export function ProcessOrderReviewWorkspace({
  scope,
  viewId = 'order-history',
}: ProcessOrderReviewWorkspaceProps) {
  const request: ProcessOrderReviewAdapterRequest = {
    processOrderId: scope.processOrderId,
    plantId: scope.plantId,
    lineId: scope.lineId,
    batchId: scope.batchId,
    materialId: scope.materialId,
  }

  const { data: contextResult } = useProcessOrderReviewContext(request)
  const context = contextResult?.ok ? contextResult.data : null

  return (
    <StandardWorkspaceTemplate
      registration={processOrderReviewRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'order-history'}
      actionSidebar={<ProcessOrderReviewActionsPanel context={context} />}
    >
      {resolveView(viewId, request)}
    </StandardWorkspaceTemplate>
  )
}

function resolveView(viewId: string, request: ProcessOrderReviewAdapterRequest): React.ReactNode {
  switch (viewId as ProcessOrderReviewViewId) {
    case 'order-history':
      return <OrderHistoryView request={request} />
    case 'order-overview':
      return <OrderOverviewView request={request} />
    case 'execution-timeline':
      return <ExecutionTimelineView request={request} />
    case 'poh-genie-pilot':
      return <PohGeniePilotView request={request} />
    case 'yield-losses':
      return <YieldLossesView request={request} />
    case 'quality-context':
      return <QualityContextView request={request} />
    case 'staging-context':
      return <StagingContextView request={request} />
    case 'related-batches':
      return <RelatedBatchesView request={request} />
    default:
      return <OrderHistoryView request={request} />
  }
}

function isValidViewId(viewId: string): viewId is ProcessOrderReviewViewId {
  const valid: ProcessOrderReviewViewId[] = [
    'order-history',
    'order-overview',
    'execution-timeline',
    'poh-genie-pilot',
    'yield-losses',
    'quality-context',
    'staging-context',
    'related-batches',
  ]
  return valid.includes(viewId as ProcessOrderReviewViewId)
}
