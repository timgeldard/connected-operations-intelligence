/**
 * @connectio/di-operations
 *
 * Domain integration package for the Operations workspace.
 * Phase 2: Operations evidence adapter consumed by Quality Batch Release workspace.
 * Phase 5: Process Order Review workspace and POH Consumer.
 */


export { OperationsEvidenceAdapter, operationsEvidenceAdapter, toAdapterError } from './adapters/operations-evidence-adapter.js'
export type { OperationsEvidenceAdapterRequest, OperationsEvidenceAdapterOptions } from './adapters/operations-evidence-adapter.js'

export { useProcessOrderEvidence } from './adapters/operations-evidence-queries.js'

// Evidence panels — Phase 2 (consumed by Batch Release)
export { ProcessOrderEvidencePanel } from './panels/process-order-evidence-panel.js'
export type { ProcessOrderEvidencePanelProps } from './panels/process-order-evidence-panel.js'

// Phase 5 — Process Order Review workspace
export { processOrderReviewRegistration } from './process-order-review-registration.js'
export { ProcessOrderReviewWorkspace } from './process-order-review-workspace.js'
export type {
  ProcessOrderReviewWorkspaceProps,
  ProcessOrderReviewViewId,
} from './process-order-review-workspace.js'

export {
  ProcessOrderReviewAdapter,
  processOrderReviewAdapter,
  toProcessOrderReviewAdapterError,
} from './adapters/process-order-review-adapter.js'
export type {
  ProcessOrderReviewAdapterRequest,
  ProcessOrderReviewAdapterOptions,
} from './adapters/process-order-review-adapter.js'

export {
  useProcessOrderReviewContext,
  useProcessOrderHeader,
  useOrderProgressSummary,
  useExecutionTimeline,
  useOrderQualityContext,
  useOrderStagingContext,
  useRelatedBatchContext,
} from './adapters/process-order-review-queries.js'

export { ProcessOrderHeaderPanel } from './panels/process-order-header-panel.js'
export type { ProcessOrderHeaderPanelProps } from './panels/process-order-header-panel.js'

export { OrderProgressPanel } from './panels/order-progress-panel.js'
export type { OrderProgressPanelProps } from './panels/order-progress-panel.js'

export { ExecutionTimelinePanel } from './panels/execution-timeline-panel.js'
export type { ExecutionTimelinePanelProps } from './panels/execution-timeline-panel.js'

export { PohGeniePilotPanel } from './panels/poh-genie-pilot-panel.js'
export type { PohGeniePilotPanelProps } from './panels/poh-genie-pilot-panel.js'

export { OrderQualityContextPanel } from './panels/order-quality-context-panel.js'
export type { OrderQualityContextPanelProps } from './panels/order-quality-context-panel.js'

export { OrderStagingContextPanel } from './panels/order-staging-context-panel.js'
export type { OrderStagingContextPanelProps } from './panels/order-staging-context-panel.js'

export { RelatedBatchContextPanel } from './panels/related-batch-context-panel.js'
export type { RelatedBatchContextPanelProps } from './panels/related-batch-context-panel.js'

export { OrderOverviewView } from './views/order-overview-view.js'
export type { OrderOverviewViewProps } from './views/order-overview-view.js'

export { ExecutionTimelineView } from './views/execution-timeline-view.js'
export type { ExecutionTimelineViewProps } from './views/execution-timeline-view.js'

export { PohGeniePilotView } from './views/poh-genie-pilot-view.js'
export type { PohGeniePilotViewProps } from './views/poh-genie-pilot-view.js'

export { YieldLossesView } from './views/yield-losses-view.js'
export type { YieldLossesViewProps } from './views/yield-losses-view.js'

export { QualityContextView } from './views/quality-context-view.js'
export type { QualityContextViewProps } from './views/quality-context-view.js'

export { StagingContextView } from './views/staging-context-view.js'
export type { StagingContextViewProps } from './views/staging-context-view.js'

export { RelatedBatchesView } from './views/related-batches-view.js'
export type { RelatedBatchesViewProps } from './views/related-batches-view.js'

export { ProcessOrderReviewActionsPanel } from './actions/process-order-review-actions-panel.js'
export type { ProcessOrderReviewActionsPanelProps } from './actions/process-order-review-actions-panel.js'

export { OrderHistoryView } from './views/order-history-view.js'
export type { OrderHistoryViewProps } from './views/order-history-view.js'

// Consumer POH Workspace
export { pohConsumerRegistration } from './poh-consumer-registration.js'
export { ProcessOrderConsumerWorkspace, ProcessOrderConsumerApp } from './poh-consumer/app.js'

