/**
 * @connectio/workspace-runtime
 *
 * Master layout and context runtime for ConnectIO workspaces. All workspace
 * implementations must use StandardWorkspaceTemplate as their root component.
 *
 * @remarks
 * No direct imports from shadcn, @radix-ui, clsx, tailwind-merge, or
 * lucide-react — all UI references go through `@connectio/design-system`.
 */

export { StandardWorkspaceTemplate } from './StandardWorkspaceTemplate.js'
export type { StandardWorkspaceTemplateProps } from './StandardWorkspaceTemplate.js'

export { WorkspaceProvider } from './WorkspaceProvider.js'
export type { WorkspaceProviderProps } from './WorkspaceProvider.js'

export { WorkspaceContext } from './WorkspaceContext.js'
export type { WorkspaceContextValue } from './WorkspaceContext.js'

export { WorkspaceHeader } from './WorkspaceHeader.js'
export type { WorkspaceHeaderProps } from './WorkspaceHeader.js'

export { WorkspaceTabs } from './WorkspaceTabs.js'
export type { WorkspaceTabsProps } from './WorkspaceTabs.js'

export { ScopeContextBar } from './ScopeContextBar.js'
export type { ScopeContextBarProps } from './ScopeContextBar.js'

export { EvidenceGrid } from './EvidenceGrid.js'
export type { EvidenceGridProps } from './EvidenceGrid.js'

export { WorkspaceActionSidebar } from './WorkspaceActionSidebar.js'
export type { WorkspaceActionSidebarProps } from './WorkspaceActionSidebar.js'

export { WorkspaceBottomActionBar } from './WorkspaceBottomActionBar.js'
export type { WorkspaceBottomActionBarProps } from './WorkspaceBottomActionBar.js'

export { WorkspaceErrorBoundary } from './WorkspaceErrorBoundary.js'

export { useWorkspace } from './hooks/useWorkspace.js'

export {
  ActiveInvestigationContextProvider,
  useActiveInvestigationContext,
  useActiveInvestigationStore,
  useOptionalActiveInvestigationContext,
} from './context/ActiveInvestigationContextProvider.js'
export type { ActiveInvestigationContextProviderProps } from './context/ActiveInvestigationContextProvider.js'
export {
  ActiveInvestigationContextSchema,
  InvestigationDateScopeSchema,
  createEmptyInvestigationContext,
  normalizeInvestigationPatch,
  validateInvestigationContext,
} from './context/active-investigation-context.js'
export type {
  ActiveInvestigationContext,
  ActiveInvestigationContextPatch,
  InvestigationContextKey,
} from './context/active-investigation-context.js'
export {
  createActiveInvestigationStore,
} from './context/active-investigation-store.js'
export type {
  ActiveInvestigationStore,
  ActiveInvestigationStoreState,
} from './context/active-investigation-store.js'
export {
  readInvestigationContextFromUrl,
  replaceInvestigationContextInBrowserUrl,
  writeInvestigationContextToUrl,
} from './context/url-sync.js'
export { useContextAwareEvidencePanel } from './hooks/useContextAwareEvidencePanel.js'
export type {
  UseContextAwareEvidencePanelOptions,
  UseContextAwareEvidencePanelResult,
} from './hooks/useContextAwareEvidencePanel.js'
