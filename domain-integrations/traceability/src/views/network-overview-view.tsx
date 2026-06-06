import { useState } from 'react'
import { featureFlags } from '@connectio/feature-flags'
import { useOptionalActiveInvestigationContext } from '@connectio/workspace-runtime'
import { BatchHeaderNetworkPanel } from '../panels/batch-header-network-panel.js'
import type { StockBucket } from '../panels/batch-header-network-panel.js'
import { CustomerExposureNetworkPanel } from '../panels/customer-exposure-network-panel.js'
import {
  TraceGraphNetworkPanel,
  type RiskFilter,
} from '../panels/trace-graph-network-panel.js'
import { TraceabilityInitialState } from '../components/TraceabilityInitialState.js'
import { TraceQueryForm } from '../forms/trace-query-form.js'
import { UAT_CANDIDATE } from '../constants.js'
import {
  useBatchHeaderSummary,
  useCustomerExposureSummary,
  useTraceGraph,
} from '../adapters/trace2-queries.js'
import type { TraceNode } from '@connectio/data-contracts'
import type { Trace2AdapterRequest } from '../adapters/trace2-adapter.js'

export interface NetworkOverviewViewProps {
  readonly request: Trace2AdapterRequest
}

/**
 * Investigation Overview (Network) view.
 *
 * @remarks
 * Three-panel layout matching the Claude Design prototype: BatchHeader top-left,
 * CustomerExposure top-right, and a D3 force-directed lineage graph spanning the
 * full width below. Risk filter controls the graph; stock-bucket clicks open a
 * lightweight inline detail strip; node clicks log to console (drill-through
 * deferred to a future slice).
 */
export function NetworkOverviewView({ request: initialRequest }: NetworkOverviewViewProps) {
  const [request, setRequest] = useState<Trace2AdapterRequest>(initialRequest)
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [selectedBucket, setSelectedBucket] = useState<StockBucket | null>(null)
  const [selectedNode, setSelectedNode] = useState<TraceNode | null>(null)
  const adapterMode = import.meta.env.VITE_ADAPTER_MODE ?? 'mock'
  const setActiveInvestigationContext = useOptionalActiveInvestigationContext(
    (state) => state.setContext,
    () => undefined,
  )

  function submitInvestigationContext(nextRequest: Trace2AdapterRequest) {
    setRequest(nextRequest)
    if (!featureFlags.runtime.enableCrossDomainContext) return
    setActiveInvestigationContext({
      batchId: nextRequest.batchId,
      materialId: nextRequest.materialId,
      plantId: nextRequest.plantId,
      lastChangedByPanel: 'trace-query-form',
    })
  }

  const isInitialState = !request.batchId || request.batchId === ''

  // Primary-source validation gate: if batch-header returns not-found for this
  // (material, batch, plant) combination, the investigation context is invalid.
  // Suppress every downstream panel — lineage edges may exist for the same batch
  // in a different plant and would mislead the user about the entered context.
  const batchHeaderQuery = useBatchHeaderSummary(request, { enabled: !isInitialState })
  const validationFailed =
    !isInitialState &&
    batchHeaderQuery.data !== undefined &&
    !batchHeaderQuery.data.ok &&
    batchHeaderQuery.data.error.code === 'not-found'
  const customerExposureQuery = useCustomerExposureSummary(request, {
    enabled: !isInitialState && !validationFailed,
  })
  const traceGraphQuery = useTraceGraph(request, {
    enabled: !isInitialState && !validationFailed,
  })

  if (isInitialState) {
    return (
      <div style={{ gridColumn: '1 / -1', minWidth: 0 }}>
        <TraceabilityInitialState
          adapterMode={adapterMode}
          onLoadCandidate={() => {
            submitInvestigationContext({ ...request, ...UAT_CANDIDATE })
          }}
        >
          <TraceQueryForm
            onSubmit={submitInvestigationContext}
            initialMaterialId={request.materialId}
            initialBatchId={request.batchId}
            initialPlantId={request.plantId}
            hideCandidateButton={true}
          />
        </TraceabilityInitialState>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: 16,
        gridColumn: '1 / -1',
        minWidth: 0,
      }}
    >
      <TraceQueryForm
        onSubmit={submitInvestigationContext}
        initialMaterialId={request.materialId}
        initialBatchId={request.batchId}
        initialPlantId={request.plantId}
      />

      {validationFailed ? (
        <InvalidCombinationBanner request={request} />
      ) : (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              background: 'var(--shell-surface-2, #F1F1E5)',
              border: '1px solid var(--shell-line)',
              borderRadius: 8,
            }}
          >
            <label
              htmlFor="trace-network-risk-filter"
              style={{ fontSize: 12, fontWeight: 500, color: 'var(--shell-fg-2)' }}
            >
              Risk filter:
            </label>
            <select
              id="trace-network-risk-filter"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
              style={{
                padding: '4px 8px',
                fontSize: 12,
                border: '1px solid var(--shell-line)',
                borderRadius: 4,
                background: 'var(--shell-surface)',
                color: 'var(--forest)',
              }}
            >
              <option value="all">All nodes</option>
              <option value="critical">Critical+</option>
              <option value="high">High+</option>
              <option value="medium">Medium+</option>
              <option value="low">Low+</option>
            </select>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: 16,
            }}
          >
            <BatchHeaderNetworkPanel
              result={batchHeaderQuery.data}
              isLoading={batchHeaderQuery.isLoading}
              onStockBucketClick={setSelectedBucket}
            />
            <CustomerExposureNetworkPanel
              result={customerExposureQuery.data}
              isLoading={customerExposureQuery.isLoading}
            />
          </div>

          <TraceGraphNetworkPanel
            result={traceGraphQuery.data}
            isLoading={traceGraphQuery.isLoading}
            riskFilter={riskFilter}
            onNodeClick={setSelectedNode}
          />

          {selectedBucket && (
            <InlineBucketDetail
              bucket={selectedBucket}
              onDismiss={() => setSelectedBucket(null)}
            />
          )}

          {selectedNode && (
            <InlineNodeDetail node={selectedNode} onDismiss={() => setSelectedNode(null)} />
          )}
        </>
      )}
    </div>
  )
}

function InvalidCombinationBanner({ request }: { request: Trace2AdapterRequest }) {
  return (
    <div
      role="alert"
      style={{
        padding: 16,
        borderRadius: 8,
        border: '2px solid var(--sunset, #F24A00)',
        background: 'rgba(242, 74, 0, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--sunset, #F24A00)',
        }}
      >
        No batch record found for this combination
      </p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--shell-fg-2)' }}>
        The supplied material / batch / plant combination did not resolve to a batch in the
        primary source. All downstream panels (lineage graph, customer exposure) are suppressed
        to avoid showing data that does not correspond to the entered context. Verify the inputs
        — the same batch may exist in a different plant.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: '4px 12px',
          fontSize: 12,
          fontFamily: 'monospace',
          color: 'var(--forest)',
          paddingTop: 4,
        }}
      >
        <span style={{ color: 'var(--shell-fg-2)' }}>Material:</span>
        <span>{request.materialId ?? '(blank)'}</span>
        <span style={{ color: 'var(--shell-fg-2)' }}>Batch:</span>
        <span>{request.batchId ?? '(blank)'}</span>
        <span style={{ color: 'var(--shell-fg-2)' }}>Plant:</span>
        <span>{request.plantId ?? '(blank)'}</span>
      </div>
    </div>
  )
}

function InlineBucketDetail({
  bucket,
  onDismiss,
}: {
  bucket: StockBucket
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      style={{
        padding: 12,
        border: '1px solid var(--shell-line)',
        borderRadius: 8,
        background: 'var(--shell-surface)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>{bucket.label} stock</p>
        <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: 'var(--forest)' }}>
          {bucket.value.toLocaleString()}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          border: '1px solid var(--shell-line)',
          borderRadius: 4,
          background: 'var(--shell-surface)',
          color: 'var(--forest)',
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}

function InlineNodeDetail({
  node,
  onDismiss,
}: {
  node: TraceNode
  onDismiss: () => void
}) {
  return (
    <div
      role="status"
      style={{
        padding: 12,
        border: '1px solid var(--shell-line)',
        borderRadius: 8,
        background: 'var(--shell-surface)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--shell-fg-2)' }}>Selected lineage node</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 600, color: 'var(--forest)' }}>
          {node.batchId
            ? `${node.materialDescription} (${node.batchId})`
            : node.materialDescription}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 11, fontFamily: 'monospace', color: 'var(--shell-fg-2)' }}>
          {node.type ?? 'unknown'} · depth {node.depth ?? '—'} · risk: {node.riskLevel ?? 'unknown'}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          border: '1px solid var(--shell-line)',
          borderRadius: 4,
          background: 'var(--shell-surface)',
          color: 'var(--forest)',
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
