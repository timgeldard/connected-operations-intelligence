import type { ReadinessSeverity } from './readiness.js'
import type { ScopeLevel } from './scope.js'

export type PilotExecutionStatus =
  | 'not-started'
  | 'active'
  | 'paused'
  | 'completed'
  | 'completed-with-conditions'
  | 'blocked'
  | 'cancelled'

export type ScenarioExecutionResultStatus =
  | 'not-run'
  | 'passed'
  | 'passed-with-observations'
  | 'failed'
  | 'blocked'
  | 'deferred'

export interface ScenarioExecutionResult {
  readonly executionId: string
  readonly scenarioId: string
  readonly executedBy: string
  readonly executedRole: string
  readonly executedAt: string
  readonly scope: ScopeLevel
  readonly status: ScenarioExecutionResultStatus
  readonly durationMinutes: number
  readonly observations: readonly string[]
  readonly issuesRaised: readonly string[]
  readonly evidenceCaptured: readonly string[]
  readonly recommendation: string
  readonly blocksPilotExit: boolean
  readonly blocksProduction: boolean
}

export type PilotIssueCategory =
  | 'ux'
  | 'data-quality'
  | 'access'
  | 'performance'
  | 'accessibility'
  | 'source-integration'
  | 'missing-evidence'
  | 'workflow-gap'
  | 'defect'
  | 'training'
  | 'support'
  | 'governance'
  | 'cutover'

export type PilotIssueStatus =
  | 'new'
  | 'triaged'
  | 'in-progress'
  | 'waiting-on-owner'
  | 'resolved'
  | 'deferred'
  | 'accepted-risk'
  | 'blocked'
  | 'closed'

export interface PilotIssue {
  readonly issueId: string
  readonly title: string
  readonly description: string
  readonly category: PilotIssueCategory
  readonly severity: ReadinessSeverity
  readonly priority: 'critical' | 'high' | 'medium' | 'low'
  readonly status: PilotIssueStatus
  readonly owner: string
  readonly workspaceId: string
  readonly viewId: string | null
  readonly panelId: string | null
  readonly actionId: string | null
  readonly source: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly dueAt: string | null
  readonly linkedFeedbackIds: readonly string[]
  readonly linkedScenarioIds: readonly string[]
  readonly linkedReadinessFindingIds: readonly string[]
  readonly blocksPilotExit: boolean
  readonly blocksProduction: boolean
  readonly resolutionSummary: string
}

export interface BurnDownSummary {
  readonly totalIssues: number
  readonly openIssues: number
  readonly resolvedIssues: number
  readonly blockers: number
  readonly criticalIssues: number
  readonly issuesByCategory: Record<PilotIssueCategory, number>
  readonly issuesByWorkspace: Record<string, number>
  readonly issuesByOwner: Record<string, number>
  readonly trend: 'improving' | 'stable' | 'worsening'
  readonly recommendation: string
}

export type PilotSuccessMetricStatus =
  | 'not-measured'
  | 'met'
  | 'met-with-warning'
  | 'missed'
  | 'blocked'

export interface PilotSuccessMetric {
  readonly metricId: string
  readonly title: string
  readonly description: string
  readonly target: string
  readonly actual: string
  readonly unit: string
  readonly status: PilotSuccessMetricStatus
  readonly source: string
  readonly owner: string
  readonly recommendation: string
}

export interface TrainingReadiness {
  readonly roleId: string
  readonly roleName: string
  readonly requiredTrainingItems: readonly string[]
  readonly completedTrainingItems: readonly string[]
  readonly completionPercent: number
  readonly usersReady: number
  readonly usersNotReady: number
  readonly blockers: readonly string[]
  readonly recommendation: string
}

export type SupportReadinessStatus = 'ready' | 'ready-with-gaps' | 'not-ready' | 'blocked'

export interface SupportReadiness {
  readonly area: string
  readonly owner: string
  readonly runbookAvailable: boolean
  readonly supportContactDefined: boolean
  readonly escalationPathDefined: boolean
  readonly knownIssuesDocumented: boolean
  readonly status: SupportReadinessStatus
  readonly blockers: readonly string[]
  readonly recommendation: string
}

export interface DataQualityGap {
  readonly gapId: string
  readonly sourceSystem: string
  readonly workspaceId: string
  readonly panelId: string | null
  readonly description: string
  readonly severity: ReadinessSeverity
  readonly owner: string
  readonly status: 'open' | 'workaround-in-place' | 'resolved' | 'accepted-risk'
  readonly workaround: string
  readonly targetResolution: string
  readonly blocksProduction: boolean
}

export interface AccessException {
  readonly exceptionId: string
  readonly roleId: string
  readonly workspaceId: string
  readonly scopeLevel: ScopeLevel
  readonly expectedAccess: boolean
  readonly actualAccess: boolean
  readonly severity: ReadinessSeverity
  readonly owner: string
  readonly status: 'open' | 'accepted-risk' | 'resolved' | 'deferred'
  readonly recommendation: string
  readonly blocksProduction: boolean
}

export type GoNoGoRecommendation =
  | 'go'
  | 'go-with-conditions'
  | 'no-go'
  | 'defer'
  | 'blocked'

export interface CutoverRecommendation {
  readonly recommendationId: string
  readonly recommendation: GoNoGoRecommendation
  readonly summary: string
  readonly rationale: string
  readonly conditions: readonly string[]
  readonly blockers: readonly string[]
  readonly acceptedRisks: readonly string[]
  readonly requiredActions: readonly string[]
  readonly recommendedWave: string
  readonly rollbackReadiness: 'ready' | 'not-ready' | 'partial'
  readonly supportReadiness: 'ready' | 'not-ready' | 'partial'
  readonly trainingReadiness: 'ready' | 'not-ready' | 'partial'
  readonly dataReadiness: 'ready' | 'not-ready' | 'partial'
  readonly securityReadiness: 'ready' | 'not-ready' | 'partial'
  readonly stakeholderSignoffStatus: 'complete' | 'partial' | 'missing'
  readonly createdAt: string
  readonly createdBy: string
}

export type RolloutWaveStatus =
  | 'not-started'
  | 'planned'
  | 'active'
  | 'completed'
  | 'blocked'
  | 'deferred'

export interface RolloutWave {
  readonly waveId: string
  readonly name: string
  readonly description: string
  readonly targetRoles: readonly string[]
  readonly targetPlants: readonly string[]
  readonly targetWorkspaces: readonly string[]
  readonly prerequisites: readonly string[]
  readonly entryCriteria: readonly string[]
  readonly exitCriteria: readonly string[]
  readonly rollbackPlan: string
  readonly owner: string
  readonly plannedStart: string
  readonly plannedEnd: string
  readonly status: RolloutWaveStatus
}
