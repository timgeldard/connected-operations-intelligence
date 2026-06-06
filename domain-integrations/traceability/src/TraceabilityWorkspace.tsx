import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type { ScopeContext } from '@connectio/data-contracts'
import { traceabilityWorkspaceRegistration } from './registration.js'
import { TraceExposureSummaryPanel } from './panels/TraceExposureSummaryPanel.js'
import { BatchLineagePanel } from './panels/BatchLineagePanel.js'

/** Props for TraceabilityWorkspace. */
export interface TraceabilityWorkspaceProps {
  /**
   * Current scope context provided by the host shell.
   * Must contain at minimum a `batchId` because the workspace registration
   * declares `requiredLevel: 'batch'`.
   */
  scope: ScopeContext
}

/**
 * Top-level component for the Traceability workspace.
 *
 * @remarks
 * Composes `StandardWorkspaceTemplate` with the traceability registration and
 * both evidence panels. In Phase 1 both panels start with `data={null}` and
 * remain in `loading` display state; data fetching will be wired in a
 * subsequent phase, driven by `scope.batchId` via TanStack Query or a shared
 * data layer. No state is held here until that phase is implemented.
 */
export function TraceabilityWorkspace({ scope }: TraceabilityWorkspaceProps) {
  return (
    <StandardWorkspaceTemplate
      registration={traceabilityWorkspaceRegistration}
      scope={scope}
    >
      <TraceExposureSummaryPanel data={null} />
      <BatchLineagePanel data={null} />
    </StandardWorkspaceTemplate>
  )
}
