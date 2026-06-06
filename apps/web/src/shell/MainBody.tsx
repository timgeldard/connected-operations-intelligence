import { Suspense, lazy } from 'react'
import { isWorkspaceFlagEnabled } from '@connectio/feature-flags'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'
import { workspaceRegistry } from '../registry/workspace-registry.js'
import { RoleAwareHome } from '../pages/RoleAwareHome.js'
import { NotFound } from '../pages/NotFound.js'
import { AdminGovernancePage } from '../pages/AdminGovernancePage.js'
import { LegacyRetirementPage } from '../pages/LegacyRetirementPage.js'
import { ProductionReadinessPage } from '../pages/ProductionReadinessPage.js'
import { WorkspaceParityPage } from '../pages/WorkspaceParityPage.js'
import { CutoverSimulationPage } from '../pages/CutoverSimulationPage.js'
import { RoleScopeMatrixPage } from '../pages/RoleScopeMatrixPage.js'
import { DesignSystemCompliancePage } from '../pages/DesignSystemCompliancePage.js'
import { TelemetryDashboardPage } from '../pages/TelemetryDashboardPage.js'
import { PilotWorkspacePackPage } from '../pages/PilotWorkspacePackPage.js'
import { ScenarioValidationPage } from '../pages/ScenarioValidationPage.js'
import { FeedbackTriagePage } from '../pages/FeedbackTriagePage.js'
import { StakeholderSignoffPage } from '../pages/StakeholderSignoffPage.js'
import { ReleaseGatePage } from '../pages/ReleaseGatePage.js'
import { PilotExitCriteriaPage } from '../pages/PilotExitCriteriaPage.js'
import { DataIntegrationReadinessPage } from '../pages/DataIntegrationReadinessPage.js'
import { SecurityAccessReviewPage } from '../pages/SecurityAccessReviewPage.js'
import { HelpGettingStartedPage } from '../pages/HelpGettingStartedPage.js'
import { HelpConceptsPage } from '../pages/HelpConceptsPage.js'
import { HelpScenariosPage } from '../pages/HelpScenariosPage.js'
import { PilotExecutionDashboardPage } from '../pages/PilotExecutionDashboardPage.js'
import { ScenarioExecutionTrackingPage } from '../pages/ScenarioExecutionTrackingPage.js'
import { FeedbackBurnDownPage } from '../pages/FeedbackBurnDownPage.js'
import { PilotIssueRegisterPage } from '../pages/PilotIssueRegisterPage.js'
import { PilotSuccessMetricsPage } from '../pages/PilotSuccessMetricsPage.js'
import { TrainingReadinessPage } from '../pages/TrainingReadinessPage.js'
import { SupportReadinessPage } from '../pages/SupportReadinessPage.js'
import { DataQualityGapsPage } from '../pages/DataQualityGapsPage.js'
import { AccessExceptionsPage } from '../pages/AccessExceptionsPage.js'
import { WorkspaceAdoptionPage } from '../pages/WorkspaceAdoptionPage.js'
import { CutoverRecommendationPage } from '../pages/CutoverRecommendationPage.js'
import { GoNoGoAssessmentPage } from '../pages/GoNoGoAssessmentPage.js'
import { RolloutWavePlanPage } from '../pages/RolloutWavePlanPage.js'
import { LessonsLearnedPage } from '../pages/LessonsLearnedPage.js'
import { TraceGraphVerifyPage } from '../pages/TraceGraphVerifyPage.js'

/**
 * Lazily loaded workspace view renderer.
 *
 * Split into its own chunk so the home screen loads without pulling in
 * workspace-specific code on first paint.
 */
const WorkspaceViews = lazy(() => import('../pages/WorkspaceViews.js'))

/** Renders the active page based on the current workspaceId. */
function ActivePage({ workspaceId }: { readonly workspaceId: string | null }) {
  if (!workspaceId) return <div className="connectio-page"><RoleAwareHome /></div>

  if (workspaceId === 'admin-governance') return <div className="connectio-page" data-testid="workspace-view-admin-governance"><AdminGovernancePage /></div>
  if (workspaceId === 'admin-legacy-retirement') return <div className="connectio-page" data-testid="workspace-view-admin-legacy-retirement"><LegacyRetirementPage /></div>
  if (workspaceId === 'admin-production-readiness') return <div className="connectio-page" data-testid="workspace-view-admin-production-readiness"><ProductionReadinessPage /></div>
  if (workspaceId === 'admin-workspace-parity') return <div className="connectio-page" data-testid="workspace-view-admin-workspace-parity"><WorkspaceParityPage /></div>
  if (workspaceId === 'admin-cutover-simulation') return <div className="connectio-page" data-testid="workspace-view-admin-cutover-simulation"><CutoverSimulationPage /></div>
  if (workspaceId === 'admin-role-scope-matrix') return <div className="connectio-page" data-testid="workspace-view-admin-role-scope-matrix"><RoleScopeMatrixPage /></div>
  if (workspaceId === 'admin-design-system-compliance') return <div className="connectio-page" data-testid="workspace-view-admin-design-system-compliance"><DesignSystemCompliancePage /></div>
  if (workspaceId === 'admin-telemetry') return <div className="connectio-page" data-testid="workspace-view-admin-telemetry"><TelemetryDashboardPage /></div>
  if (workspaceId === 'admin-pilot-workspace-pack') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-workspace-pack"><PilotWorkspacePackPage /></div>
  if (workspaceId === 'admin-pilot-scenario-validation') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-scenario-validation"><ScenarioValidationPage /></div>
  if (workspaceId === 'admin-pilot-feedback') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-feedback"><FeedbackTriagePage /></div>
  if (workspaceId === 'admin-pilot-signoff') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-signoff"><StakeholderSignoffPage /></div>
  if (workspaceId === 'admin-pilot-release-gates') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-release-gates"><ReleaseGatePage /></div>
  if (workspaceId === 'admin-pilot-exit-criteria') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-exit-criteria"><PilotExitCriteriaPage /></div>
  if (workspaceId === 'admin-pilot-data-integration-readiness') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-data-integration-readiness"><DataIntegrationReadinessPage /></div>
  if (workspaceId === 'admin-pilot-security-access-review') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-security-access-review"><SecurityAccessReviewPage /></div>
  if (workspaceId === 'help-getting-started') return <div className="connectio-page" data-testid="workspace-view-help-getting-started"><HelpGettingStartedPage /></div>
  if (workspaceId === 'help-concepts') return <div className="connectio-page" data-testid="workspace-view-help-concepts"><HelpConceptsPage /></div>
  if (workspaceId === 'help-scenarios') return <div className="connectio-page" data-testid="workspace-view-help-scenarios"><HelpScenariosPage /></div>
  if (workspaceId === 'admin-pilot-execution-dashboard') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-execution-dashboard"><PilotExecutionDashboardPage /></div>
  if (workspaceId === 'admin-pilot-scenario-execution') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-scenario-execution"><ScenarioExecutionTrackingPage /></div>
  if (workspaceId === 'admin-pilot-feedback-burndown') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-feedback-burndown"><FeedbackBurnDownPage /></div>
  if (workspaceId === 'admin-pilot-issues') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-issues"><PilotIssueRegisterPage /></div>
  if (workspaceId === 'admin-pilot-success-metrics') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-success-metrics"><PilotSuccessMetricsPage /></div>
  if (workspaceId === 'admin-pilot-training-readiness') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-training-readiness"><TrainingReadinessPage /></div>
  if (workspaceId === 'admin-pilot-support-readiness') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-support-readiness"><SupportReadinessPage /></div>
  if (workspaceId === 'admin-pilot-data-quality-gaps') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-data-quality-gaps"><DataQualityGapsPage /></div>
  if (workspaceId === 'admin-pilot-access-exceptions') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-access-exceptions"><AccessExceptionsPage /></div>
  if (workspaceId === 'admin-pilot-adoption') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-adoption"><WorkspaceAdoptionPage /></div>
  if (workspaceId === 'admin-pilot-cutover-recommendation') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-cutover-recommendation"><CutoverRecommendationPage /></div>
  if (workspaceId === 'admin-pilot-go-no-go') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-go-no-go"><GoNoGoAssessmentPage /></div>
  if (workspaceId === 'admin-pilot-rollout-plan') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-rollout-plan"><RolloutWavePlanPage /></div>
  if (workspaceId === 'admin-pilot-lessons-learned') return <div className="connectio-page" data-testid="workspace-view-admin-pilot-lessons-learned"><LessonsLearnedPage /></div>

  if (workspaceId === 'trace-graph-verify') return <div className="connectio-page" data-testid="workspace-view-trace-graph-verify"><TraceGraphVerifyPage /></div>

  const found = workspaceRegistry.find(w => w.workspaceId === workspaceId)
  if (!found || !isWorkspaceFlagEnabled(workspaceId)) return <div className="connectio-page"><NotFound /></div>

  return (
    <Suspense fallback={<div style={{ padding: 24, color: 'var(--shell-fg-2)' }}>Loading…</div>}>
      <WorkspaceViews workspaceId={workspaceId} />
    </Suspense>
  )
}

/**
 * Main scrollable body region of the shell.
 *
 * Routing logic (no router library):
 * - No `workspaceId` in URL → render {@link RoleAwareHome}
 * - Admin workspaceId strings → render dedicated admin page (no registry entry needed)
 * - `workspaceId` not found in registry → render {@link NotFound}
 * - Valid `workspaceId` → lazy-render {@link WorkspaceViews} with Suspense
 *
 * The `<main>` element provides the ARIA landmark for skip-to-content navigation.
 */
export function MainBody() {
  const { workspaceId } = useWorkspaceShellState()

  return (
    <main id="connectio-main-content" className="connectio-body">
      <ActivePage workspaceId={workspaceId} />
    </main>
  )
}
