/**
 * @connectio/di-traceability
 *
 * Domain integration package for the Traceability domain.
 * Exports:
 * - Phase 0: Traceability workspace (batch trace + lineage stubs)
 * - Phase 1: Trace Investigation workspace (full 7-view, 8-panel implementation)
 */

// ---------------------------------------------------------------------------
// Phase 0 — Traceability workspace (batch trace + lineage stubs)
// ---------------------------------------------------------------------------

export { traceabilityWorkspaceRegistration } from './registration.js'
export { TraceabilityWorkspace } from './TraceabilityWorkspace.js'
export type { TraceabilityWorkspaceProps } from './TraceabilityWorkspace.js'

export { TraceExposureSummaryPanel } from './panels/TraceExposureSummaryPanel.js'
export type { TraceExposureSummaryPanelProps } from './panels/TraceExposureSummaryPanel.js'

export { BatchLineagePanel } from './panels/BatchLineagePanel.js'
export type { BatchLineagePanelProps } from './panels/BatchLineagePanel.js'

export { createTraceabilityClient } from './traceabilityClient.js'
export type { BatchLineage } from './traceabilityClient.js'

// ---------------------------------------------------------------------------
// Phase 1 — Trace Investigation workspace
// ---------------------------------------------------------------------------

export { traceInvestigationRegistration } from './trace-investigation-registration.js'
export { TraceInvestigationWorkspace } from './trace-investigation-workspace.js'
export type {
  TraceInvestigationWorkspaceProps,
  TraceInvestigationViewId,
} from './trace-investigation-workspace.js'

// ---------------------------------------------------------------------------
// Phase 5 — Trace App workspace (search-driven standalone, pilot)
// ---------------------------------------------------------------------------

export { traceAppRegistration } from './trace-app-registration.js'
export { traceConsumerRegistration } from './trace-consumer-registration.js'
export { TraceAppWorkspace } from './trace-app-workspace.js'
export { TraceConsumerWorkspace, TraceConsumerApp } from './trace-consumer/app.js'
export type { TraceAppWorkspaceProps } from './trace-app-workspace.js'
export { PLANTS, TRACE_APP_TABS } from './trace-app/plants.js'
export type {
  PlantDescriptor,
  TraceAppTabId,
  TraceAppTabDescriptor,
} from './trace-app/plants.js'

// Evidence panels
export { BatchHeaderPanel } from './panels/batch-header-panel.js'
export type { BatchHeaderPanelProps } from './panels/batch-header-panel.js'

export { TraceGraphPanel } from './panels/trace-graph-panel.js'
export type { TraceGraphPanelProps } from './panels/trace-graph-panel.js'

export { TraceGeniePilotPanel } from './panels/trace-genie-pilot-panel.js'
export type { TraceGeniePilotPanelProps } from './panels/trace-genie-pilot-panel.js'

export { MaterialSupplierExposurePanel } from './panels/material-supplier-exposure-panel.js'
export type { MaterialSupplierExposurePanelProps } from './panels/material-supplier-exposure-panel.js'

export { ProductionHistoryPanel } from './panels/production-history-panel.js'
export type { ProductionHistoryPanelProps } from './panels/production-history-panel.js'

export { CustomerImpactPanel } from './panels/customer-impact-panel.js'
export type { CustomerImpactPanelProps } from './panels/customer-impact-panel.js'

export { EventTimelinePanel } from './panels/event-timeline-panel.js'
export type { EventTimelinePanelProps } from './panels/event-timeline-panel.js'

export { CoAReleaseStatusPanel } from './panels/coa-release-status-panel.js'
export type { CoAReleaseStatusPanelProps } from './panels/coa-release-status-panel.js'

export { RelatedInvestigationsPanel } from './panels/related-investigations-panel.js'
export type { RelatedInvestigationsPanelProps } from './panels/related-investigations-panel.js'

export { RiskSignalsPanel } from './panels/risk-signals-panel.js'
export type { RiskSignalsPanelProps } from './panels/risk-signals-panel.js'

export { TraceExposureForReleasePanel } from './panels/trace-exposure-for-release-panel.js'
export type { TraceExposureForReleasePanelProps } from './panels/trace-exposure-for-release-panel.js'

// Network view panels (Investigation Overview Network)
export { BatchHeaderNetworkPanel } from './panels/batch-header-network-panel.js'
export type {
  BatchHeaderNetworkPanelProps,
  StockBucket,
} from './panels/batch-header-network-panel.js'

export { CustomerExposureNetworkPanel } from './panels/customer-exposure-network-panel.js'
export type { CustomerExposureNetworkPanelProps } from './panels/customer-exposure-network-panel.js'

export { TraceGraphNetworkPanel } from './panels/trace-graph-network-panel.js'
export type {
  TraceGraphNetworkPanelProps,
  RiskFilter,
} from './panels/trace-graph-network-panel.js'

// Forms
export { TraceQueryForm } from './forms/trace-query-form.js'
export type { TraceQueryFormProps } from './forms/trace-query-form.js'

// Views
export { TraceGeniePilotView } from './views/trace-genie-pilot-view.js'
export type { TraceGeniePilotViewProps } from './views/trace-genie-pilot-view.js'

export { NetworkOverviewView } from './views/network-overview-view.js'
export type { NetworkOverviewViewProps } from './views/network-overview-view.js'

// Adapter and queries
export { Trace2Adapter, trace2Adapter } from './adapters/trace2-adapter.js'
export type { Trace2AdapterRequest } from './adapters/trace2-adapter.js'
export {
  useTraceInvestigationContext,
  useBatchHeaderSummary,
  useTraceGraph,
  useMassBalanceSummary,
  useCustomerExposureSummary,
  useSupplierExposureSummary,
  useProductionHistory,
  useTraceEvents,
  useCoAReleaseStatus,
  useRiskSignals,
  useRelatedInvestigations,
  useTraceExposureForRelease,
} from './adapters/trace2-queries.js'
