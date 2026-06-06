import type { ScopeLevel } from './scope.js'

/** Specifies where a drill-through link should navigate. */
export interface DrillThroughDefinition {
  readonly label: string
  /** Target workspace ID. */
  readonly targetWorkspaceId: string
  /** Target view ID within the workspace, if applicable. */
  readonly targetViewId?: string
  /** Scope levels from the current context to pass to the target. */
  readonly contextScopes: readonly ScopeLevel[]
}

/** A piece of context an evidence panel requires before it can render. */
export interface EvidenceContextRequirement {
  readonly contextKey: string
  readonly scopeLevel: ScopeLevel
  readonly required: boolean
  readonly description?: string
}
