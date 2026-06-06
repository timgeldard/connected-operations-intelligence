import type { LifecycleState } from './lifecycle.js'
import type { ScopeLevel, ScopePolicy } from './scope.js'
import type {
  PermissionDefinition,
  FreshnessPolicy,
  ConfidencePolicy,
  WorkspacePersonalizationPolicy,
  SourceOwnership,
} from './policies.js'
import type { DrillThroughDefinition, EvidenceContextRequirement } from './navigation.js'

/** Top-level domain registration (e.g. "Quality & Food Safety"). */
export interface DomainRegistration {
  readonly domainId: string
  readonly displayName: string
  readonly shortName: string
  readonly description: string
  readonly icon: string
  readonly color: string
  readonly lifecycle: LifecycleState
  readonly sortOrder: number
}

/** Reference to an evidence panel used within a workspace. */
export interface EvidencePanelReference {
  readonly panelId: string
  readonly defaultGridArea?: string
  readonly defaultVisible: boolean
  readonly defaultOrder: number
}

/** A view (tab) within a workspace. */
export interface ViewRegistration {
  readonly viewId: string
  readonly displayName: string
  readonly description?: string
  readonly lifecycle: LifecycleState
  readonly sortOrder: number
  readonly defaultPanels: readonly EvidencePanelReference[]
}

/** A complete workspace registration. */
export interface WorkspaceRegistration {
  readonly workspaceId: string
  readonly displayName: string
  readonly description: string
  readonly domainId: string
  readonly ownerDomain: string
  readonly lifecycle: LifecycleState
  readonly supportedRoles: readonly string[]
  readonly requiredPermissions: readonly PermissionDefinition[]
  readonly supportedScopes: readonly ScopeLevel[]
  readonly scopePolicy: ScopePolicy
  readonly defaultViews: readonly ViewRegistration[]
  readonly defaultPanels: readonly EvidencePanelReference[]
  /** URL path segment for this workspace, e.g. '/quality/batch-release'. */
  readonly route: string
  readonly personalizationPolicy: WorkspacePersonalizationPolicy
  readonly drillThroughDefinitions: readonly DrillThroughDefinition[]
  readonly telemetryId: string
}

/** A registered evidence panel. */
export interface EvidencePanelRegistration {
  readonly panelId: string
  readonly displayName: string
  readonly description: string
  readonly ownerDomain: string
  readonly sourceOwnership: SourceOwnership
  readonly lifecycle: LifecycleState
  /** Which workspaces are permitted to host this panel. Empty = unrestricted. */
  readonly allowedConsumerWorkspaces: readonly string[]
  readonly requiredContext: readonly EvidenceContextRequirement[]
  readonly freshnessPolicy: FreshnessPolicy
  readonly confidencePolicy: ConfidencePolicy
  readonly drillThrough?: DrillThroughDefinition
  readonly requiredPermissions: readonly PermissionDefinition[]
}

/** A saved dashboard. */
export interface DashboardRegistration {
  readonly dashboardId: string
  readonly displayName: string
  readonly description: string
  readonly lifecycle: LifecycleState
  readonly ownerDomain: string
  readonly panelIds: readonly string[]
  readonly isPersonal: boolean
}

/** An action flow (multi-step guided operation). */
export interface ActionFlowRegistration {
  readonly actionFlowId: string
  readonly displayName: string
  readonly description: string
  readonly lifecycle: LifecycleState
  readonly ownerWorkspaceId: string
  readonly requiredPermissions: readonly PermissionDefinition[]
  readonly requiredContext: readonly EvidenceContextRequirement[]
}
