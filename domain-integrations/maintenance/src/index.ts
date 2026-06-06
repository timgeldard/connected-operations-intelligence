/**
 * @connectio/di-maintenance
 *
 * Domain integration package for the Maintenance workspace.
 * Phase 3: MaintenanceConstraintsAdapter for Operations Plan Risk cross-domain evidence.
 * Phase 5: Maintenance & Reliability workspace.
 */

export { maintenanceWorkspaceRegistration } from './registration.js'

export {
  MaintenanceConstraintsAdapter,
  maintenanceConstraintsAdapter,
  toMaintenanceAdapterError,
} from './adapters/maintenance-constraints-adapter.js'
export type {
  MaintenanceConstraintsAdapterRequest,
  MaintenanceConstraintsAdapterOptions,
} from './adapters/maintenance-constraints-adapter.js'

export { useMaintenanceConstraints } from './adapters/maintenance-constraints-queries.js'

// Evidence panels
export { MaintenanceConstraintPanel } from './panels/maintenance-constraint-panel.js'
export type { MaintenanceConstraintPanelProps } from './panels/maintenance-constraint-panel.js'

// Phase 5 — Maintenance & Reliability workspace
export { maintenanceReliabilityRegistration } from './maintenance-reliability-registration.js'
export { MaintenanceReliabilityWorkspace } from './maintenance-reliability-workspace.js'
export type {
  MaintenanceReliabilityWorkspaceProps,
  MaintenanceReliabilityViewId,
} from './maintenance-reliability-workspace.js'

export {
  MaintenanceReliabilityAdapter,
  maintenanceReliabilityAdapter,
  toMaintenanceReliabilityAdapterError,
} from './adapters/maintenance-reliability-adapter.js'
export type { MaintenanceReliabilityAdapterRequest } from './adapters/maintenance-reliability-adapter.js'

export {
  useMaintenanceReliabilityContext,
  useMaintenanceKpiSummary,
  useWorkOrders,
  usePreventiveMaintenanceTasks,
  useEquipmentAvailability,
  useReliabilityMetrics,
  useMaintenanceBacklog,
} from './adapters/maintenance-reliability-queries.js'

export { MaintenanceKpiSummaryPanel } from './panels/maintenance-kpi-summary-panel.js'
export { OpenWorkOrdersPanel } from './panels/open-work-orders-panel.js'
export { PreventiveMaintenanceSchedulePanel } from './panels/preventive-maintenance-schedule-panel.js'
export { EquipmentAvailabilityPanel } from './panels/equipment-availability-panel.js'
export { ReliabilityMetricsPanel } from './panels/reliability-metrics-panel.js'
export { MaintenanceBacklogPanel } from './panels/maintenance-backlog-panel.js'

export { MaintenanceOverviewView } from './views/maintenance-overview-view.js'
export { WorkOrdersView } from './views/work-orders-view.js'
export { PreventiveMaintenanceView } from './views/preventive-maintenance-view.js'
export { EquipmentAvailabilityView } from './views/equipment-availability-view.js'
export { BacklogView } from './views/backlog-view.js'

export { MaintenanceReliabilityActionsPanel } from './actions/maintenance-reliability-actions-panel.js'
export type { MaintenanceReliabilityActionsPanelProps } from './actions/maintenance-reliability-actions-panel.js'
