/**
 * @connectio/di-quality
 *
 * Domain integration package for the Quality workspace.
 * Phase 2: Quality Batch Release workspace, adapters, panels, views, and actions.
 */

export { qualityWorkspaceRegistration } from './registration.js'

export { QualityReleaseAdapter, qualityReleaseAdapter, toAdapterError } from './adapters/quality-release-adapter.js'
export type { QualityReleaseAdapterRequest, QualityReleaseAdapterOptions } from './adapters/quality-release-adapter.js'

export {
  useReleaseContext,
  useReleaseQueue,
  useReleaseSummary,
  useQualityResults,
  useCoAReadiness,
  useDeviations,
  useDecisionHistory,
} from './adapters/quality-release-queries.js'

export {
  QualityBlockersAdapter,
  qualityBlockersAdapter,
  toQualityBlockersAdapterError,
} from './adapters/quality-blockers-adapter.js'
export type {
  QualityBlockersAdapterRequest,
  QualityBlockersAdapterOptions,
} from './adapters/quality-blockers-adapter.js'

export {
  useQualityBlockers,
  useReleaseHoldImpacts,
} from './adapters/quality-blockers-queries.js'

// Evidence panels
export { ReleaseSummaryPanel } from './panels/release-summary-panel.js'
export type { ReleaseSummaryPanelProps } from './panels/release-summary-panel.js'

export { QualityResultsPanel } from './panels/quality-results-panel.js'
export type { QualityResultsPanelProps } from './panels/quality-results-panel.js'

export { CoAReadinessPanel } from './panels/coa-readiness-panel.js'
export type { CoAReadinessPanelProps } from './panels/coa-readiness-panel.js'

export { DeviationsPanel } from './panels/deviations-panel.js'
export type { DeviationsPanelProps } from './panels/deviations-panel.js'

export { DecisionHistoryPanel } from './panels/decision-history-panel.js'
export type { DecisionHistoryPanelProps } from './panels/decision-history-panel.js'

export { ReleaseQueuePanel } from './panels/release-queue-panel.js'
export type { ReleaseQueuePanelProps } from './panels/release-queue-panel.js'

// Workspace + registration
export { batchReleaseRegistration } from './batch-release-registration.js'
export { BatchReleaseWorkspace } from './batch-release-workspace.js'
export type { BatchReleaseWorkspaceProps, BatchReleaseViewId } from './batch-release-workspace.js'

// Views
export { ReleaseQueueView } from './views/release-queue-view.js'
export type { ReleaseQueueViewProps } from './views/release-queue-view.js'

export { BatchDecisionView } from './views/batch-decision-view.js'
export type { BatchDecisionViewProps } from './views/batch-decision-view.js'

export { QualityEvidenceView } from './views/quality-evidence-view.js'
export type { QualityEvidenceViewProps } from './views/quality-evidence-view.js'

export { OperationsEvidenceView } from './views/operations-evidence-view.js'
export type { OperationsEvidenceViewProps } from './views/operations-evidence-view.js'

export { WarehouseTraceEvidenceView } from './views/warehouse-trace-evidence-view.js'
export type { WarehouseTraceEvidenceViewProps } from './views/warehouse-trace-evidence-view.js'

export { DecisionHistoryView } from './views/decision-history-view.js'
export type { DecisionHistoryViewProps } from './views/decision-history-view.js'

// Cross-domain evidence panels — consumed by Operations Plan Risk
export { QualityBlockersPanel } from './panels/quality-blockers-panel.js'
export type { QualityBlockersPanelProps } from './panels/quality-blockers-panel.js'

export { ReleaseHoldImpactPanel } from './panels/release-hold-impact-panel.js'
export type { ReleaseHoldImpactPanelProps } from './panels/release-hold-impact-panel.js'

// Connected Quality Lab Board
export {
  ConnectedQualityLabAdapter,
  toConnectedQualityLabAdapterError,
} from './adapters/connected-quality-lab-adapter.js'
export type {
  ConnectedQualityLabAdapterRequest,
  ConnectedQualityLabAdapterOptions,
} from './adapters/connected-quality-lab-adapter.js'

export { connectedQualityLabAdapterInstance } from './adapters/connected-quality-lab-adapter-factory.js'

export {
  QualityReadOnlyEvidenceAdapter,
} from './adapters/quality-readonly-evidence-adapter.js'
export { qualityReadOnlyEvidenceAdapterInstance } from './adapters/quality-readonly-evidence-adapter-factory.js'
export type {
  QualityReadOnlyEvidenceAdapterRequest,
  QualityReadOnlyEvidenceAdapterOptions,
  QualityEvidenceNowFn,
} from './adapters/quality-readonly-evidence-adapter.js'

export { useQualityReadOnlyEvidence } from './adapters/quality-readonly-evidence-queries.js'

export { QualityReadOnlyEvidencePanel } from './panels/quality-readonly-evidence-panel.js'
export type { QualityReadOnlyEvidencePanelProps } from './panels/quality-readonly-evidence-panel.js'

export {
  useConnectedQualityLabFailures,
  useConnectedQualityLabPlants,
} from './adapters/connected-quality-lab-queries.js'

export { ConnectedQualityLabBoardPanel } from './panels/connected-quality-lab-board-panel.js'
export type { ConnectedQualityLabBoardPanelProps } from './panels/connected-quality-lab-board-panel.js'

export { LabBoardView } from './views/lab-board-view.js'
export type { LabBoardViewProps } from './views/lab-board-view.js'

export { ConnectedQualityLabBoardStandaloneApp } from './lab-board-standalone/app.js'
export { connectedQualityLabBoardStandaloneRegistration } from './lab-board-standalone/registration.js'

// Actions
export { ReleaseActionsPanel, ActionSheet, Field, SheetActions, SuccessMessage, ActionButton } from './actions/release-actions-panel.js'
export type { ReleaseActionsPanelProps, ActionButtonVariant, ActionButtonProps } from './actions/release-actions-panel.js'

export { ReleaseBatchAction } from './actions/release-batch-action.js'
export type { ReleaseBatchActionProps } from './actions/release-batch-action.js'

export { PlaceOnHoldAction } from './actions/place-on-hold-action.js'
export type { PlaceOnHoldActionProps } from './actions/place-on-hold-action.js'

export { RequestRetestAction } from './actions/request-retest-action.js'
export type { RequestRetestActionProps } from './actions/request-retest-action.js'

export { EscalateDeviationAction } from './actions/escalate-deviation-action.js'
export type { EscalateDeviationActionProps } from './actions/escalate-deviation-action.js'

export { OpenTraceInvestigationAction } from './actions/open-trace-investigation-action.js'
export type { OpenTraceInvestigationActionProps } from './actions/open-trace-investigation-action.js'
