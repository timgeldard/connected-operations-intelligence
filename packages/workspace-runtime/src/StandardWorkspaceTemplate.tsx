import type { ReactNode } from 'react'
import type { WorkspaceRegistration } from '@connectio/product-model'
import type { ScopeContext } from '@connectio/data-contracts'
import { WorkspaceProvider } from './WorkspaceProvider.js'
import { WorkspaceLayout } from './WorkspaceLayout.js'
import { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary.js'
import { ActiveInvestigationContextProvider } from './context/ActiveInvestigationContextProvider.js'

/** Props for StandardWorkspaceTemplate. */
export interface StandardWorkspaceTemplateProps {
  /** Static workspace registration that drives all layout and metadata. */
  registration: WorkspaceRegistration
  /** Current scope context from the host shell. */
  scope: ScopeContext
  /**
   * ID of the view to activate on mount.
   * Defaults to `registration.defaultViews[0].viewId` when omitted.
   */
  defaultViewId?: string
  /**
   * Slot for a right-hand contextual action sidebar (e.g. a pre-configured
   * WorkspaceActionSidebar). When omitted no sidebar area is rendered.
   */
  actionSidebar?: ReactNode
  /**
   * Slot for bottom action bar content (primary CTA buttons, e.g. a
   * WorkspaceBottomActionBar). When omitted no bottom bar is rendered.
   */
  bottomActions?: ReactNode
  /** Evidence panel components that populate the grid body. */
  children: ReactNode
}

/**
 * StandardWorkspaceTemplate is the master layout that all workspaces must use.
 *
 * @remarks
 * Provides WorkspaceProvider context and delegates chrome rendering to
 * WorkspaceLayout. The active view's panels are derived automatically from
 * the registration inside WorkspaceLayout. Evidence panel components are
 * passed as children and rendered inside the EvidenceGrid.
 */
export function StandardWorkspaceTemplate({
  registration,
  scope,
  defaultViewId,
  actionSidebar,
  bottomActions,
  children,
}: StandardWorkspaceTemplateProps) {
  return (
    <WorkspaceErrorBoundary>
      <WorkspaceProvider
        registration={registration}
        scope={scope}
        defaultViewId={defaultViewId}
      >
        <ActiveInvestigationContextProvider
          workspaceId={registration.workspaceId}
          scope={scope}
        >
          <WorkspaceLayout
            actionSidebar={actionSidebar}
            bottomActions={bottomActions}
          >
            {children}
          </WorkspaceLayout>
        </ActiveInvestigationContextProvider>
      </WorkspaceProvider>
    </WorkspaceErrorBoundary>
  )
}
