import type { LifecycleState } from './lifecycle.js'

/**
 * Aggregated readiness verdict for an item being assessed.
 *
 * - not-assessed: assessment has not been run yet
 * - ready: no blockers; item may proceed to next milestone
 * - ready-with-warnings: minor issues exist but do not block
 * - blocked: one or more blockers must be resolved before proceeding
 * - not-applicable: the check does not apply to this item
 */
export type ReadinessStatus = 'not-assessed' | 'ready' | 'ready-with-warnings' | 'blocked' | 'not-applicable'

/**
 * Severity of a single readiness finding.
 *
 * - info: informational, no action required
 * - warning: should be fixed before production but does not block pilot
 * - blocker: blocks the next milestone (pilot or production, depending on context)
 * - critical: blocks immediately; requires resolution before proceeding
 */
export type ReadinessSeverity = 'info' | 'warning' | 'blocker' | 'critical'

/**
 * Anchor type for all readiness assessment findings.
 *
 * All Phase 6 dashboards (parity, cutover, compliance, role-scope) produce
 * ReadinessFinding records that can be filtered, sorted, and rendered uniformly.
 */
export interface ReadinessFinding {
  readonly findingId: string
  /** Category of item this finding is about (e.g. 'workspace', 'panel', 'role', 'component'). */
  readonly itemType: string
  /** Identifier of the specific item (workspaceId, panelId, role name, component path, etc.). */
  readonly itemId: string
  readonly title: string
  readonly description: string
  readonly severity: ReadinessSeverity
  readonly readinessStatus: ReadinessStatus
  /** Domain team responsible for resolving this finding. */
  readonly ownerDomain: string
  readonly lifecycle: LifecycleState
  /** Recommended action to resolve or acknowledge this finding. */
  readonly recommendation: string
  /** Whether this finding must be resolved before a pilot release can proceed. */
  readonly blocksPilot: boolean
  /** Whether this finding must be resolved before a production release can proceed. */
  readonly blocksProduction: boolean
  /** Optional workspace deeplink to the relevant context (e.g. drill-through target). */
  readonly drillThroughTarget?: string
  readonly createdAt: string
  /** Origin of this finding (e.g. 'static-audit', 'eslint', 'runtime-check', 'manual'). */
  readonly source: string
}

/** Parity verdict for a workspace measured against its legacy counterpart. */
export type WorkspaceParityStatus = 'full-parity' | 'partial-parity' | 'no-parity' | 'exceeds-legacy'

/** Structured parity assessment comparing a ConnectIO workspace to its legacy system. */
export interface WorkspaceParityAssessment {
  readonly workspaceId: string
  readonly legacySystemId: string
  readonly legacySystemName: string
  readonly parityStatus: WorkspaceParityStatus
  /** 0–100 score representing functional coverage of the legacy system's features. */
  readonly coverageScore: number
  readonly findings: readonly ReadinessFinding[]
  readonly assessedAt: string
}

/**
 * Cutover simulation mode for a workspace pair (ConnectIO + legacy target).
 *
 * - off: no simulation active; both systems operate normally
 * - observe: ConnectIO workspace is shown alongside legacy; no redirects
 * - simulate-redirect: deep links from legacy are intercepted and redirected to ConnectIO
 * - simulate-retirement: legacy system routes are disabled; all traffic goes to ConnectIO
 */
export type CutoverSimulationMode = 'off' | 'observe' | 'simulate-redirect' | 'simulate-retirement'

/** Result record from a cutover simulation run. */
export interface CutoverSimulationResult {
  readonly simulationId: string
  readonly workspaceId: string
  readonly legacySystemId: string
  readonly mode: CutoverSimulationMode
  readonly startedAt: string
  readonly endedAt?: string
  /** Whether the simulation completed without blocking issues. */
  readonly passed: boolean
  readonly findings: readonly ReadinessFinding[]
  readonly notes: string
}

/** A single entry in the role × scope × workspace visibility matrix. */
export interface RoleScopeMatrixEntry {
  readonly role: string
  readonly scopeLevel: string
  readonly workspaceId: string
  /** Whether the workspace is visible given this role and scope combination. */
  readonly isVisible: boolean
  /** Whether the workspace is navigable (not hidden or deprecated) for this combination. */
  readonly isNavigable: boolean
  /** The required permission that gates visibility, if any. */
  readonly requiredPermission?: string
  /** Whether the required permission is met under this role. */
  readonly permissionSatisfied: boolean
}

/** A finding from the design-system compliance audit (import scanning + ESLint). */
export interface DesignSystemComplianceFinding extends ReadinessFinding {
  /** File path where the non-compliant import or usage was found. */
  readonly filePath: string
  /** The disallowed import specifier (e.g. '@radix-ui/react-dialog', 'clsx'). */
  readonly violatingImport: string
  /** ESLint rule ID that flagged this import, if applicable. */
  readonly eslintRule?: string
  readonly lineNumber?: number
}
