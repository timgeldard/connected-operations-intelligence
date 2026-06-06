/**
 * @connectio/di-operations
 *
 * Domain integration package for the Operations workspace.
 * Phase 2: Operations evidence adapter consumed by Quality Batch Release workspace.
 * Phase 3: Operations Plan Risk workspace — full implementation.
 */

export { operationsWorkspaceRegistration } from './registration.js'

// Phase 3 — Operations Plan Risk workspace
export { operationsPlanRiskRegistration } from './operations-plan-risk-registration.js'
export { OperationsPlanRiskWorkspace } from './operations-plan-risk-workspace.js'
export type {
  OperationsPlanRiskWorkspaceProps,
  OperationsPlanRiskViewId,
} from './operations-plan-risk-workspace.js'

export { OperationsEvidenceAdapter, operationsEvidenceAdapter, toAdapterError } from './adapters/operations-evidence-adapter.js'
export type { OperationsEvidenceAdapterRequest, OperationsEvidenceAdapterOptions } from './adapters/operations-evidence-adapter.js'

export { useProcessOrderEvidence } from './adapters/operations-evidence-queries.js'

export {
  OperationsPlanRiskAdapter,
  operationsPlanRiskAdapter,
  toAdapterError as toPlanRiskAdapterError,
} from './adapters/operations-plan-risk-adapter.js'
export type {
  OperationsPlanRiskAdapterRequest,
  OperationsPlanRiskAdapterOptions,
} from './adapters/operations-plan-risk-adapter.js'

export {
  useOperationsPlanRiskContext,
  usePlanRiskSummary,
  useLateOrders,
  useMaterialShortages,
  useLineStatus,
  useScheduleAdherenceSummary,
  useYieldVarianceSummary,
  useShiftHandoverItems,
  useOperationsActionQueue,
} from './adapters/operations-plan-risk-queries.js'

// Evidence panels — Phase 2 (consumed by Batch Release)
export { ProcessOrderEvidencePanel } from './panels/process-order-evidence-panel.js'
export type { ProcessOrderEvidencePanelProps } from './panels/process-order-evidence-panel.js'

// Evidence panels — Phase 3 (Operations Plan Risk)
export { PlanRiskSummaryPanel } from './panels/plan-risk-summary-panel.js'
export type { PlanRiskSummaryPanelProps } from './panels/plan-risk-summary-panel.js'

export { LateOrdersPanel } from './panels/late-orders-panel.js'
export type { LateOrdersPanelProps } from './panels/late-orders-panel.js'

export { MaterialShortagePanel } from './panels/material-shortage-panel.js'
export type { MaterialShortagePanelProps } from './panels/material-shortage-panel.js'

export { LineStatusPanel } from './panels/line-status-panel.js'
export type { LineStatusPanelProps } from './panels/line-status-panel.js'

export { ScheduleAdherencePanel } from './panels/schedule-adherence-panel.js'
export type { ScheduleAdherencePanelProps } from './panels/schedule-adherence-panel.js'

export { YieldVariancePanel } from './panels/yield-variance-panel.js'
export type { YieldVariancePanelProps } from './panels/yield-variance-panel.js'

export { ShiftHandoverPanel } from './panels/shift-handover-panel.js'
export type { ShiftHandoverPanelProps } from './panels/shift-handover-panel.js'

export { OperationsActionQueuePanel } from './panels/operations-action-queue-panel.js'
export type { OperationsActionQueuePanelProps } from './panels/operations-action-queue-panel.js'

// Views — Phase 3
export { PlanOverviewView } from './views/plan-overview-view.js'
export type { PlanOverviewViewProps } from './views/plan-overview-view.js'

export { CriticalBlockersView } from './views/critical-blockers-view.js'
export type { CriticalBlockersViewProps } from './views/critical-blockers-view.js'

export { MaterialStagingRiskView } from './views/material-staging-risk-view.js'
export type { MaterialStagingRiskViewProps } from './views/material-staging-risk-view.js'

export { QualityReleaseBlockersView } from './views/quality-release-blockers-view.js'
export type { QualityReleaseBlockersViewProps } from './views/quality-release-blockers-view.js'

export { LineResourceRiskView } from './views/line-resource-risk-view.js'
export type { LineResourceRiskViewProps } from './views/line-resource-risk-view.js'

export { ScheduleAdherenceView } from './views/schedule-adherence-view.js'
export type { ScheduleAdherenceViewProps } from './views/schedule-adherence-view.js'

export { HandoverActionsView } from './views/handover-actions-view.js'
export type { HandoverActionsViewProps } from './views/handover-actions-view.js'

// Actions — Phase 3
export {
  OperationsPlanRiskActionsPanel,
  ActionSheet,
  Field,
  SheetActions,
  SuccessMessage,
  ActionButton,
} from './actions/operations-plan-risk-actions-panel.js'
export type {
  OperationsPlanRiskActionsPanelProps,
  ActionButtonVariant,
} from './actions/operations-plan-risk-actions-panel.js'

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

