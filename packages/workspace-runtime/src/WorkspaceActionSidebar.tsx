import type { ReactNode } from 'react'

/** Props for WorkspaceActionSidebar. */
export interface WorkspaceActionSidebarProps {
  /** Contextual action components rendered inside the sidebar. */
  children: ReactNode
  /** When true the sidebar is visible; when false it is collapsed. */
  open: boolean
  /** Called when the user toggles the sidebar open or closed. */
  onToggle: () => void
}

/**
 * WorkspaceActionSidebar is a collapsible right-hand panel for contextual actions.
 *
 * @remarks
 * When `open` is false the sidebar collapses to a narrow strip showing only
 * the toggle button. Width transitions use CSS so the host layout does not need
 * to reflow JavaScript-side.
 */
export function WorkspaceActionSidebar({
  children,
  open,
  onToggle,
}: WorkspaceActionSidebarProps) {
  return (
    <aside
      aria-label="Workspace actions"
      aria-expanded={open}
      style={{
        width: open ? '280px' : '32px',
        minWidth: open ? '280px' : '32px',
        transition: 'width var(--dur-mid, 220ms) var(--ease-out, ease), min-width var(--dur-mid, 220ms) var(--ease-out, ease)',
        background: 'var(--shell-surface)',
        borderLeft: '1px solid var(--shell-line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-label={open ? 'Collapse action sidebar' : 'Expand action sidebar'}
        onClick={onToggle}
        style={{
          width: '32px',
          height: '32px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--shell-fg-2)',
          alignSelf: 'flex-end',
          flexShrink: 0,
          fontSize: 'var(--fs-16)',
        }}
      >
        {open ? '›' : '‹'}
      </button>
      {open && (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 'var(--sp-4)',
          }}
        >
          {children}
        </div>
      )}
    </aside>
  )
}
