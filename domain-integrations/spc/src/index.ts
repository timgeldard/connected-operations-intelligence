/**
 * @connectio/di-spc
 *
 * Domain integration package for the SPC workspace.
 * Phase 2: SPC signals adapter consumed by Quality Batch Release workspace.
 * Phase 5: SPC Monitoring workspace (pilot) — full monitoring, signals, capability, alarm history.
 */

export { spcWorkspaceRegistration } from './registration.js'

// Phase 2: SPC signals (consumed by quality-batch-release)
export { SPCSignalsAdapter, spcSignalsAdapter, toAdapterError } from './adapters/spc-signals-adapter.js'
export type { SPCSignalsAdapterRequest, SPCSignalsAdapterOptions } from './adapters/spc-signals-adapter.js'
export { useSPCSignals } from './adapters/spc-signals-queries.js'
export { SPCSignalsForReleasePanel } from './panels/spc-signals-for-release-panel.js'
export type { SPCSignalsForReleasePanelProps } from './panels/spc-signals-for-release-panel.js'

// Phase 5: SPC Monitoring workspace
export { spcMonitoringRegistration } from './spc-monitoring-registration.js'
export { SPCMonitoringWorkspace } from './spc-monitoring-workspace.js'
export type { SPCMonitoringWorkspaceProps, SPCMonitoringViewId } from './spc-monitoring-workspace.js'

// SPC Consumer workspace
export { spcConsumerRegistration } from './spc-consumer-registration.js'
export { SPCConsumerWorkspace } from './spc-consumer-workspace.js'

export { SPCMonitoringAdapter, spcMonitoringAdapter, toSPCMonitoringAdapterError } from './adapters/spc-monitoring-adapter.js'
export type { SPCMonitoringAdapterRequest, SPCMonitoringAdapterOptions } from './adapters/spc-monitoring-adapter.js'

export {
  useSPCMonitoringContext,
  useSPCSummary,
  useActiveSPCSignals,
  useControlChartSeries,
  useCharacteristicCapability,
  useSPCAlarmHistory,
  useSPCRelatedBatches,
} from './adapters/spc-monitoring-queries.js'

// Panels
export { SPCSummaryPanel } from './panels/spc-summary-panel.js'
export type { SPCSummaryPanelProps } from './panels/spc-summary-panel.js'
export { ActiveSPCSignalsPanel } from './panels/active-spc-signals-panel.js'
export type { ActiveSPCSignalsPanelProps } from './panels/active-spc-signals-panel.js'
export { ControlChartPanel } from './panels/control-chart-panel.js'
export type { ControlChartPanelProps } from './panels/control-chart-panel.js'
export { CharacteristicCapabilityPanel } from './panels/characteristic-capability-panel.js'
export type { CharacteristicCapabilityPanelProps } from './panels/characteristic-capability-panel.js'
export { SPCAlarmHistoryPanel } from './panels/spc-alarm-history-panel.js'
export type { SPCAlarmHistoryPanelProps } from './panels/spc-alarm-history-panel.js'
export { SPCRelatedBatchesPanel } from './panels/spc-related-batches-panel.js'
export type { SPCRelatedBatchesPanelProps } from './panels/spc-related-batches-panel.js'
export { SPCProcessContextPanel } from './panels/spc-process-context-panel.js'
export type { SPCProcessContextPanelProps } from './panels/spc-process-context-panel.js'

// Views
export { ChartOverviewView } from './views/chart-overview-view.js'
export { ActiveSignalsView } from './views/active-signals-view.js'
export { CharacteristicReviewView } from './views/characteristic-review-view.js'
export { CapabilityView } from './views/capability-view.js'
export { AlarmHistoryView } from './views/alarm-history-view.js'
export { ChartConfigurationReadonlyView } from './views/chart-configuration-readonly-view.js'

// Actions
export { SPCActionsPanel } from './actions/spc-actions-panel.js'
export type { SPCActionsPanelProps } from './actions/spc-actions-panel.js'
