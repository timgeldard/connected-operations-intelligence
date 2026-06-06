import type { ScopeLevel } from './scope.js'
import type { ReadinessSeverity } from './readiness.js'

export type PilotStatus = 'not-in-pilot' | 'proposed' | 'included' | 'in-validation' | 'accepted' | 'accepted-with-actions' | 'rejected' | 'blocked'

export type ValidationScenarioStatus = 'not-started' | 'in-progress' | 'passed' | 'passed-with-observations' | 'failed' | 'blocked'

export interface ValidationScenario {
  readonly scenarioId: string
  readonly title: string
  readonly description: string
  readonly personaRole: string
  readonly primaryWorkspaceId: string
  readonly supportingWorkspaceIds: readonly string[]
  readonly scopeLevel: ScopeLevel
  readonly businessGoal: string
  readonly startingContext: string
  readonly expectedEvidencePanels: readonly string[]
  readonly expectedActions: readonly string[]
  readonly expectedDrillThroughs: readonly string[]
  readonly acceptanceCriteria: readonly string[]
  readonly status: ValidationScenarioStatus
  readonly owner: string
  readonly lastValidatedAt: string | null
  readonly findings: readonly string[]
  readonly blocksPilotExit: boolean
  readonly blocksProduction: boolean
}

export type StakeholderSignoffStatus = 'not-requested' | 'requested' | 'in-progress' | 'approved' | 'approved-with-conditions' | 'rejected' | 'blocked'

export interface StakeholderSignoff {
  readonly signoffId: string
  readonly stakeholderName: string
  readonly stakeholderRole: string
  readonly domain: string
  readonly workspaceIds: readonly string[]
  readonly status: StakeholderSignoffStatus
  readonly conditions: readonly string[]
  readonly blockers: readonly string[]
  readonly signedAt: string | null
  readonly expiresAt: string | null
  readonly notes: string
}

export type FeedbackCategory = 'usability' | 'data-quality' | 'missing-evidence' | 'wrong-owner' | 'performance' | 'accessibility' | 'navigation' | 'terminology' | 'training' | 'defect' | 'enhancement'

export type FeedbackStatus = 'new' | 'triaged' | 'accepted' | 'rejected' | 'in-progress' | 'resolved' | 'deferred' | 'blocked'

export type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low'

export interface FeedbackItem {
  readonly feedbackId: string
  readonly title: string
  readonly description: string
  readonly submittedBy: string
  readonly submittedRole: string
  readonly workspaceId: string
  readonly viewId: string | null
  readonly panelId: string | null
  readonly actionId: string | null
  readonly route: string
  readonly category: FeedbackCategory
  readonly severity: ReadinessSeverity
  readonly priority: FeedbackPriority
  readonly status: FeedbackStatus
  readonly owner: string
  readonly createdAt: string
  readonly updatedAt: string
  readonly targetPhase: string
  readonly linkedFindingIds: readonly string[]
}

export type ReleaseGateStatus = 'not-started' | 'in-progress' | 'passed' | 'passed-with-conditions' | 'failed' | 'blocked'

export interface ReleaseGate {
  readonly gateId: string
  readonly name: string
  readonly description: string
  readonly status: ReleaseGateStatus
  readonly owner: string
  readonly requiredFindingsClosed: readonly string[]
  readonly requiredSignoffs: readonly string[]
  readonly requiredScenarios: readonly string[]
  readonly blockers: readonly string[]
  readonly dueAt: string
  readonly evidenceLinks: readonly string[]
}

export interface PilotExitCriteria {
  readonly criteriaId: string
  readonly title: string
  readonly description: string
  readonly status: ReleaseGateStatus
  readonly owner: string
  readonly measurement: string
  readonly target: string
  readonly actual: string
  readonly blockers: readonly string[]
  readonly recommendation: string
}

export type DataIntegrationStatus = 'mocked' | 'adapter-backed' | 'source-integrated' | 'not-started' | 'blocked'
export type DataContractCoverage = 'full' | 'partial' | 'none'

export interface DataIntegrationReadiness {
  readonly sourceCapability: string
  readonly sourceSystem: string
  readonly adapterName: string
  readonly targetWorkspaceIds: readonly string[]
  readonly status: DataIntegrationStatus
  readonly dataContractCoverage: DataContractCoverage
  readonly freshnessSupport: boolean
  readonly confidenceSupport: boolean
  readonly knownGaps: readonly string[]
  readonly owner: string
  readonly nextAction: string
}

export type AccessStatus = 'correct' | 'over-permissioned' | 'under-permissioned' | 'not-assessed'

export interface SecurityAccessReviewItem {
  readonly reviewId: string
  readonly roleId: string
  readonly workspaceId: string
  readonly scopeLevel: ScopeLevel
  readonly permission: string
  readonly accessExpected: boolean
  readonly accessActual: boolean
  readonly status: AccessStatus
  readonly finding: string
  readonly recommendation: string
}
