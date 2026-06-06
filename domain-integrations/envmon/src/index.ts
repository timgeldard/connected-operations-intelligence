/**
 * @connectio/di-envmon
 *
 * Domain integration package for the Environmental Monitoring workspace.
 * Phase 4: Full implementation with 9 adapter methods, 8 evidence panels, 7 views, 4 action flows.
 */

export { envmonRegistration } from './envmon-registration.js'
export { envmonWorkspaceRegistration } from './registration.js'
export { envmonConsumerRegistration } from './envmon-consumer-registration.js'

export { EnvMonWorkspace } from './envmon-workspace.js'
export type { EnvMonWorkspaceProps, EnvMonViewId } from './envmon-workspace.js'

export { EnvMonConsumerWorkspace } from './envmon-consumer-workspace.js'
export type { EnvMonConsumerWorkspaceProps } from './envmon-consumer-workspace.js'

// Adapter
export {
  EnvMonAdapter,
  envmonAdapter,
  toEnvMonAdapterError,
} from './adapters/envmon-adapter.js'
export type {
  EnvMonAdapterRequest,
  EnvMonAdapterOptions,
  EnvMonNativeSwabStatus,
} from './adapters/envmon-adapter.js'
export type { EnvMonNativeSwabResult } from '@connectio/data-contracts'

// Query hooks
export {
  useEnvMonContext,
  useEnvMonSiteSummary,
  useEnvMonZones,
  useEnvMonAlerts,
  useEnvMonSwabResults,
  useEnvMonTrends,
  useEnvMonHeatmap,
  useEnvMonCorrectiveActions,
  useEnvMonSwabVectors,
} from './adapters/envmon-queries.js'

// Panels
export { EnvMonSiteSummaryPanel } from './panels/envmon-site-summary-panel.js'
export type { EnvMonSiteSummaryPanelProps } from './panels/envmon-site-summary-panel.js'

export { EnvMonZoneStatusPanel } from './panels/envmon-zone-status-panel.js'
export type { EnvMonZoneStatusPanelProps } from './panels/envmon-zone-status-panel.js'

export { EnvMonAlertsPanel } from './panels/envmon-alerts-panel.js'
export type { EnvMonAlertsPanelProps } from './panels/envmon-alerts-panel.js'

export { EnvMonHeatmapPanel } from './panels/envmon-heatmap-panel.js'
export type { EnvMonHeatmapPanelProps } from './panels/envmon-heatmap-panel.js'

export { EnvMonSwabResultsPanel } from './panels/envmon-swab-results-panel.js'
export type { EnvMonSwabResultsPanelProps } from './panels/envmon-swab-results-panel.js'

export { EnvMonTrendsPanel } from './panels/envmon-trends-panel.js'
export type { EnvMonTrendsPanelProps } from './panels/envmon-trends-panel.js'

export { EnvMonCorrectiveActionsPanel } from './panels/envmon-corrective-actions-panel.js'
export type { EnvMonCorrectiveActionsPanelProps } from './panels/envmon-corrective-actions-panel.js'

export { EnvMonSwabVectorsPanel } from './panels/envmon-swab-vectors-panel.js'
export type { EnvMonSwabVectorsPanelProps } from './panels/envmon-swab-vectors-panel.js'

// Views
export { ScopeOverviewView } from './views/scope-overview-view.js'
export { PlantMonitoringView } from './views/plant-monitoring-view.js'
export { HeatmapView } from './views/heatmap-view.js'
export { AlertsView } from './views/alerts-view.js'
export { SwabVectorsView } from './views/swab-vectors-view.js'
export { TrendsView } from './views/trends-view.js'
export { CorrectiveActionsView } from './views/corrective-actions-view.js'
export { NativeMonitoringView } from './views/native-monitoring-view.js'

// Actions
export { EnvMonActionsPanel } from './actions/envmon-actions-panel.js'
export type { EnvMonActionsPanelProps } from './actions/envmon-actions-panel.js'
