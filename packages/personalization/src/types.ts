/** A workspace the user has pinned to the sidebar rail. */
export interface PinnedWorkspace {
  readonly workspaceId: string
  readonly pinnedAt: string
}

/** A recently visited workspace entry. */
export interface RecentWorkspace {
  readonly workspaceId: string
  readonly visitedAt: string
  readonly scopeSnapshot?: Record<string, string>
}

/** Full personalisation state for a user. */
export interface PersonalizationState {
  readonly pinnedWorkspaces: readonly PinnedWorkspace[]
  readonly recentWorkspaces: readonly RecentWorkspace[]
}
