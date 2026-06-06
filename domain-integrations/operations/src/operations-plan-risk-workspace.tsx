import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type {
  ScopeContext,
  OperationsEvidenceAdapterRequest as OperationsPlanRiskAdapterRequest,
  WarehouseEvidenceAdapterRequest as WarehouseStagingAdapterRequest,
  QualityBlockersAdapterRequest,
} from '@connectio/data-contracts'
import { operationsPlanRiskRegistration } from './operations-plan-risk-registration.js'
import { OperationsPlanRiskActionsPanel } from './actions/operations-plan-risk-actions-panel.js'
import { useOperationsPlanRiskContext } from './adapters/operations-plan-risk-queries.js'
import type { MaintenanceConstraintsAdapterRequest } from '@connectio/di-maintenance'
import { PlanOverviewView } from './views/plan-overview-view.js'
import { CriticalBlockersView } from './views/critical-blockers-view.js'
import { MaterialStagingRiskView } from './views/material-staging-risk-view.js'
import { QualityReleaseBlockersView } from './views/quality-release-blockers-view.js'
import { LineResourceRiskView } from './views/line-resource-risk-view.js'
import { ScheduleAdherenceView } from './views/schedule-adherence-view.js'
import { HandoverActionsView } from './views/handover-actions-view.js'

/** Valid view identifiers for the Operations Plan Risk workspace. */
export type OperationsPlanRiskViewId =
  | 'plan-overview'
  | 'critical-blockers'
  | 'material-staging-risk'
  | 'quality-release-blockers'
  | 'line-resource-risk'
  | 'schedule-adherence'
  | 'handover-actions'

/** Props for OperationsPlanRiskWorkspace. */
export interface OperationsPlanRiskWorkspaceProps {
  /**
   * Active scope context provided by the host shell.
   * Used to derive plant context for all cross-domain panels.
   */
  readonly scope: ScopeContext
  /**
   * Plan date in ISO 8601 date format (YYYY-MM-DD). Defaults to today's date.
   * Encoded as `?planDate=X` in the URL.
   */
  readonly planDate?: string
  /**
   * Active view tab. Defaults to 'plan-overview'.
   */
  readonly viewId?: string
  /**
   * Called when an action in the actions panel navigates to the Batch Release workspace.
   * The shell wires this to its URL state updater.
   */
  readonly onNavigateToBatchRelease?: (releaseCaseId: string, viewId?: string) => void
}

/**
 * Top-level component for the Operations Plan Risk workspace.
 *
 * @remarks
 * Uses `StandardWorkspaceTemplate` as the mandatory layout wrapper. The active
 * view is determined by `viewId` and rendered inside the template's evidence
 * grid body. The right-hand action sidebar is pre-wired with operations action
 * flows (escalate, staging request, quality review, handover note, batch release).
 *
 * All four cross-domain adapter requests are derived from `scope` and `planDate`
 * and forwarded to every view. Each domain's adapter provides its own mock data
 * in Phase 3 — no real backend connection is required.
 */
export function OperationsPlanRiskWorkspace({
  scope,
  planDate = new Date().toISOString().slice(0, 10),
  viewId = 'plan-overview',
  onNavigateToBatchRelease,
}: OperationsPlanRiskWorkspaceProps) {
  const opsRequest: OperationsPlanRiskAdapterRequest = {
    plantId: scope.plantId,
    planDate,
  }

  const warehouseRequest: WarehouseStagingAdapterRequest = {
    plantId: scope.plantId,
    planDate,
  }

  const qualityRequest: QualityBlockersAdapterRequest = {
    plantId: scope.plantId,
    planDate,
  }

  const maintenanceRequest: MaintenanceConstraintsAdapterRequest = {
    plantId: scope.plantId,
    planDate,
  }

  const { data: contextResult } = useOperationsPlanRiskContext(opsRequest)
  const context = contextResult?.ok ? contextResult.data : null

  const activeView = resolveView(viewId, {
    opsRequest,
    warehouseRequest,
    qualityRequest,
    maintenanceRequest,
  })

  return (
    <StandardWorkspaceTemplate
      registration={operationsPlanRiskRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'plan-overview'}
      actionSidebar={
        <OperationsPlanRiskActionsPanel
          context={context}
          onNavigateToBatchRelease={onNavigateToBatchRelease}
        />
      }
    >
      {activeView}
    </StandardWorkspaceTemplate>
  )
}

/** All request objects needed by views. */
interface ViewRequests {
  opsRequest: OperationsPlanRiskAdapterRequest
  warehouseRequest: WarehouseStagingAdapterRequest
  qualityRequest: QualityBlockersAdapterRequest
  maintenanceRequest: MaintenanceConstraintsAdapterRequest
}

/**
 * Maps a viewId string to the corresponding React view component.
 *
 * @param viewId - The raw view ID string from the URL.
 * @param requests - All adapter request contexts forwarded to the view.
 * @returns The view component, or PlanOverviewView as the default fallback.
 */
function resolveView(viewId: string, requests: ViewRequests): React.ReactNode {
  const { opsRequest, warehouseRequest, qualityRequest, maintenanceRequest } = requests

  switch (viewId as OperationsPlanRiskViewId) {
    case 'plan-overview':
      return (
        <PlanOverviewView
          opsRequest={opsRequest}
          warehouseRequest={warehouseRequest}
          qualityRequest={qualityRequest}
        />
      )
    case 'critical-blockers':
      return (
        <CriticalBlockersView
          opsRequest={opsRequest}
          qualityRequest={qualityRequest}
          maintenanceRequest={maintenanceRequest}
        />
      )
    case 'material-staging-risk':
      return (
        <MaterialStagingRiskView
          opsRequest={opsRequest}
          warehouseRequest={warehouseRequest}
        />
      )
    case 'quality-release-blockers':
      return (
        <QualityReleaseBlockersView
          opsRequest={opsRequest}
          qualityRequest={qualityRequest}
        />
      )
    case 'line-resource-risk':
      return (
        <LineResourceRiskView
          opsRequest={opsRequest}
          maintenanceRequest={maintenanceRequest}
        />
      )
    case 'schedule-adherence':
      return (
        <ScheduleAdherenceView
          opsRequest={opsRequest}
          qualityRequest={qualityRequest}
        />
      )
    case 'handover-actions':
      return (
        <HandoverActionsView
          opsRequest={opsRequest}
          qualityRequest={qualityRequest}
          maintenanceRequest={maintenanceRequest}
        />
      )
    default:
      return (
        <PlanOverviewView
          opsRequest={opsRequest}
          warehouseRequest={warehouseRequest}
          qualityRequest={qualityRequest}
        />
      )
  }
}

/** Type guard for valid OperationsPlanRiskViewId values. */
function isValidViewId(viewId: string): viewId is OperationsPlanRiskViewId {
  const valid: OperationsPlanRiskViewId[] = [
    'plan-overview',
    'critical-blockers',
    'material-staging-risk',
    'quality-release-blockers',
    'line-resource-risk',
    'schedule-adherence',
    'handover-actions',
  ]
  return valid.includes(viewId as OperationsPlanRiskViewId)
}
