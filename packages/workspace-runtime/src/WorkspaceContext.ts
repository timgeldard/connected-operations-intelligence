import { createContext } from 'react'
import type { WorkspaceRegistration } from '@connectio/product-model'
import type { ScopeContext } from '@connectio/data-contracts'

/**
 * Value shape exposed by WorkspaceContext.
 *
 * @remarks
 * Consumed via `useWorkspace()` — do not read the context directly.
 */
export interface WorkspaceContextValue {
  /** Static registration record for the active workspace. */
  registration: WorkspaceRegistration
  /** ID of the currently active view tab. */
  activeViewId: string
  /** Current scope context (plant, line, batch, etc.). */
  scope: ScopeContext
  /**
   * Changes the active view to the given ID.
   * Only navigable views (live, pilot, concept-lab) may be activated.
   */
  setActiveView: (viewId: string) => void
}

/**
 * WorkspaceContext carries registration, active view, and scope for the
 * enclosing workspace. Null outside a WorkspaceProvider.
 */
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
