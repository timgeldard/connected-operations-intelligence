import { StandardWorkspaceTemplate } from '@connectio/workspace-runtime'
import type {
  ScopeContext,
  Trace2AdapterRequest,
  OperationsEvidenceAdapterRequest,
  WarehouseEvidenceAdapterRequest,
} from '@connectio/data-contracts'
import { VerificationStatusBanner } from '@connectio/design-system'
import { batchReleaseRegistration } from './batch-release-registration.js'
import { ReleaseActionsPanel } from './actions/release-actions-panel.js'
import { ReleaseQueueView } from './views/release-queue-view.js'
import { BatchDecisionView } from './views/batch-decision-view.js'
import { QualityEvidenceView } from './views/quality-evidence-view.js'
import { OperationsEvidenceView } from './views/operations-evidence-view.js'
import { WarehouseTraceEvidenceView } from './views/warehouse-trace-evidence-view.js'
import { DecisionHistoryView } from './views/decision-history-view.js'
import { LabBoardView } from './views/lab-board-view.js'
import { useReleaseContext } from './adapters/quality-release-queries.js'
import type { QualityReleaseAdapterRequest } from './adapters/quality-release-adapter.js'
import { BatchReleaseInitialState } from './components/BatchReleaseInitialState.js'

/** Valid view identifiers for the Quality Batch Release workspace. */
export type BatchReleaseViewId =
  | 'release-queue'
  | 'batch-decision'
  | 'quality-evidence'
  | 'operations-evidence'
  | 'warehouse-trace-evidence'
  | 'decision-history'
  | 'lab-board'

/** Props for BatchReleaseWorkspace. */
export interface BatchReleaseWorkspaceProps {
  /**
   * Active scope context provided by the host shell.
   * Used to derive batch/plant/process-order context for cross-domain panels.
   */
  readonly scope: ScopeContext
  /**
   * The release case ID from the URL. Defaults to the mock case ID
   * when not provided — enables the workspace to render without a real backend.
   */
  readonly releaseCaseId?: string
  /**
   * Active view tab. Defaults to 'release-queue'.
   */
  readonly viewId?: string
  /**
   * Called when the user selects a different release case from the queue.
   * The shell wires this to its URL state updater.
   */
  readonly onSelectCase?: (releaseCaseId: string) => void
}

/**
 * Top-level component for the Quality Batch Release workspace.
 *
 * @remarks
 * Uses `StandardWorkspaceTemplate` as the mandatory layout wrapper. The active
 * view is determined by `viewId` and rendered inside the template's evidence
 * grid body. The right-hand action sidebar is pre-wired with release action
 * flows (release, hold, retest, escalate, open-trace).
 *
 * Cross-domain adapter requests are derived from `scope` and `releaseCaseId`
 * and forwarded to every view. Each domain's adapter provides its own mock
 * data in Phase 2 — no real backend connection is required.
 *
 * Phase 2: uses realistic mock data. No real backend connection required.
 */
export function BatchReleaseWorkspace({
  scope,
  releaseCaseId,
  viewId = 'release-queue',
  onSelectCase,
}: BatchReleaseWorkspaceProps) {
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE || 'mock'

  const effectiveCaseId = releaseCaseId || 'RC-2024-001847'

  const qualityRequest: QualityReleaseAdapterRequest = {
    releaseCaseId: effectiveCaseId,
    batchId: scope.batchId,
    plantId: scope.plantId,
  }

  const traceRequest: Trace2AdapterRequest = {
    investigationId: `trace-for-${effectiveCaseId}`,
    batchId: scope.batchId,
    plantId: scope.plantId,
  }

  const operationsRequest: OperationsEvidenceAdapterRequest = {
    processOrderId: scope.processOrderId,
    batchId: scope.batchId,
    releaseCaseId: effectiveCaseId,
  }

  const warehouseRequest: WarehouseEvidenceAdapterRequest = {
    batchId: scope.batchId,
    plantId: scope.plantId,
    releaseCaseId: effectiveCaseId,
  }

  // Hook MUST be called before any conditional return so React's
  // rules-of-hooks invariant holds. The initial-state branch below
  // simply doesn't consume the resulting context.
  const { data: contextResult } = useReleaseContext(qualityRequest)
  const context = contextResult?.ok ? contextResult.data : null

  if (!releaseCaseId && !scope.batchId) {
    return (
      <StandardWorkspaceTemplate
        registration={batchReleaseRegistration}
        scope={scope}
        defaultViewId="release-queue"
      >
        <BatchReleaseInitialState
          adapterMode={adapterMode}
          onLoadCandidate={() => onSelectCase?.('RC-2024-001847')}
        />
      </StandardWorkspaceTemplate>
    )
  }

  const activeView = resolveView(viewId, {
    qualityRequest,
    traceRequest,
    operationsRequest,
    warehouseRequest,
    onSelectCase,
    activeCaseId: effectiveCaseId,
  })

  return (
    <StandardWorkspaceTemplate
      registration={batchReleaseRegistration}
      scope={scope}
      defaultViewId={isValidViewId(viewId) ? viewId : 'release-queue'}
      actionSidebar={<ReleaseActionsPanel context={context} />}
    >
      <div style={{ padding: '16px 16px 0 16px' }}>
        <VerificationStatusBanner
          title="Quality Batch Release Integration Specifications"
          status="partial-native"
          sourceLabel="Hybrid/Mixed Quality Data Source"
          routes={['GET /api/cq/lab/fails', 'GET /api/cq/lab/plants']}
          sourceObjects={['vw_cq_lab_failures', 'vw_cq_lab_plants']}
          limitations={[
            'UAT verification pending',
            'Connected Quality Lab Board uses V1 legacy API (/api/cq/lab/fails)',
            'Batch release summaries, deviations, and CoA readiness are simulated in-memory (mock mode)',
            'Read-only cockpit — release actions are simulated and will not execute in SAP',
          ]}
          lastVerified="Pending UAT Sweep"
        />
      </div>
      {activeView}
    </StandardWorkspaceTemplate>
  )
}

/** All request objects needed by views. */
interface ViewRequests {
  qualityRequest: QualityReleaseAdapterRequest
  traceRequest: Trace2AdapterRequest
  operationsRequest: OperationsEvidenceAdapterRequest
  warehouseRequest: WarehouseEvidenceAdapterRequest
  onSelectCase?: (releaseCaseId: string) => void
  activeCaseId?: string
}

/**
 * Maps a viewId string to the corresponding React view component.
 *
 * @param viewId - The raw view ID string from the URL.
 * @param requests - All adapter request contexts forwarded to the view.
 * @returns The view component, or ReleaseQueueView as the default fallback.
 */
function resolveView(viewId: string, requests: ViewRequests): React.ReactNode {
  const {
    qualityRequest,
    traceRequest,
    operationsRequest,
    warehouseRequest,
    onSelectCase,
    activeCaseId,
  } = requests

  switch (viewId as BatchReleaseViewId) {
    case 'release-queue':
      return (
        <ReleaseQueueView
          request={qualityRequest}
          onSelectCase={onSelectCase}
          activeCaseId={activeCaseId}
        />
      )
    case 'batch-decision':
      return <BatchDecisionView request={qualityRequest} />
    case 'quality-evidence':
      return <QualityEvidenceView qualityRequest={qualityRequest} traceRequest={traceRequest} />
    case 'operations-evidence':
      return (
        <OperationsEvidenceView
          qualityRequest={qualityRequest}
          operationsRequest={operationsRequest}
          warehouseRequest={warehouseRequest}
          traceRequest={traceRequest}
        />
      )
    case 'warehouse-trace-evidence':
      return (
        <WarehouseTraceEvidenceView
          warehouseRequest={warehouseRequest}
          traceRequest={traceRequest}
          qualityRequest={qualityRequest}
        />
      )
    case 'decision-history':
      return <DecisionHistoryView request={qualityRequest} />
    case 'lab-board':
      return <LabBoardView request={{ plantId: qualityRequest.plantId }} />
    default:
      return (
        <ReleaseQueueView
          request={qualityRequest}
          onSelectCase={onSelectCase}
          activeCaseId={activeCaseId}
        />
      )
  }
}

/** Type guard for valid BatchReleaseViewId values. */
function isValidViewId(viewId: string): viewId is BatchReleaseViewId {
  const valid: BatchReleaseViewId[] = [
    'release-queue',
    'batch-decision',
    'quality-evidence',
    'operations-evidence',
    'warehouse-trace-evidence',
    'decision-history',
    'lab-board',
  ]
  return valid.includes(viewId as BatchReleaseViewId)
}
