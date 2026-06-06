/** How fresh the data must be before a panel is considered stale. */
export interface FreshnessPolicy {
  /** Maximum age in seconds before panel shows stale indicator. */
  readonly staleAfterSeconds: number
  /** Maximum age in seconds before panel shows error state. */
  readonly errorAfterSeconds: number
  /** Whether to auto-refresh when the tab becomes visible. */
  readonly refreshOnFocus: boolean
  /** Polling interval in seconds, or null for no polling. */
  readonly pollIntervalSeconds: number | null
}

/** How confidence in panel data is calculated and displayed. */
export interface ConfidencePolicy {
  /** Confidence level 0â€“1, or null when not calculable. */
  readonly level: number | null
  /** Human-readable reason for the current confidence level. */
  readonly reason?: string
  /** Whether to suppress the confidence indicator entirely. */
  readonly hidden: boolean
}

/** A single permission requirement. */
export interface PermissionDefinition {
  readonly permissionId: string
  readonly displayName: string
  readonly description?: string
}

/** A user role/persona definition. */
export interface RoleDefinition {
  readonly roleId: string
  readonly displayName: string
  readonly description?: string
  /** Groups from the identity provider that map to this role. */
  readonly idpGroups: readonly string[]
}

/** Which aspects of a workspace the user may personalise. */
export interface WorkspacePersonalizationPolicy {
  readonly allowPanelReorder: boolean
  readonly allowPanelHide: boolean
  readonly allowSavedFilters: boolean
  readonly allowDefaultScopeOverride: boolean
  readonly maxPinnedPanels?: number
}

/** Which system/service owns the data in an evidence panel. */
export interface SourceOwnership {
  readonly domainId: string
  readonly systemName: string
  /** Identifier of the legacy app being migrated (e.g. 'trace2', 'spc'). */
  readonly legacyAppId?: string
  readonly dataOwnerTeam?: string
}
