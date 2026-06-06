import { usePinnedWorkspaces } from '@connectio/personalization'
import { isNavigable } from '@connectio/product-model'
import { isWorkspaceFlagEnabled } from '@connectio/feature-flags'
import { useWorkspaceShellState } from './useWorkspaceShellState.js'
import { workspaceRegistry } from '../registry/workspace-registry.js'

/**
 * Left rail navigation sidebar.
 *
 * Renders one icon button per navigable workspace. When `pinnedWorkspaces` is
 * non-null the list is filtered to only the user's pinned set; a null value
 * means "show all" (i.e. personalisation data has not yet loaded or the user
 * has not pinned anything).
 *
 * The active workspace button receives the `active` CSS modifier and
 * `aria-current="page"` for screen-reader context.
 */
export function DomainSidebar() {
  const { workspaceId, setWorkspace } = useWorkspaceShellState()
  const [pinnedWorkspaces] = usePinnedWorkspaces(workspaceRegistry.map(w => w.workspaceId))

  const visible = workspaceRegistry.filter(
    w =>
      isNavigable(w.lifecycle) &&
      isWorkspaceFlagEnabled(w.workspaceId) &&
      (pinnedWorkspaces === null || pinnedWorkspaces.includes(w.workspaceId)),
  )

  return (
    <nav className="connectio-rail" aria-label="Workspace navigation">
      {/* Brand mark â€” decorative, hidden from assistive tech */}
      <div className="connectio-rail-logo" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="var(--shell-rail-active)" opacity="0.9" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fill="white"
            fontSize="10"
            fontWeight="bold"
          >
            C
          </text>
        </svg>
      </div>

      {visible.map(workspace => (
        <button
          key={workspace.workspaceId}
          className={`connectio-rail-item${workspaceId === workspace.workspaceId ? ' active' : ''}`}
          onClick={() => setWorkspace(workspace.workspaceId)}
          aria-label={workspace.displayName}
          aria-current={workspaceId === workspace.workspaceId ? 'page' : undefined}
          title={workspace.displayName}
        >
          {/* Generic workspace icon â€” individual icons resolved in Phase 1 */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          <span>{workspace.displayName.slice(0, 5).toUpperCase()}</span>
        </button>
      ))}

      <div className="connectio-rail-spacer" />
    </nav>
  )
}
