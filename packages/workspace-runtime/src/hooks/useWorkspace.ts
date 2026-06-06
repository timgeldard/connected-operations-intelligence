import { useContext } from 'react'
import { WorkspaceContext } from '../WorkspaceContext.js'
import type { WorkspaceContextValue } from '../WorkspaceContext.js'

/**
 * Returns the WorkspaceContextValue for the nearest WorkspaceProvider ancestor.
 *
 * @throws {Error} When called outside a WorkspaceProvider tree.
 */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext)
  if (ctx === null) {
    throw new Error(
      'useWorkspace must be called inside a <WorkspaceProvider>. ' +
        'Ensure the component is rendered within a StandardWorkspaceTemplate.'
    )
  }
  return ctx
}
