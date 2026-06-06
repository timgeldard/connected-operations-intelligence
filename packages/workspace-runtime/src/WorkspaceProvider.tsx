import { useState } from 'react'
import type { ReactNode } from 'react'
import type { WorkspaceRegistration } from '@connectio/product-model'
import type { ScopeContext } from '@connectio/data-contracts'
import { WorkspaceContext } from './WorkspaceContext.js'
import type { WorkspaceContextValue } from './WorkspaceContext.js'

/** Props for WorkspaceProvider. */
export interface WorkspaceProviderProps {
  /** Static registration record for this workspace. */
  registration: WorkspaceRegistration
  /** Current scope context from the shell. */
  scope: ScopeContext
  /**
   * ID of the view to activate on mount.
   * Defaults to `registration.defaultViews[0].viewId` when omitted.
   */
  defaultViewId?: string
  /** Child components that will receive the workspace context. */
  children: ReactNode
}

/**
 * WorkspaceProvider makes workspace registration, active view, and scope
 * available to all descendants via WorkspaceContext.
 *
 * @remarks
 * The active view defaults to the first entry in `registration.defaultViews`
 * unless overridden by `defaultViewId`. `setActiveView` does not validate
 * whether the target view exists — callers should only pass IDs from the
 * registration's `defaultViews` array.
 */
export function WorkspaceProvider({
  registration,
  scope,
  defaultViewId,
  children,
}: WorkspaceProviderProps) {
  const fallbackViewId = registration.defaultViews[0]?.viewId ?? ''
  const [activeViewId, setActiveView] = useState<string>(
    defaultViewId ?? fallbackViewId
  )

  const value: WorkspaceContextValue = {
    registration,
    activeViewId,
    scope,
    setActiveView,
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  )
}
