import type { ReactNode } from 'react'
import { WorkspaceHeader } from './WorkspaceHeader.js'
import { WorkspaceTabs } from './WorkspaceTabs.js'
import { ScopeContextBar } from './ScopeContextBar.js'
import { EvidenceGrid } from './EvidenceGrid.js'
import { WorkspaceBottomActionBar } from './WorkspaceBottomActionBar.js'
import { useWorkspace } from './hooks/useWorkspace.js'

/** Props for WorkspaceLayout (internal to workspace-runtime). */
export interface WorkspaceLayoutProps {
  /** Slotted right-hand sidebar content. */
  actionSidebar?: ReactNode
  /** Slotted bottom action bar content. */
  bottomActions?: ReactNode
  /** Evidence grid content. */
  children: ReactNode
}

/**
 * WorkspaceLayout renders the workspace chrome by reading WorkspaceContext.
 *
 * @remarks
 * This component is intentionally not exported from the package barrel.
 * It must be mounted inside a WorkspaceProvider so it can read context.
 * The active view's defaultPanels are derived here and forwarded to EvidenceGrid.
 */
export function WorkspaceLayout({
  actionSidebar,
  bottomActions,
  children,
}: WorkspaceLayoutProps) {
  const { registration, activeViewId, scope, setActiveView } = useWorkspace()

  const activeView = registration.defaultViews.find((v) => v.viewId === activeViewId)
  const activePanels = activeView?.defaultPanels ?? []

  return (
    <div
      data-testid="workspace-shell"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <WorkspaceHeader registration={registration} />
      <WorkspaceTabs
        views={registration.defaultViews}
        activeViewId={activeViewId}
        onViewChange={setActiveView}
      />
      <ScopeContextBar scope={scope} />
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          display: 'flex',
          gap: '16px',
        }}
      >
        <EvidenceGrid panels={activePanels}>
          {children}
        </EvidenceGrid>
        {actionSidebar}
      </div>
      {bottomActions && (
        <WorkspaceBottomActionBar>{bottomActions}</WorkspaceBottomActionBar>
      )}
    </div>
  )
}
