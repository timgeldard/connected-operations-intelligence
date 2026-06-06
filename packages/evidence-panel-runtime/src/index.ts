/**
 * @connectio/evidence-panel-runtime
 *
 * Base runtime for evidence panel rendering. Provides state management,
 * composable card layout, and error isolation for individual evidence panels.
 *
 * @remarks
 * No direct imports from shadcn, @radix-ui, clsx, tailwind-merge, or
 * lucide-react — all UI references go through `@connectio/design-system`.
 * This package must NOT import from `@connectio/workspace-runtime` to avoid
 * circular dependencies.
 */

export { EvidencePanel } from './EvidencePanel.js'
export { EvidencePanelHeader } from './EvidencePanelHeader.js'
export { EvidencePanelBody } from './EvidencePanelBody.js'
export { EvidencePanelFooter } from './EvidencePanelFooter.js'
export { EvidencePanelStateRenderer } from './EvidencePanelStateRenderer.js'
export { EvidencePanelErrorBoundary } from './EvidencePanelErrorBoundary.js'
export { useEvidencePanel } from './hooks/useEvidencePanel.js'

export type { EvidencePanelProps, AdapterSource } from './types.js'
export type { EvidencePanelHeaderProps } from './EvidencePanelHeader.js'
export type { EvidencePanelBodyProps } from './EvidencePanelBody.js'
export type { EvidencePanelFooterProps } from './EvidencePanelFooter.js'
export type { EvidencePanelStateRendererProps } from './EvidencePanelStateRenderer.js'
export type { UseEvidencePanelOptions, UseEvidencePanelResult } from './hooks/useEvidencePanel.js'

// Evidence State Primitives
export { EvidenceErrorState } from './ui/EvidenceErrorState.js'
export type { EvidenceErrorStateProps } from './ui/EvidenceErrorState.js'
export { EvidenceLoadingState } from './ui/EvidenceLoadingState.js'
export type { EvidenceLoadingStateProps } from './ui/EvidenceLoadingState.js'
export { ConfirmedEmptyState } from './ui/ConfirmedEmptyState.js'
export type { ConfirmedEmptyStateProps } from './ui/ConfirmedEmptyState.js'
export { EvidenceCaveatList } from './ui/EvidenceCaveatList.js'
export type { EvidenceCaveatListProps } from './ui/EvidenceCaveatList.js'
export { FreshnessBadge } from './ui/FreshnessBadge.js'
export type { FreshnessBadgeProps } from './ui/FreshnessBadge.js'
