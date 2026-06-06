import type { ReactNode } from 'react'

/** Props for WorkspaceBottomActionBar. */
export interface WorkspaceBottomActionBarProps {
  /** Primary action components rendered in the bar. */
  children: ReactNode
}

/**
 * WorkspaceBottomActionBar is a sticky footer bar for primary workspace actions.
 *
 * @remarks
 * Positioned at the bottom of the workspace layout via `flexShrink: 0`. The
 * parent flex column keeps this bar pinned below the scrollable body. Primary
 * action buttons (e.g. "Save", "Submit for approval") are slotted via children.
 */
export function WorkspaceBottomActionBar({ children }: WorkspaceBottomActionBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Workspace actions"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: '10px 20px',
        borderTop: '1px solid var(--shell-line)',
        background: 'var(--shell-surface)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}
